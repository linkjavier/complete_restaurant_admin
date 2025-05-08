import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Public paths that don't require authentication
  const publicPaths = ['/auth/login', '/auth/register', '/api/auth', '/assets', '/_next'];
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Check user role by calling the auth/me endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to verify token');
    }

    const user = await response.json();
    
    // If user is CHEF, only allow access to kitchen-manager and its API
    if (user.role === 'CHEF') {
      const allowedPaths = [
        '/admin/kitchen-manager',
        // '/admin/ingredients',
        '/api/kitchen',
        // '/api/ingredients',
        '/api/auth/me',
        '/api/auth/logout'
      ];
      
      // If not accessing allowed paths, redirect to kitchen-manager
      if (!allowedPaths.some(path => pathname.startsWith(path))) {
        return NextResponse.redirect(new URL('/admin/kitchen-manager', request.url));
      }
    }

    return NextResponse.next();
  } catch (error) {
    // If token verification fails, redirect to login
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }
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