export const DEFAULT_HOME_PATH = '/admin/dashboard';
export const CHEF_HOME_PATH = '/admin/kitchen-manager';

export function getHomePathForRole(role?: string | null): string {
  if (role === 'CHEF') {
    return CHEF_HOME_PATH;
  }

  return DEFAULT_HOME_PATH;
}

export function isPathAllowedForRole(role: string, pathname: string): boolean {
  if (role === 'CHEF') {
    return pathname.startsWith(CHEF_HOME_PATH);
  }

  return true;
}

export function getRoleFromAccessToken(token: string): string | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;

    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}
