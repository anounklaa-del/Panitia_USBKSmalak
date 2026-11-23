export type UserRole = 'admin' | 'panitia';

export interface AuthUser {
  username: string;
  displayName: string;
  role: UserRole;
  jabatan: string;
}

export interface AuthStatus {
  initialized: boolean;
  hasEnvAdmin: boolean;
  hasEnvPanitia: boolean;
  mode?: 'server' | 'static';
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  expiresAt: number;
}

export interface ManagedAccount {
  username: string;
  displayName: string;
  role: UserRole;
  jabatan: string;
  active: boolean;
  source: 'env' | 'local';
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsersListResponse {
  accounts: ManagedAccount[];
  hasEnvAdmin: boolean;
  hasEnvPanitia: boolean;
}

// ---------------------------------------------------------------------------
// Error extraction & HTTP helpers
// ---------------------------------------------------------------------------

function extractErrorMessage(payload: unknown, rawText: string, status: number): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const errField = record.error;

    if (typeof errField === 'string' && errField.trim()) {
      return errField.trim();
    }
    if (errField && typeof errField === 'object') {
      const errObj = errField as Record<string, unknown>;
      if (typeof errObj.message === 'string' && errObj.message.trim()) {
        return errObj.message.trim();
      }
      if (typeof errObj.error === 'string' && errObj.error.trim()) {
        return errObj.error.trim();
      }
      if (typeof errObj.status === 'string' && errObj.status.trim()) {
        return `${errObj.status.trim()} (HTTP ${status})`;
      }
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim();
    }
    if (typeof record.detail === 'string' && record.detail.trim()) {
      return record.detail.trim();
    }
  }

  const trimmed = rawText.trim();
  if (trimmed && !trimmed.startsWith('<')) {
    return trimmed.slice(0, 220);
  }

  if (status === 502 || status === 503 || status === 504) {
    return `Server autentikasi sedang memulai atau sibuk (HTTP ${status}). Silakan coba muat ulang.`;
  }
  return `Permintaan autentikasi gagal (HTTP ${status}).`;
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const rawText = await res.text().catch(() => '');
  let parsed: unknown = null;
  if (rawText.trim().length > 0) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    throw new Error(extractErrorMessage(parsed, rawText, res.status));
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(
      `Respons server autentikasi tidak valid (HTTP ${res.status}). Pastikan server API aktif.`,
    );
  }

  return parsed as T;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Static-hosting WebCrypto PBKDF2 fallback (used ONLY when /api/* returns 404
// or SPA HTML, e.g. on static shared preview links without a Node server).
// Passwords are never hardcoded and never stored in plaintext; session tokens
// remain strictly in JS memory.
// ---------------------------------------------------------------------------

const STATIC_STORE_KEY = 'pas_static_auth_store_v1';
const STATIC_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface StaticStoredAccount {
  username: string;
  usernameKey: string;
  displayName: string;
  role: UserRole;
  jabatan: string;
  active: boolean;
  saltHex: string;
  hashHex: string;
  createdAt: string;
  updatedAt: string;
}

interface StaticStore {
  version: number;
  accounts: StaticStoredAccount[];
}

let isStaticFallbackMode = false;
const staticSessions = new Map<string, { user: AuthUser; expiresAt: number }>();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function constantTimeEqualHex(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) return false;
  let diff = 0;
  for (let i = 0; i < aHex.length; i += 1) {
    diff |= aHex.charCodeAt(i) ^ bHex.charCodeAt(i);
  }
  return diff === 0;
}

function generateRandomHex(byteLength: number): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

async function hashPasswordPbkdf2(
  password: string,
  saltHex?: string,
): Promise<{ saltHex: string; hashHex: string }> {
  const actualSaltHex = saltHex ?? generateRandomHex(16);
  const saltBytes = hexToBytes(actualSaltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return {
    saltHex: actualSaltHex,
    hashHex: bytesToHex(new Uint8Array(derivedBits)),
  };
}

async function verifyPasswordPbkdf2(
  password: string,
  saltHex: string,
  expectedHashHex: string,
): Promise<boolean> {
  try {
    const { hashHex } = await hashPasswordPbkdf2(password, saltHex);
    return constantTimeEqualHex(hashHex, expectedHashHex);
  } catch {
    return false;
  }
}

function loadStaticStore(): StaticStore {
  try {
    const raw = localStorage.getItem(STATIC_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StaticStore>;
      if (parsed && Array.isArray(parsed.accounts)) {
        return {
          version: typeof parsed.version === 'number' ? parsed.version : 1,
          accounts: parsed.accounts,
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return { version: 1, accounts: [] };
}

function saveStaticStore(store: StaticStore): void {
  localStorage.setItem(STATIC_STORE_KEY, JSON.stringify(store));
}

function isStaticStoreInitialized(store: StaticStore): boolean {
  return store.accounts.some((acc) => acc.usernameKey === 'admin' && acc.active);
}

function issueStaticSession(user: AuthUser): LoginResponse {
  const token = `st_${generateRandomHex(24)}`;
  const expiresAt = Date.now() + STATIC_SESSION_TTL_MS;
  staticSessions.set(token, { user, expiresAt });
  return { token, user, expiresAt };
}

function requireStaticSession(token: string): { user: AuthUser; expiresAt: number } {
  const session = staticSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) staticSessions.delete(token);
    throw new Error('Sesi telah kedaluwarsa atau tidak valid.');
  }
  return session;
}

function toSafeStaticAccountView(acc: StaticStoredAccount): ManagedAccount {
  return {
    username: acc.username,
    displayName: acc.displayName,
    role: acc.role,
    jabatan: acc.jabatan,
    active: acc.active,
    source: 'local',
    isBuiltIn: acc.usernameKey === 'admin' || acc.usernameKey === 'panitia',
    createdAt: acc.createdAt,
    updatedAt: acc.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Public Auth Client API (Server primary, Static WebCrypto fallback on 404)
// ---------------------------------------------------------------------------

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const maxAttempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch('/api/auth/status', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      // When hosted on static preview (e.g. Shared App URL without Node backend),
      // /api/auth/status returns 404 or falls back to SPA index.html.
      if (res.status === 404 || (res.ok && contentType.includes('text/html'))) {
        isStaticFallbackMode = true;
        const store = loadStaticStore();
        return {
          initialized: isStaticStoreInitialized(store),
          hasEnvAdmin: false,
          hasEnvPanitia: false,
          mode: 'static',
        };
      }

      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxAttempts) {
        await delay(600 * attempt);
        continue;
      }

      const data = await parseJsonResponse<AuthStatus>(res);
      isStaticFallbackMode = false;
      return { ...data, mode: 'server' };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await delay(600 * attempt);
        continue;
      }
    }
  }

  if (lastError instanceof Error && lastError.message && lastError.message !== '[object Object]') {
    throw lastError;
  }
  throw new Error('Tidak dapat terhubung ke server autentikasi.');
}

export async function bootstrapInitialAccounts(payload: {
  adminPassword: string;
  panitiaPassword: string;
  loginAs: UserRole;
}): Promise<LoginResponse> {
  if (isStaticFallbackMode) {
    const store = loadStaticStore();
    if (isStaticStoreInitialized(store)) {
      throw new Error(
        'Kredensial sistem sudah diaktifkan. Gunakan menu masuk dengan akun Anda.',
      );
    }
    if (payload.adminPassword.length < 4) {
      throw new Error('Kata sandi admin minimal 4 karakter.');
    }
    if (payload.panitiaPassword.length < 3) {
      throw new Error('Kata sandi Panitia minimal 3 karakter.');
    }

    const nowIso = new Date().toISOString();
    const adminHashed = await hashPasswordPbkdf2(payload.adminPassword);
    const panitiaHashed = await hashPasswordPbkdf2(payload.panitiaPassword);

    const adminRecord: StaticStoredAccount = {
      username: 'admin',
      usernameKey: 'admin',
      displayName: 'Administrator Sistem',
      role: 'admin',
      jabatan: 'Administrator Aplikasi',
      active: true,
      saltHex: adminHashed.saltHex,
      hashHex: adminHashed.hashHex,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const panitiaRecord: StaticStoredAccount = {
      username: 'Panitia',
      usernameKey: 'panitia',
      displayName: 'Panitia Ujian PAS',
      role: 'panitia',
      jabatan: 'Panitia Pelaksana PAS',
      active: true,
      saltHex: panitiaHashed.saltHex,
      hashHex: panitiaHashed.hashHex,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const customOnly = store.accounts.filter(
      (a) => a.usernameKey !== 'admin' && a.usernameKey !== 'panitia',
    );
    saveStaticStore({
      version: 1,
      accounts: [adminRecord, panitiaRecord, ...customOnly],
    });

    const active = payload.loginAs === 'panitia' ? panitiaRecord : adminRecord;
    return issueStaticSession({
      username: active.username,
      displayName: active.displayName,
      role: active.role,
      jabatan: active.jabatan,
    });
  }

  const res = await fetch('/api/auth/bootstrap', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<LoginResponse>(res);
}

export async function loginWithCredentials(
  username: string,
  password: string,
): Promise<LoginResponse> {
  if (isStaticFallbackMode) {
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      throw new Error('Nama pengguna dan kata sandi wajib diisi.');
    }
    const store = loadStaticStore();
    const key = cleanUser.toLowerCase();
    const account = store.accounts.find((a) => a.usernameKey === key);
    if (
      !account ||
      !account.active ||
      !(await verifyPasswordPbkdf2(password, account.saltHex, account.hashHex))
    ) {
      throw new Error(
        'Nama pengguna atau kata sandi salah, atau akun tidak memiliki akses Panitia/Admin.',
      );
    }

    return issueStaticSession({
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      jabatan: account.jabatan,
    });
  }

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return parseJsonResponse<LoginResponse>(res);
}

export async function fetchCurrentUser(
  token: string,
): Promise<{ user: AuthUser; expiresAt: number }> {
  if (isStaticFallbackMode) {
    return requireStaticSession(token);
  }

  const res = await fetch('/api/auth/me', {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJsonResponse<{ user: AuthUser; expiresAt: number }>(res);
}

export async function logoutSession(token: string): Promise<void> {
  if (isStaticFallbackMode) {
    staticSessions.delete(token);
    return;
  }

  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  }).catch(() => undefined);
}

export async function fetchManagedAccounts(token: string): Promise<UsersListResponse> {
  if (isStaticFallbackMode) {
    const session = requireStaticSession(token);
    if (session.user.role !== 'admin') {
      throw new Error('Akses ditolak. Fitur ini khusus untuk Administrator.');
    }
    const store = loadStaticStore();
    return {
      accounts: store.accounts.map(toSafeStaticAccountView),
      hasEnvAdmin: false,
      hasEnvPanitia: false,
    };
  }

  const res = await fetch('/api/auth/users', {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJsonResponse<UsersListResponse>(res);
}

export async function createPanitiaAccount(
  token: string,
  payload: { username: string; displayName: string; jabatan: string; password: string },
): Promise<{ account: ManagedAccount }> {
  if (isStaticFallbackMode) {
    const session = requireStaticSession(token);
    if (session.user.role !== 'admin') {
      throw new Error('Akses ditolak. Fitur ini khusus untuk Administrator.');
    }

    const username = payload.username.trim();
    const displayName = payload.displayName.trim();
    const jabatan = payload.jabatan.trim() || 'Anggota Panitia PAS';
    const password = payload.password;

    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      throw new Error(
        'Username harus 3–32 karakter (huruf, angka, titik, garis bawah, atau tanda hubung).',
      );
    }
    if (!displayName || displayName.length < 2) {
      throw new Error('Nama lengkap panitia wajib diisi.');
    }
    if (password.length < 3) {
      throw new Error('Kata sandi minimal 3 karakter.');
    }

    const store = loadStaticStore();
    const usernameKey = username.toLowerCase();
    if (
      usernameKey === 'admin' ||
      usernameKey === 'panitia' ||
      store.accounts.some((a) => a.usernameKey === usernameKey)
    ) {
      throw new Error(`Username "${username}" sudah terdaftar.`);
    }

    const nowIso = new Date().toISOString();
    const hashed = await hashPasswordPbkdf2(password);
    const newAcc: StaticStoredAccount = {
      username,
      usernameKey,
      displayName,
      role: 'panitia',
      jabatan,
      active: true,
      saltHex: hashed.saltHex,
      hashHex: hashed.hashHex,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.accounts.push(newAcc);
    saveStaticStore(store);
    return { account: toSafeStaticAccountView(newAcc) };
  }

  const res = await fetch('/api/auth/users', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ account: ManagedAccount }>(res);
}

export async function updateManagedAccount(
  token: string,
  username: string,
  patch: { active?: boolean; displayName?: string; jabatan?: string; password?: string },
): Promise<{ account: ManagedAccount }> {
  if (isStaticFallbackMode) {
    const session = requireStaticSession(token);
    if (session.user.role !== 'admin') {
      throw new Error('Akses ditolak. Fitur ini khusus untuk Administrator.');
    }

    const targetKey = username.trim().toLowerCase();
    const store = loadStaticStore();
    const idx = store.accounts.findIndex((a) => a.usernameKey === targetKey);
    if (idx === -1) {
      throw new Error('Akun tidak ditemukan pada penyimpanan lokal.');
    }
    if (targetKey === 'admin' && patch.active === false) {
      throw new Error('Akun utama Admin tidak dapat dinonaktifkan.');
    }

    const current = store.accounts[idx];
    const updated: StaticStoredAccount = {
      ...current,
      displayName: patch.displayName?.trim() || current.displayName,
      jabatan: patch.jabatan?.trim() || current.jabatan,
      active: typeof patch.active === 'boolean' ? patch.active : current.active,
      updatedAt: new Date().toISOString(),
    };

    if (typeof patch.password === 'string' && patch.password.length > 0) {
      const minLen = targetKey === 'admin' ? 4 : 3;
      if (patch.password.length < minLen) {
        throw new Error(`Kata sandi minimal ${minLen} karakter.`);
      }
      const hashed = await hashPasswordPbkdf2(patch.password);
      updated.saltHex = hashed.saltHex;
      updated.hashHex = hashed.hashHex;
    }

    store.accounts[idx] = updated;
    saveStaticStore(store);
    return { account: toSafeStaticAccountView(updated) };
  }

  const res = await fetch(`/api/auth/users/${encodeURIComponent(username)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(patch),
  });
  return parseJsonResponse<{ account: ManagedAccount }>(res);
}

export async function deleteManagedAccount(token: string, username: string): Promise<void> {
  if (isStaticFallbackMode) {
    const session = requireStaticSession(token);
    if (session.user.role !== 'admin') {
      throw new Error('Akses ditolak. Fitur ini khusus untuk Administrator.');
    }

    const targetKey = username.trim().toLowerCase();
    if (targetKey === 'admin' || targetKey === 'panitia') {
      throw new Error('Akun bawaan Admin dan Panitia tidak dapat dihapus.');
    }
    const store = loadStaticStore();
    const before = store.accounts.length;
    store.accounts = store.accounts.filter((a) => a.usernameKey !== targetKey);
    if (store.accounts.length === before) {
      throw new Error('Akun tidak ditemukan.');
    }
    saveStaticStore(store);
    return;
  }

  const res = await fetch(`/api/auth/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  await parseJsonResponse<{ ok: boolean }>(res);
}

export async function changeOwnPassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (isStaticFallbackMode) {
    const session = requireStaticSession(token);
    const key = session.user.username.toLowerCase();
    const store = loadStaticStore();
    const acc = store.accounts.find((a) => a.usernameKey === key);
    if (!acc) {
      throw new Error('Data akun tidak ditemukan.');
    }
    if (!(await verifyPasswordPbkdf2(currentPassword, acc.saltHex, acc.hashHex))) {
      throw new Error('Kata sandi saat ini tidak cocok.');
    }
    const minLen = acc.role === 'admin' ? 4 : 3;
    if (newPassword.length < minLen) {
      throw new Error(`Kata sandi baru minimal ${minLen} karakter.`);
    }
    const hashed = await hashPasswordPbkdf2(newPassword);
    acc.saltHex = hashed.saltHex;
    acc.hashHex = hashed.hashHex;
    acc.updatedAt = new Date().toISOString();
    saveStaticStore(store);
    return;
  }

  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await parseJsonResponse<{ ok: boolean }>(res);
}
