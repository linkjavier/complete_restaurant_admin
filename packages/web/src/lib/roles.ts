export const DEFAULT_HOME_PATH = '/admin/dashboard';
export const CHEF_HOME_PATH = '/admin/kitchen-manager';
export const CASHIER_HOME_PATH = '/admin/pos';

const ADMIN_MODULE_ACCESS = [
  { path: '/admin/dashboard', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/admin/ai-manager', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'] },
  { path: '/admin/ai-manager-v2', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'] },
  { path: '/admin/pos', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'CASHIER'] },
  { path: '/admin/orders', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'] },
  { path: '/admin/tables', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'] },
  { path: '/admin/qr-menu', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/admin/kitchen-manager', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CHEF'] },
  { path: '/admin/categories', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/admin/products', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/admin/ingredients', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/admin/inventory', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/admin/purchases', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/admin/production', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/admin/locations', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/admin/customers', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/admin/users', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/admin/settings', roles: ['SUPER_ADMIN', 'ADMIN'] },
] as const;

export function getHomePathForRole(role?: string | null): string {
  if (role === 'CHEF') {
    return CHEF_HOME_PATH;
  }

  if (role === 'CASHIER' || role === 'STAFF') {
    return CASHIER_HOME_PATH;
  }

  if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER') {
    return DEFAULT_HOME_PATH;
  }

  return '/auth/login';
}

export function isPathAllowedForRole(role: string, pathname: string): boolean {
  if (pathname !== '/admin' && !pathname.startsWith('/admin/')) {
    return true;
  }

  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const matchedModule = ADMIN_MODULE_ACCESS.find(
    ({ path }) => normalizedPath === path || normalizedPath.startsWith(`${path}/`),
  );

  return matchedModule?.roles.some((allowedRole) => allowedRole === role) ?? false;
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
