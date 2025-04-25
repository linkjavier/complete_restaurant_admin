import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {

    const body = await request.json();
    const { email, password } = body;

    console.log(email, password);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }), // usa "username" si tu backend espera eso
    });

    console.log(response)

    // Manejo de error
    if (!response.ok) {
      const errorText = await response.text(); // usa text() solo en errores
      console.error('Error response:', errorText);

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: response.status }
      );
    }

    // ✅ Aquí el body está disponible
    const data = await response.json();
    console.log("Respuesta recibida:", data);

    // Set cookie
    cookies().set('token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Login error:', error);

    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
