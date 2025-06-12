import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log("En route", process.env.NEXT_PUBLIC_API_URL)
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!process.env.NEXT_PUBLIC_API_URL) {
      console.error('NEXT_PUBLIC_API_URL is not defined');
      return NextResponse.json(
        { error: 'API URL is not configured' },
        { status: 500 }
      );
    }

    console.log('Attempting login to:', `${process.env.NEXT_PUBLIC_API_URL}/auth/login`);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Invalid credentials' }));
      console.error('Login error response:', errorData);
      return NextResponse.json(
        { error: errorData.error || 'Invalid credentials' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Login successful, setting cookie');

    const resp = NextResponse.json(data);
    resp.cookies.set('token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return resp;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
