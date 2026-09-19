const TOKEN_KEY = 'election-access-token';
const EXPIRES_KEY = 'election-access-expires';

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  const token = window.localStorage.getItem(TOKEN_KEY);
  const expires = window.localStorage.getItem(EXPIRES_KEY);
  if (!token || !expires) return null;
  if (new Date(expires).getTime() <= Date.now()) {
    clearAccessToken();
    return null;
  }
  return token;
}

export function setAccessToken(token: string, expiresAt: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(EXPIRES_KEY, expiresAt);
}

export function clearAccessToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(EXPIRES_KEY);
}
