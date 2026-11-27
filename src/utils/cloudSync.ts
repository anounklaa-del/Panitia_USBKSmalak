import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { AuthUser, UserRole } from './authClient';

export type PasDatasetId =
  | 'students'
  | 'committee'
  | 'schedules'
  | 'proctors'
  | 'proctor_matrix'
  | 'berita_acara_overrides'
  | 'room_allocations'
  | 'rules_bell'
  | 'settings_configs';

export const ALL_PAS_DATASET_IDS: PasDatasetId[] = [
  'students',
  'committee',
  'schedules',
  'proctors',
  'proctor_matrix',
  'berita_acara_overrides',
  'room_allocations',
  'rules_bell',
  'settings_configs',
];

export interface CloudAuthStatus {
  initialized: boolean;
}

export interface CloudManagedAccount {
  username: string;
  usernameKey: string;
  displayName: string;
  role: UserRole;
  jabatan: string;
  active: boolean;
  isBuiltIn: boolean;
  createdAtIso?: string;
  updatedAtIso?: string;
}

// ---------------------------------------------------------------------------
// Helpers: Sanitization & WebCrypto PBKDF2-SHA256 Password Hashing
// ---------------------------------------------------------------------------

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function normalizeUsernameKey(username: string): string {
  return username.trim().toLowerCase();
}

function isValidUsernameFormat(username: string): boolean {
  return /^[a-zA-Z0-9._-]{3,32}$/.test(username.trim());
}

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

export async function hashPasswordPbkdf2(
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

export async function verifyPasswordPbkdf2(
  password: string,
  saltHex: string,
  expectedHashHex: string,
): Promise<boolean> {
  try {
    if (!saltHex || !expectedHashHex) return false;
    const { hashHex } = await hashPasswordPbkdf2(password, saltHex);
    return constantTimeEqualHex(hashHex, expectedHashHex);
  } catch {
    return false;
  }
}

function timestampToIso(val: unknown): string | undefined {
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    try {
      return (val as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return typeof val === 'string' ? val : undefined;
}

async function createAccountPairInCloud(params: {
  username: string;
  usernameKey: string;
  displayName: string;
  jabatan: string;
  role: UserRole;
  active: boolean;
  isBuiltIn: boolean;
  saltHex: string;
  hashHex: string;
}): Promise<void> {
  const accountPath = `pas_accounts/${params.usernameKey}`;
  const dirPath = `pas_account_directory/${params.usernameKey}`;
  const now = serverTimestamp();

  try {
    await setDoc(doc(db, 'pas_accounts', params.usernameKey), {
      username: params.username,
      usernameKey: params.usernameKey,
      displayName: params.displayName.slice(0, 120),
      jabatan: params.jabatan.slice(0, 120),
      role: params.role,
      active: params.active,
      isBuiltIn: params.isBuiltIn,
      saltHex: params.saltHex,
      hashHex: params.hashHex,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, accountPath, params.username);
  }

  try {
    await setDoc(doc(db, 'pas_account_directory', params.usernameKey), {
      username: params.username,
      usernameKey: params.usernameKey,
      displayName: params.displayName.slice(0, 120),
      jabatan: params.jabatan.slice(0, 120),
      role: params.role,
      active: params.active,
      isBuiltIn: params.isBuiltIn,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, dirPath, params.username);
  }
}

// ---------------------------------------------------------------------------
// Auto-migration from previous local static auth store (if Firestore empty)
// ---------------------------------------------------------------------------

const LEGACY_STATIC_STORE_KEY = 'pas_static_auth_store_v1';

interface LegacyStaticAccount {
  username?: string;
  usernameKey?: string;
  displayName?: string;
  role?: string;
  jabatan?: string;
  active?: boolean;
  saltHex?: string;
  hashHex?: string;
}

async function tryMigrateLegacyStaticAccounts(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(LEGACY_STATIC_STORE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { accounts?: LegacyStaticAccount[] };
    if (!parsed || !Array.isArray(parsed.accounts) || parsed.accounts.length === 0) {
      return false;
    }

    const adminAcc = parsed.accounts.find(
      (a) =>
        a.usernameKey === 'admin' &&
        a.active === true &&
        typeof a.saltHex === 'string' &&
        /^[a-f0-9]{16,128}$/.test(a.saltHex) &&
        typeof a.hashHex === 'string' &&
        /^[a-f0-9]{32,256}$/.test(a.hashHex),
    );
    if (!adminAcc) return false;

    // 1. Create admin first so adminExists() becomes true for subsequent accounts
    await createAccountPairInCloud({
      username: 'admin',
      usernameKey: 'admin',
      displayName: (adminAcc.displayName || 'Administrator Sistem').slice(0, 120),
      jabatan: (adminAcc.jabatan || 'Administrator Aplikasi').slice(0, 120),
      role: 'admin',
      active: true,
      isBuiltIn: true,
      saltHex: adminAcc.saltHex!,
      hashHex: adminAcc.hashHex!,
    });

    // 2. Migrate panitia and any custom accounts
    for (const acc of parsed.accounts) {
      const key = (acc.usernameKey || acc.username || '').trim().toLowerCase();
      if (!key || key === 'admin' || !/^[a-z0-9._-]{3,64}$/.test(key)) continue;
      if (
        typeof acc.saltHex !== 'string' ||
        !/^[a-f0-9]{16,128}$/.test(acc.saltHex) ||
        typeof acc.hashHex !== 'string' ||
        !/^[a-f0-9]{32,256}$/.test(acc.hashHex)
      ) {
        continue;
      }

      const isPanitiaBuiltIn = key === 'panitia';
      await createAccountPairInCloud({
        username: (acc.username || key).trim().slice(0, 64),
        usernameKey: key,
        displayName: (acc.displayName || acc.username || key).trim().slice(0, 120),
        jabatan: (acc.jabatan || 'Panitia Pelaksana PAS').trim().slice(0, 120),
        role: 'panitia',
        active: acc.active !== false,
        isBuiltIn: isPanitiaBuiltIn,
        saltHex: acc.saltHex,
        hashHex: acc.hashHex,
      });
    }

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cloud Username + Password Auth API (Zero Email / Zero Google Sign-In)
// ---------------------------------------------------------------------------

export async function fetchCloudAuthStatus(): Promise<CloudAuthStatus> {
  const path = 'pas_accounts/admin';
  let adminSnap;
  try {
    adminSnap = await getDoc(doc(db, 'pas_accounts', 'admin'));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  if (adminSnap.exists()) {
    return { initialized: true };
  }

  const migrated = await tryMigrateLegacyStaticAccounts();
  return { initialized: migrated };
}

export async function bootstrapCloudAccounts(payload: {
  adminPassword: string;
  panitiaPassword: string;
  loginAs: UserRole;
}): Promise<{ user: AuthUser }> {
  if (payload.adminPassword.length < 4) {
    throw new Error('Kata sandi Admin minimal 4 karakter.');
  }
  if (payload.panitiaPassword.length < 3) {
    throw new Error('Kata sandi Panitia minimal 3 karakter.');
  }

  const existingAdmin = await getDoc(doc(db, 'pas_accounts', 'admin'));
  if (existingAdmin.exists()) {
    throw new Error(
      'Akun Admin & Panitia sudah aktif di Cloud. Silakan langsung masuk menggunakan username dan kata sandi.',
    );
  }

  const adminHashed = await hashPasswordPbkdf2(payload.adminPassword);
  const panitiaHashed = await hashPasswordPbkdf2(payload.panitiaPassword);

  // Admin MUST be created first so adminExists() evaluates true in Firestore rules
  await createAccountPairInCloud({
    username: 'admin',
    usernameKey: 'admin',
    displayName: 'Administrator Sistem',
    jabatan: 'Administrator Aplikasi',
    role: 'admin',
    active: true,
    isBuiltIn: true,
    saltHex: adminHashed.saltHex,
    hashHex: adminHashed.hashHex,
  });

  const existingPanitia = await getDoc(doc(db, 'pas_accounts', 'panitia'));
  if (!existingPanitia.exists()) {
    await createAccountPairInCloud({
      username: 'Panitia',
      usernameKey: 'panitia',
      displayName: 'Panitia Ujian PAS',
      jabatan: 'Panitia Pelaksana PAS',
      role: 'panitia',
      active: true,
      isBuiltIn: true,
      saltHex: panitiaHashed.saltHex,
      hashHex: panitiaHashed.hashHex,
    });
  }

  if (payload.loginAs === 'panitia') {
    return {
      user: {
        username: 'Panitia',
        displayName: 'Panitia Ujian PAS',
        role: 'panitia',
        jabatan: 'Panitia Pelaksana PAS',
      },
    };
  }

  return {
    user: {
      username: 'admin',
      displayName: 'Administrator Sistem',
      role: 'admin',
      jabatan: 'Administrator Aplikasi',
    },
  };
}

export async function loginCloudWithCredentials(
  username: string,
  password: string,
): Promise<{ user: AuthUser }> {
  const cleanUser = username.trim();
  const key = normalizeUsernameKey(cleanUser);

  if (!cleanUser || !password) {
    throw new Error('Nama pengguna dan kata sandi wajib diisi.');
  }
  if (!isValidUsernameFormat(cleanUser)) {
    throw new Error('Nama pengguna atau kata sandi tidak valid.');
  }

  const path = `pas_accounts/${key}`;
  let snap;
  try {
    snap = await getDoc(doc(db, 'pas_accounts', key));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path, cleanUser);
  }

  if (!snap.exists()) {
    throw new Error(
      'Nama pengguna atau kata sandi salah, atau akun tidak terdaftar.',
    );
  }

  const data = snap.data();
  if (data.active !== true) {
    throw new Error(`Akun "${cleanUser}" sedang dinonaktifkan oleh Administrator.`);
  }

  const ok = await verifyPasswordPbkdf2(
    password,
    String(data.saltHex || ''),
    String(data.hashHex || ''),
  );
  if (!ok) {
    throw new Error('Nama pengguna atau kata sandi salah.');
  }

  return {
    user: {
      username: String(data.username || cleanUser),
      displayName: String(data.displayName || cleanUser),
      role: data.role === 'admin' ? 'admin' : 'panitia',
      jabatan: String(data.jabatan || 'Panitia Pelaksana PAS'),
    },
  };
}

export async function verifyCloudSessionUser(username: string): Promise<AuthUser | null> {
  const key = normalizeUsernameKey(username);
  if (!/^[a-z0-9._-]{3,64}$/.test(key)) return null;
  try {
    const snap = await getDoc(doc(db, 'pas_accounts', key));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.active !== true) return null;
    return {
      username: String(data.username || username),
      displayName: String(data.displayName || username),
      role: data.role === 'admin' ? 'admin' : 'panitia',
      jabatan: String(data.jabatan || 'Panitia Pelaksana PAS'),
    };
  } catch {
    return null;
  }
}

export async function fetchCloudAccountsDirectory(): Promise<CloudManagedAccount[]> {
  const path = 'pas_account_directory';
  try {
    const snap = await getDocs(collection(db, 'pas_account_directory'));
    const list: CloudManagedAccount[] = snap.docs.map((d) => {
      const data = d.data();
      const key = String(data.usernameKey || d.id).toLowerCase();
      return {
        username: String(data.username || key),
        usernameKey: key,
        displayName: String(data.displayName || data.username || key),
        role: data.role === 'admin' ? 'admin' : 'panitia',
        jabatan: String(data.jabatan || 'Panitia Pelaksana PAS'),
        active: Boolean(data.active),
        isBuiltIn: Boolean(data.isBuiltIn ?? (key === 'admin' || key === 'panitia')),
        createdAtIso: timestampToIso(data.createdAt),
        updatedAtIso: timestampToIso(data.updatedAt),
      };
    });

    return list.sort((a, b) => {
      const rank = (item: CloudManagedAccount) =>
        item.usernameKey === 'admin' ? 0 : item.usernameKey === 'panitia' ? 1 : 2;
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return a.displayName.localeCompare(b.displayName);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function createCloudPanitiaAccount(payload: {
  username: string;
  displayName: string;
  jabatan: string;
  password: string;
}): Promise<CloudManagedAccount> {
  const username = payload.username.trim();
  const key = normalizeUsernameKey(username);
  const displayName = payload.displayName.trim().slice(0, 120);
  const jabatan = (payload.jabatan.trim() || 'Anggota Panitia PAS').slice(0, 120);
  const password = payload.password;

  if (!isValidUsernameFormat(username)) {
    throw new Error(
      'Username harus 3–32 karakter (huruf, angka, titik, garis bawah, atau tanda hubung).',
    );
  }
  if (key === 'admin' || key === 'panitia') {
    throw new Error(`Username "${username}" dicadangkan untuk akun bawaan sistem.`);
  }
  if (displayName.length < 2) {
    throw new Error('Nama lengkap panitia wajib diisi (minimal 2 karakter).');
  }
  if (password.length < 3) {
    throw new Error('Kata sandi minimal 3 karakter.');
  }

  const existingSnap = await getDoc(doc(db, 'pas_accounts', key));
  if (existingSnap.exists()) {
    throw new Error(`Username "${username}" sudah terdaftar di Cloud.`);
  }

  const hashed = await hashPasswordPbkdf2(password);
  await createAccountPairInCloud({
    username,
    usernameKey: key,
    displayName,
    jabatan,
    role: 'panitia',
    active: true,
    isBuiltIn: false,
    saltHex: hashed.saltHex,
    hashHex: hashed.hashHex,
  });

  return {
    username,
    usernameKey: key,
    displayName,
    jabatan,
    role: 'panitia',
    active: true,
    isBuiltIn: false,
    createdAtIso: new Date().toISOString(),
    updatedAtIso: new Date().toISOString(),
  };
}

export async function updateCloudAccount(
  username: string,
  patch: { active?: boolean; displayName?: string; jabatan?: string; password?: string },
): Promise<CloudManagedAccount> {
  const key = normalizeUsernameKey(username);
  if (key === 'admin' && patch.active === false) {
    throw new Error('Akun utama Admin tidak dapat dinonaktifkan.');
  }

  const accountPath = `pas_accounts/${key}`;
  const dirPath = `pas_account_directory/${key}`;
  const accountRef = doc(db, 'pas_accounts', key);
  const dirRef = doc(db, 'pas_account_directory', key);

  let snap;
  try {
    snap = await getDoc(accountRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, accountPath, username);
  }

  if (!snap.exists()) {
    throw new Error(`Akun "${username}" tidak ditemukan di Cloud.`);
  }

  const current = snap.data();
  const nextDisplayName = (patch.displayName?.trim() || String(current.displayName || username)).slice(0, 120);
  const nextJabatan = (patch.jabatan?.trim() || String(current.jabatan || 'Panitia Pelaksana PAS')).slice(0, 120);
  const nextActive = typeof patch.active === 'boolean' ? patch.active : Boolean(current.active);

  const accountUpdate: Record<string, unknown> = {
    displayName: nextDisplayName,
    jabatan: nextJabatan,
    active: key === 'admin' ? true : nextActive,
    updatedAt: serverTimestamp(),
  };

  if (typeof patch.password === 'string' && patch.password.length > 0) {
    const minLen = key === 'admin' ? 4 : 3;
    if (patch.password.length < minLen) {
      throw new Error(`Kata sandi minimal ${minLen} karakter.`);
    }
    const hashed = await hashPasswordPbkdf2(patch.password);
    accountUpdate.saltHex = hashed.saltHex;
    accountUpdate.hashHex = hashed.hashHex;
  }

  try {
    await updateDoc(accountRef, accountUpdate);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, accountPath, username);
  }

  try {
    const dirSnap = await getDoc(dirRef);
    if (dirSnap.exists()) {
      await updateDoc(dirRef, {
        displayName: nextDisplayName,
        jabatan: nextJabatan,
        active: key === 'admin' ? true : nextActive,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(dirRef, {
        username: String(current.username || username),
        usernameKey: key,
        displayName: nextDisplayName,
        jabatan: nextJabatan,
        role: current.role === 'admin' ? 'admin' : 'panitia',
        active: key === 'admin' ? true : nextActive,
        isBuiltIn: Boolean(current.isBuiltIn ?? (key === 'admin' || key === 'panitia')),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, dirPath, username);
  }

  return {
    username: String(current.username || username),
    usernameKey: key,
    displayName: nextDisplayName,
    jabatan: nextJabatan,
    role: current.role === 'admin' ? 'admin' : 'panitia',
    active: key === 'admin' ? true : nextActive,
    isBuiltIn: Boolean(current.isBuiltIn ?? (key === 'admin' || key === 'panitia')),
    createdAtIso: timestampToIso(current.createdAt),
    updatedAtIso: new Date().toISOString(),
  };
}

export async function changeOwnCloudPassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const key = normalizeUsernameKey(username);
  const path = `pas_accounts/${key}`;
  const ref = doc(db, 'pas_accounts', key);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path, username);
  }

  if (!snap.exists()) {
    throw new Error('Data akun tidak ditemukan di Cloud.');
  }

  const data = snap.data();
  const valid = await verifyPasswordPbkdf2(
    currentPassword,
    String(data.saltHex || ''),
    String(data.hashHex || ''),
  );
  if (!valid) {
    throw new Error('Kata sandi saat ini tidak cocok.');
  }

  const minLen = data.role === 'admin' ? 4 : 3;
  if (newPassword.length < minLen) {
    throw new Error(`Kata sandi baru minimal ${minLen} karakter.`);
  }

  const hashed = await hashPasswordPbkdf2(newPassword);
  try {
    await updateDoc(ref, {
      saltHex: hashed.saltHex,
      hashHex: hashed.hashHex,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path, username);
  }
}

export async function deleteCloudPanitiaAccount(username: string): Promise<void> {
  const key = normalizeUsernameKey(username);
  if (key === 'admin' || key === 'panitia') {
    throw new Error('Akun bawaan Admin dan Panitia tidak dapat dihapus.');
  }

  try {
    await deleteDoc(doc(db, 'pas_accounts', key));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `pas_accounts/${key}`, username);
  }

  try {
    await deleteDoc(doc(db, 'pas_account_directory', key));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `pas_account_directory/${key}`, username);
  }
}

// ---------------------------------------------------------------------------
// Cloud Dataset Synchronization (9 shared PAS datasets)
// ---------------------------------------------------------------------------

const datasetWriteQueues = new Map<PasDatasetId, Promise<void>>();

export function saveCloudDataset(
  datasetId: PasDatasetId,
  payload: { items?: unknown[]; data?: Record<string, unknown> },
  itemCount: number,
  username: string,
): Promise<void> {
  const prev = datasetWriteQueues.get(datasetId) ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(async () => {
      const path = `pas_datasets/${datasetId}`;
      const ref = doc(db, 'pas_datasets', datasetId);
      const actor = (username.trim() || 'admin').slice(0, 64);
      const safeActor = actor.length >= 3 ? actor : 'admin';
      const sanitizedPayload = stripUndefinedDeep(payload);
      const clampedCount = Math.max(0, Math.min(2000, Math.floor(itemCount)));

      let existingSnap;
      try {
        existingSnap = await getDoc(ref);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path, safeActor);
      }

      if (existingSnap.exists()) {
        try {
          const existingData = existingSnap.data();
          const updatePayload: Record<string, unknown> = {
            datasetType: datasetId,
            payload: sanitizedPayload,
            itemCount: clampedCount,
            updatedByUsername: safeActor,
            updatedAt: serverTimestamp(),
          };
          if ('updatedByEmail' in existingData) {
            updatePayload.updatedByEmail = deleteField();
          }
          if ('updatedByUid' in existingData) {
            updatePayload.updatedByUid = deleteField();
          }
          await updateDoc(ref, updatePayload);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path, safeActor);
        }
      } else {
        try {
          await setDoc(ref, {
            datasetType: datasetId,
            payload: sanitizedPayload,
            itemCount: clampedCount,
            updatedByUsername: safeActor,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path, safeActor);
        }
      }
    });

  datasetWriteQueues.set(datasetId, next);
  return next;
}

export function subscribeToCloudDataset(
  datasetId: PasDatasetId,
  onData: (exists: boolean, payload: { items?: unknown[]; data?: Record<string, unknown> } | null) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const path = `pas_datasets/${datasetId}`;
  const ref = doc(db, 'pas_datasets', datasetId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(false, null);
        return;
      }
      const data = snap.data();
      onData(true, (data.payload as { items?: unknown[]; data?: Record<string, unknown> }) ?? null);
    },
    (err) => {
      if (onError) {
        onError(err);
      } else {
        handleFirestoreError(err, OperationType.GET, path);
      }
    },
  );
}
