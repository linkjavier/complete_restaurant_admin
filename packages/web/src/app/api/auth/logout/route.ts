import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Create response and clear the token cookie
    const response = NextResponse.json({ message: 'Logged out successfully' });
    response.cookies.delete('token');

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    );
  }
} 