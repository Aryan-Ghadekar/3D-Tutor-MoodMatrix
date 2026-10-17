import { NextResponse } from 'next/server';
import { getSessionUser, updateUser } from '@/lib/server/auth';
import { GOALS } from '@/lib/config';

export async function PUT(request) {
  let goal;
  try {
    ({ goal } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!GOALS.includes(goal)) {
    return NextResponse.json({ error: `Goal must be one of: ${GOALS.join(', ')}` }, { status: 400 });
  }

  const user = await getSessionUser(request);
  if (user) await updateUser(user.id, { goal });

  // Also kept in a cookie so the goal survives for visitors who are not signed in.
  const response = NextResponse.json({ success: true, goal, message: 'Goal saved successfully' });
  response.cookies.set('user_goal', goal, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return response;
}

export async function GET(request) {
  const user = await getSessionUser(request);
  const cookieGoal = request.cookies.get('user_goal')?.value;
  return NextResponse.json({ goal: user?.goal || (GOALS.includes(cookieGoal) ? cookieGoal : null) });
}
