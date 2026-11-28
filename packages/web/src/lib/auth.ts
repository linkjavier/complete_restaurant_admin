export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const storedToken = localStorage.getItem('token');
  if (storedToken) return storedToken;

  const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match?.[1] ?? null;
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
}

export function removeAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  const secureCookie = window.location.protocol === 'https:' ? ' secure;' : '';
  document.cookie = `token=; path=/; max-age=0; samesite=lax;${secureCookie}`;
} 