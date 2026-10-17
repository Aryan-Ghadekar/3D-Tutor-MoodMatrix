import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/auth';

export async function GET(request) {
  return NextResponse.json({ user: await getSessionUser(request) });
}
