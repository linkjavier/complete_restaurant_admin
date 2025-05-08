import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: response.status }
      );
    }

    const user = await response.json();
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while fetching user data' },
      { status: 500 }
    );
  }
} 