import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

  // Si el usuario ya está autenticado y accede a la landing o login, redirigir al dashboard
  if (token && (pathname === '/' || pathname === '/auth/login')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
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