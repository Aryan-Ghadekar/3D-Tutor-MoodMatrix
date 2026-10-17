import { NextResponse } from 'next/server';
import { authenticate, setSessionCookie } from '@/lib/server/auth';
import { createFailureLimiter, clientKey } from '@/lib/server/ratelimit';

// Guessing passwords: 5 failures for the same address + email lock that pair for 15 minutes, and 20 failures
// from one address lock the address (so rotating emails does not help).
const pairLimiter = globalThis.__loginPairLimiter ||= createFailureLimiter({ max: 5 });
const ipLimiter = globalThis.__loginIpLimiter ||= createFailureLimiter({ max: 20 });

const tooMany = (retryAfterMs) =>
  NextResponse.json(
    { error: `Too many failed attempts. Try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).` },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
  );

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, password, role, remember } = body;
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });

  const ip = clientKey(request);
  const pairKey = `${ip}|${String(email).trim().toLowerCase()}`;
  for (const [limiter, key] of [[pairLimiter, pairKey], [ipLimiter, ip]]) {
    const status = limiter.check(key);
    if (!status.allowed) return tooMany(status.retryAfterMs);
  }

  try {
    const user = await authenticate(email, password);
    if (!user) {
      pairLimiter.fail(pairKey);
      ipLimiter.fail(ip);
      return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
    }
    pairLimiter.reset(pairKey);
    if (role && user.role !== role) {
      return NextResponse.json({ error: `This account is registered as a ${user.role}. Switch the role above.` }, { status: 403 });
    }
    const response = NextResponse.json({ success: true, user });
    setSessionCookie(response, user.id, { remember: remember === true });
    return response;
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ error: 'Could not sign in' }, { status: 500 });
  }
}
