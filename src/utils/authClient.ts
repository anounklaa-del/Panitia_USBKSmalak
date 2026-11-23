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

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Permintaan gagal (${res.status}).`);
  }
  return data;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch('/api/auth/status', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return parseJsonResponse<AuthStatus>(res);
}

export async function bootstrapInitialAccounts(payload: {
  adminPassword: string;
  panitiaPassword: string;
  loginAs: UserRole;
}): Promise<LoginResponse> {
  const res = await fetch('/api/auth/bootstrap', {
    method: 'POST',
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
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return parseJsonResponse<LoginResponse>(res);
}

export async function fetchCurrentUser(token: string): Promise<{ user: AuthUser; expiresAt: number }> {
  const res = await fetch('/api/auth/me', {
    method: 'GET',
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
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  }).catch(() => undefined);
}

export async function fetchManagedAccounts(token: string): Promise<UsersListResponse> {
  const res = await fetch('/api/auth/users', {
    method: 'GET',
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
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await parseJsonResponse<{ ok: boolean }>(res);
}
