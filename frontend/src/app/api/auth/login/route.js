import { NextResponse } from 'next/server';
import { authenticate, setSessionCookie } from '@/lib/server/auth';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, password, role } = body;
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });

  try {
    const user = await authenticate(email, password);
    if (!user) return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
    if (role && user.role !== role) {
      return NextResponse.json({ error: `This account is registered as a ${user.role}. Switch the role above.` }, { status: 403 });
    }
    const response = NextResponse.json({ success: true, user });
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ error: 'Could not sign in' }, { status: 500 });
  }
}
