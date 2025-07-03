export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Busca el token en la cookie primero
  const match = document.cookie.match(/(^| )token=([^;]+)/);
  if (match) return match[2];
  // Si no está en la cookie, busca en localStorage
  return localStorage.getItem('token');
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
}

export function removeAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
} 