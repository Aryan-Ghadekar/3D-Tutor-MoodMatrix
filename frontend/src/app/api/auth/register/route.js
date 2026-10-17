import { NextResponse } from 'next/server';
import { createUser } from '@/lib/server/auth';
import { createRateLimiter, clientKey } from '@/lib/server/ratelimit';

// At most 10 account creations per hour from one address.
const limiter = globalThis.__registerLimiter ||= createRateLimiter({ max: 10, windowMs: 60 * 60_000 });

export async function POST(request) {
  const allowed = limiter.take(clientKey(request));
  if (!allowed.allowed) {
    return NextResponse.json(
      { error: 'Too many accounts created from this address. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(allowed.retryAfterMs / 1000)) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { name, email, password, role } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!/\S+@\S+\.\S+/.test(email || '')) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  if (typeof password !== 'string' || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }
  if (role === 'teacher' && !body.specialization?.trim()) {
    return NextResponse.json({ error: 'Specialization is required for teachers' }, { status: 400 });
  }

  try {
    const user = await createUser(body);
    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    if (error.status === 409) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Register failed:', error);
    return NextResponse.json({ error: 'Could not create the account' }, { status: 500 });
  }
}
