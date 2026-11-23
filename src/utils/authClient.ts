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

      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxAttempts) {
        await delay(600 * attempt);
        continue;
      }

      return await parseJsonResponse<AuthStatus>(res);
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
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return parseJsonResponse<LoginResponse>(res);
}

export async function fetchCurrentUser(token: string): Promise<{ user: AuthUser; expiresAt: number }> {
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
