import { NextResponse } from 'next/server';
import { backendFetch, readJson, unreachableMessage } from '@/lib/server/backend';

export const maxDuration = 120;

// Knowledge-test questions for a lecture plan. Body: { lecture_plan, num_questions?, question_types? }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.lecture_plan?.impTopics?.length) {
    return NextResponse.json({ success: false, error: 'lecture_plan with topics is required' }, { status: 400 });
  }

  try {
    const response = await backendFetch('/generate-diagnostic-mcq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lecture_plan: body.lecture_plan,
        num_questions: body.num_questions ?? 10,
        question_types: body.question_types ?? [],
      }),
      signal: AbortSignal.timeout(110000),
    });
    const data = await readJson(response);
    if (!response.ok) {
      return NextResponse.json({ success: false, error: typeof data.detail === 'string' ? data.detail : 'Question generation failed' }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, error: unreachableMessage(error) }, { status: 503 });
  }
}
