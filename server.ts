import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';

type UserRole = 'admin' | 'panitia';

interface StoredAccount {
  username: string;
  usernameKey: string;
  displayName: string;
  role: UserRole;
  jabatan: string;
  active: boolean;
  salt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

interface PersistedAuthStore {
  version: number;
  accounts: StoredAccount[];
}

export interface SessionUser {
  username: string;
  displayName: string;
  role: UserRole;
  jabatan: string;
}

interface SignedTokenPayload {
  jti: string;
  sub: string;
  username: string;
  displayName: string;
  role: UserRole;
  jabatan: string;
  iat: number;
  exp: number;
}

const PORT = Number(process.env.DEFAULT_APP_PORT) || 3000;
const STORE_PATH = path.resolve(process.cwd(), '.pas-auth-store.json');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 15;

// Session signing secret: reads process.env or generates ephemeral 256-bit key in memory
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

const revokedTokenJtis = new Set<string>();
const failedLoginBuckets = new Map<string, { count: number; resetAt: number }>();

function getEnvAdminPasscode(): string {
  return (process.env.ADMIN_PASSCODE ?? '').trim();
}

function getEnvPanitiaPasscode(): string {
  return (process.env.PANITIA_PASSCODE ?? '').trim();
}

function hashPasswordScrypt(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64);
  return { salt: actualSalt, hash: derived.toString('hex') };
}

function verifyPasswordScrypt(password: string, salt: string, expectedHashHex: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function timingSafeTextMatch(candidate: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function loadAuthStore(): PersistedAuthStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedAuthStore>;
      if (parsed && Array.isArray(parsed.accounts)) {
        return {
          version: typeof parsed.version === 'number' ? parsed.version : 1,
          accounts: parsed.accounts,
        };
      }
    }
  } catch {
    // Fallback cleanly to empty store if store file cannot be parsed
  }
  return { version: 1, accounts: [] };
}

function saveAuthStore(store: PersistedAuthStore): void {
  const resolved = path.resolve(STORE_PATH);
  const baseDir = path.resolve(process.cwd());
  if (!resolved.startsWith(baseDir + path.sep)) {
    throw new Error('Invalid auth store path');
  }
  fs.writeFileSync(resolved, JSON.stringify(store, null, 2), { mode: 0o600 });
}

let authStore: PersistedAuthStore = loadAuthStore();

function isAuthInitialized(): boolean {
  if (getEnvAdminPasscode().length > 0) return true;
  return authStore.accounts.some((acc) => acc.usernameKey === 'admin' && acc.active);
}

function signSessionToken(user: SessionUser): { token: string; expiresAt: number } {
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const payload: SignedTokenPayload = {
    jti: crypto.randomBytes(16).toString('hex'),
    sub: user.username.toLowerCase(),
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    jabatan: user.jabatan,
    iat: now,
    exp: expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return { token: `${encodedPayload}.${signature}`, expiresAt };
}

function verifySessionToken(token: string): SignedTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as SignedTokenPayload;
    if (!decoded || typeof decoded.exp !== 'number' || decoded.exp <= Date.now()) {
      return null;
    }
    if (!decoded.jti || revokedTokenJtis.has(decoded.jti)) {
      return null;
    }
    if (decoded.role !== 'admin' && decoded.role !== 'panitia') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function checkRateLimit(clientKey: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = failedLoginBuckets.get(clientKey);
  if (!entry || entry.resetAt <= now) {
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= RATE_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

function recordFailedLogin(clientKey: string): void {
  const now = Date.now();
  const entry = failedLoginBuckets.get(clientKey);
  if (!entry || entry.resetAt <= now) {
    failedLoginBuckets.set(clientKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearFailedLogin(clientKey: string): void {
  failedLoginBuckets.delete(clientKey);
}

interface AuthenticatedRequest extends Request {
  authPayload?: SignedTokenPayload;
  authToken?: string;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.' });
    return;
  }
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi telah kedaluwarsa atau tidak valid.' });
    return;
  }
  req.authPayload = payload;
  req.authToken = token;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authPayload || req.authPayload.role !== 'admin') {
    res.status(403).json({ error: 'Akses ditolak. Fitur ini khusus untuk Administrator.' });
    return;
  }
  next();
}

function sanitizeUsername(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

function toSafeAccountView(acc: StoredAccount, source: 'env' | 'local') {
  return {
    username: acc.username,
    displayName: acc.displayName,
    role: acc.role,
    jabatan: acc.jabatan,
    active: acc.active,
    source,
    isBuiltIn: acc.usernameKey === 'admin' || acc.usernameKey === 'panitia',
    createdAt: acc.createdAt,
    updatedAt: acc.updatedAt,
  };
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Baseline security headers for API responses
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  // Public auth status check (never exposes passwords, hashes, or internal env values)
  app.get('/api/auth/status', (_req, res) => {
    const hasEnvAdmin = getEnvAdminPasscode().length > 0;
    const hasEnvPanitia = getEnvPanitiaPasscode().length > 0;
    res.json({
      initialized: isAuthInitialized(),
      hasEnvAdmin,
      hasEnvPanitia,
    });
  });

  // One-time first-run credential activation when env secrets are not configured yet
  app.post('/api/auth/bootstrap', (req, res) => {
    if (isAuthInitialized()) {
      res.status(409).json({
        error: 'Kredensial sistem sudah diaktifkan. Gunakan menu masuk dengan akun Anda.',
      });
      return;
    }

    const body = req.body as {
      adminPassword?: unknown;
      panitiaPassword?: unknown;
      loginAs?: unknown;
    };
    const adminPassword = typeof body.adminPassword === 'string' ? body.adminPassword : '';
    const panitiaPassword = typeof body.panitiaPassword === 'string' ? body.panitiaPassword : '';
    const loginAs: UserRole = body.loginAs === 'panitia' ? 'panitia' : 'admin';

    if (adminPassword.length < 4) {
      res.status(400).json({ error: 'Kata sandi admin minimal 4 karakter.' });
      return;
    }
    if (panitiaPassword.length < 3) {
      res.status(400).json({ error: 'Kata sandi Panitia minimal 3 karakter.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const adminHashed = hashPasswordScrypt(adminPassword);
    const panitiaHashed = hashPasswordScrypt(panitiaPassword);

    const adminRecord: StoredAccount = {
      username: 'admin',
      usernameKey: 'admin',
      displayName: 'Administrator Sistem',
      role: 'admin',
      jabatan: 'Administrator Aplikasi',
      active: true,
      salt: adminHashed.salt,
      passwordHash: adminHashed.hash,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const panitiaRecord: StoredAccount = {
      username: 'Panitia',
      usernameKey: 'panitia',
      displayName: 'Panitia Ujian PAS',
      role: 'panitia',
      jabatan: 'Panitia Pelaksana PAS',
      active: true,
      salt: panitiaHashed.salt,
      passwordHash: panitiaHashed.hash,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const customOnly = authStore.accounts.filter(
      (a) => a.usernameKey !== 'admin' && a.usernameKey !== 'panitia',
    );
    authStore = {
      version: 1,
      accounts: [adminRecord, panitiaRecord, ...customOnly],
    };
    saveAuthStore(authStore);

    const activeRecord = loginAs === 'panitia' ? panitiaRecord : adminRecord;
    const user: SessionUser = {
      username: activeRecord.username,
      displayName: activeRecord.displayName,
      role: activeRecord.role,
      jabatan: activeRecord.jabatan,
    };
    const { token, expiresAt } = signSessionToken(user);
    res.status(201).json({ token, user, expiresAt });
  });

  // Server-verified login (only Panitia & Admin accounts allowed)
  app.post('/api/auth/login', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'local';
    const rate = checkRateLimit(clientIp);
    if (!rate.allowed) {
      res.status(429).json({
        error: `Terlalu banyak percobaan gagal. Coba kembali dalam ${rate.retryAfterSec} detik.`,
      });
      return;
    }

    const body = req.body as { username?: unknown; password?: unknown };
    const usernameInput = sanitizeUsername(body.username);
    const passwordInput = typeof body.password === 'string' ? body.password : '';

    if (!usernameInput || !passwordInput) {
      res.status(400).json({ error: 'Nama pengguna dan kata sandi wajib diisi.' });
      return;
    }

    const key = usernameInput.toLowerCase();
    const envAdmin = getEnvAdminPasscode();
    const envPanitia = getEnvPanitiaPasscode();

    let authenticatedUser: SessionUser | null = null;

    if (key === 'admin') {
      const storedAdmin = authStore.accounts.find((a) => a.usernameKey === 'admin');
      if (envAdmin.length > 0) {
        if (timingSafeTextMatch(passwordInput, envAdmin)) {
          authenticatedUser = {
            username: 'admin',
            displayName: storedAdmin?.displayName ?? 'Administrator Sistem',
            role: 'admin',
            jabatan: storedAdmin?.jabatan ?? 'Administrator Aplikasi',
          };
        }
      } else if (
        storedAdmin &&
        storedAdmin.active &&
        verifyPasswordScrypt(passwordInput, storedAdmin.salt, storedAdmin.passwordHash)
      ) {
        authenticatedUser = {
          username: storedAdmin.username,
          displayName: storedAdmin.displayName,
          role: 'admin',
          jabatan: storedAdmin.jabatan,
        };
      }
    } else if (key === 'panitia') {
      const storedPanitia = authStore.accounts.find((a) => a.usernameKey === 'panitia');
      if (envPanitia.length > 0) {
        if (timingSafeTextMatch(passwordInput, envPanitia)) {
          authenticatedUser = {
            username: 'Panitia',
            displayName: storedPanitia?.displayName ?? 'Panitia Ujian PAS',
            role: 'panitia',
            jabatan: storedPanitia?.jabatan ?? 'Panitia Pelaksana PAS',
          };
        }
      } else if (
        storedPanitia &&
        storedPanitia.active &&
        verifyPasswordScrypt(passwordInput, storedPanitia.salt, storedPanitia.passwordHash)
      ) {
        authenticatedUser = {
          username: storedPanitia.username,
          displayName: storedPanitia.displayName,
          role: 'panitia',
          jabatan: storedPanitia.jabatan,
        };
      }
    } else {
      // Custom Panitia member login provisioned by Admin
      const account = authStore.accounts.find((a) => a.usernameKey === key);
      if (
        account &&
        account.active &&
        account.role === 'panitia' &&
        verifyPasswordScrypt(passwordInput, account.salt, account.passwordHash)
      ) {
        authenticatedUser = {
          username: account.username,
          displayName: account.displayName,
          role: 'panitia',
          jabatan: account.jabatan,
        };
      }
    }

    if (!authenticatedUser) {
      recordFailedLogin(clientIp);
      res.status(401).json({
        error: 'Nama pengguna atau kata sandi salah, atau akun tidak memiliki akses Panitia/Admin.',
      });
      return;
    }

    clearFailedLogin(clientIp);
    const { token, expiresAt } = signSessionToken(authenticatedUser);
    res.json({ token, user: authenticatedUser, expiresAt });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const p = req.authPayload!;
    res.json({
      user: {
        username: p.username,
        displayName: p.displayName,
        role: p.role,
        jabatan: p.jabatan,
      },
      expiresAt: p.exp,
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.authPayload?.jti) {
      revokedTokenJtis.add(req.authPayload.jti);
    }
    res.json({ ok: true });
  });

  // Admin-only: List login accounts (never exposes hashes/salts)
  app.get('/api/auth/users', requireAuth, requireAdmin, (_req, res) => {
    const envAdminActive = getEnvAdminPasscode().length > 0;
    const envPanitiaActive = getEnvPanitiaPasscode().length > 0;

    const list = authStore.accounts.map((acc) => {
      if (acc.usernameKey === 'admin' && envAdminActive) {
        return toSafeAccountView(acc, 'env');
      }
      if (acc.usernameKey === 'panitia' && envPanitiaActive) {
        return toSafeAccountView(acc, 'env');
      }
      return toSafeAccountView(acc, 'local');
    });

    // If env vars are configured without local records yet, still represent built-in env accounts
    if (envAdminActive && !list.some((a) => a.username.toLowerCase() === 'admin')) {
      list.unshift({
        username: 'admin',
        displayName: 'Administrator Sistem',
        role: 'admin',
        jabatan: 'Administrator Aplikasi',
        active: true,
        source: 'env',
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    if (envPanitiaActive && !list.some((a) => a.username.toLowerCase() === 'panitia')) {
      list.splice(1, 0, {
        username: 'Panitia',
        displayName: 'Panitia Ujian PAS',
        role: 'panitia',
        jabatan: 'Panitia Pelaksana PAS',
        active: true,
        source: 'env',
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    res.json({ accounts: list, hasEnvAdmin: envAdminActive, hasEnvPanitia: envPanitiaActive });
  });

  // Admin-only: Provision new Panitia login account
  app.post('/api/auth/users', requireAuth, requireAdmin, (req, res) => {
    const body = req.body as {
      username?: unknown;
      displayName?: unknown;
      jabatan?: unknown;
      password?: unknown;
    };
    const username = sanitizeUsername(body.username);
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const jabatan =
      typeof body.jabatan === 'string' && body.jabatan.trim()
        ? body.jabatan.trim()
        : 'Anggota Panitia PAS';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      res.status(400).json({
        error: 'Username harus 3–32 karakter (huruf, angka, titik, garis bawah, atau tanda hubung).',
      });
      return;
    }
    if (!displayName || displayName.length < 2) {
      res.status(400).json({ error: 'Nama lengkap panitia wajib diisi.' });
      return;
    }
    if (password.length < 3) {
      res.status(400).json({ error: 'Kata sandi minimal 3 karakter.' });
      return;
    }

    const usernameKey = username.toLowerCase();
    if (
      usernameKey === 'admin' ||
      usernameKey === 'panitia' ||
      authStore.accounts.some((a) => a.usernameKey === usernameKey)
    ) {
      res.status(409).json({ error: `Username "${username}" sudah terdaftar.` });
      return;
    }

    const nowIso = new Date().toISOString();
    const { salt, hash } = hashPasswordScrypt(password);
    const newAcc: StoredAccount = {
      username,
      usernameKey,
      displayName,
      role: 'panitia',
      jabatan,
      active: true,
      salt,
      passwordHash: hash,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    authStore.accounts.push(newAcc);
    saveAuthStore(authStore);
    res.status(201).json({ account: toSafeAccountView(newAcc, 'local') });
  });

  // Admin-only: Update active status, jabatan/displayName, or reset password
  app.patch('/api/auth/users/:username', requireAuth, requireAdmin, (req, res) => {
    const targetKey = decodeURIComponent(String(req.params.username ?? '')).trim().toLowerCase();
    const body = req.body as {
      active?: unknown;
      displayName?: unknown;
      jabatan?: unknown;
      password?: unknown;
    };

    const accIndex = authStore.accounts.findIndex((a) => a.usernameKey === targetKey);
    if (accIndex === -1) {
      res.status(404).json({ error: 'Akun tidak ditemukan pada penyimpanan lokal.' });
      return;
    }

    const current = authStore.accounts[accIndex];
    if (targetKey === 'admin' && body.active === false) {
      res.status(400).json({ error: 'Akun utama Admin tidak dapat dinonaktifkan.' });
      return;
    }

    if (
      typeof body.password === 'string' &&
      body.password.length > 0 &&
      ((targetKey === 'admin' && getEnvAdminPasscode().length > 0) ||
        (targetKey === 'panitia' && getEnvPanitiaPasscode().length > 0))
    ) {
      res.status(400).json({
        error: 'Kata sandi akun ini dikunci oleh Environment Secret (ADMIN_PASSCODE/PANITIA_PASSCODE).',
      });
      return;
    }

    const updated: StoredAccount = {
      ...current,
      displayName:
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim()
          : current.displayName,
      jabatan:
        typeof body.jabatan === 'string' && body.jabatan.trim()
          ? body.jabatan.trim()
          : current.jabatan,
      active: typeof body.active === 'boolean' ? body.active : current.active,
      updatedAt: new Date().toISOString(),
    };

    if (typeof body.password === 'string' && body.password.length > 0) {
      const minLen = targetKey === 'admin' ? 4 : 3;
      if (body.password.length < minLen) {
        res.status(400).json({ error: `Kata sandi minimal ${minLen} karakter.` });
        return;
      }
      const hashed = hashPasswordScrypt(body.password);
      updated.salt = hashed.salt;
      updated.passwordHash = hashed.hash;
    }

    authStore.accounts[accIndex] = updated;
    saveAuthStore(authStore);
    res.json({ account: toSafeAccountView(updated, 'local') });
  });

  // Admin-only: Delete custom Panitia account
  app.delete('/api/auth/users/:username', requireAuth, requireAdmin, (req, res) => {
    const targetKey = decodeURIComponent(String(req.params.username ?? '')).trim().toLowerCase();
    if (targetKey === 'admin' || targetKey === 'panitia') {
      res.status(400).json({ error: 'Akun bawaan Admin dan Panitia tidak dapat dihapus.' });
      return;
    }
    const before = authStore.accounts.length;
    authStore.accounts = authStore.accounts.filter((a) => a.usernameKey !== targetKey);
    if (authStore.accounts.length === before) {
      res.status(404).json({ error: 'Akun tidak ditemukan.' });
      return;
    }
    saveAuthStore(authStore);
    res.json({ ok: true });
  });

  // Authenticated user: Change own password (or Admin changing built-in accounts)
  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const p = req.authPayload!;
    const body = req.body as { currentPassword?: unknown; newPassword?: unknown };
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    const key = p.username.toLowerCase();
    if (
      (key === 'admin' && getEnvAdminPasscode().length > 0) ||
      (key === 'panitia' && getEnvPanitiaPasscode().length > 0)
    ) {
      res.status(400).json({
        error: 'Kata sandi akun ini diatur melalui Environment Secret server.',
      });
      return;
    }

    const acc = authStore.accounts.find((a) => a.usernameKey === key);
    if (!acc) {
      res.status(404).json({ error: 'Data akun tidak ditemukan.' });
      return;
    }

    if (!verifyPasswordScrypt(currentPassword, acc.salt, acc.passwordHash)) {
      res.status(401).json({ error: 'Kata sandi saat ini tidak cocok.' });
      return;
    }

    const minLen = acc.role === 'admin' ? 4 : 3;
    if (newPassword.length < minLen) {
      res.status(400).json({ error: `Kata sandi baru minimal ${minLen} karakter.` });
      return;
    }

    const hashed = hashPasswordScrypt(newPassword);
    acc.salt = hashed.salt;
    acc.passwordHash = hashed.hash;
    acc.updatedAt = new Date().toISOString();
    saveAuthStore(authStore);
    res.json({ ok: true });
  });

  // Reject unknown API endpoints before SPA fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server PAS SMAN 1 Alalak berjalan di http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal menjalankan server:', err);
  process.exit(1);
});
