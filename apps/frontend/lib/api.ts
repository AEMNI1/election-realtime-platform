import { clearAccessToken, getAccessToken } from './auth';

export class ApiError extends Error {
  status?: number;
  payload?: unknown;
  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new ApiError('Session absente', 401);

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) clearAccessToken();
    const fieldErrors = (payload as any)?.details?.fieldErrors as Record<string, string[] | undefined> | undefined;
    const validationMessage = fieldErrors
      ? Object.entries(fieldErrors).flatMap(([field, errors]) => (errors ?? []).map(error => `${field}: ${error}`)).join(' — ')
      : '';
    throw new ApiError(validationMessage || (payload as any)?.message || (payload as any)?.error || 'Erreur API', response.status, payload);
  }
  return payload as T;
}

export async function logoutApi() {
  try { await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' }); } catch { /* local logout still proceeds */ }
  clearAccessToken();
}
