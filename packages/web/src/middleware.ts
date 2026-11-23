import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CHEF_HOME_PATH, getHomePathForRole, getRoleFromAccessToken } from '@/lib/roles';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  const hostHeader = request.headers.get('host') || '';
  const host = hostHeader.split(':')[0];
  const parts = host.split('.');

  // Detectar subdominio en cualquier entorno (localhost o producción)
  const isLocalhost = host.endsWith('localhost');
  const isProductionSubdomain = !isLocalhost && parts.length > 2;
  const hasSubdomain = (isLocalhost && parts.length >= 2 && parts[0] !== 'localhost') || isProductionSubdomain;

  // Si hay subdominio y la ruta es '/', redirigir a /auth/login
  if (hasSubdomain && pathname === '/') {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const role = token ? getRoleFromAccessToken(token) : null;

  if (token && (pathname === '/' || pathname === '/auth/login')) {
    return NextResponse.redirect(new URL(getHomePathForRole(role), request.url));
  }

  if (role === 'CHEF' && pathname.startsWith('/admin') && !pathname.startsWith(CHEF_HOME_PATH)) {
    return NextResponse.redirect(new URL(CHEF_HOME_PATH, request.url));
  }

  // Public paths that don't require authentication
  const publicPaths = [ '/',
                        '/auth/login',
                        '/auth/register', 
                        '/auth/oauth',
                        '/api/auth', 
                        '/assets',
                        '/table',
                        '/api/products',
                        '/api/orders',
                        '/_next']
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Si no hay token, redirige a login
  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Si hay token, permite el acceso
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};