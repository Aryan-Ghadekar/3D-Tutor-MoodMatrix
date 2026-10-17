import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/auth';
import { GOALS } from '@/lib/config';

export async function GET(request) {
  const user = await getSessionUser(request);
  const cookieGoal = request.cookies.get('user_goal')?.value;
  const goal = user?.goal || (GOALS.includes(cookieGoal) ? cookieGoal : null);
  return NextResponse.json({ goal, user });
}
