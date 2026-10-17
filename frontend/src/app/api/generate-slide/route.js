/**
 * AI slide generation: proxies to the FastAPI service. On failure it returns a non-2xx JSON error
 * and the client (IntelligenceEngine) falls back to locally generated content.
 */
import { NextResponse } from 'next/server';
import { backendFetch, readJson, unreachableMessage } from '@/lib/server/backend';

export const maxDuration = 90;

export async function POST(request) {
  let data;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!data.sessionId) return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 });
  if (!data.lecturePlan) return NextResponse.json({ success: false, error: 'Missing lecturePlan' }, { status: 400 });

  try {
    const response = await backendFetch('/generate-dynamic-slide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: data.sessionId,
        lecture_plan: data.lecturePlan,
        student_goal: data.goal || 'gate',
        knowledge_state: data.knowledgeState || {},
        current_topic_index: Number(data.currentTopicIndex) || 0,
        action_type: data.actionType || 'concept_explanation',
        user_question: data.userQuestion || null,
        context: data.context || '',
      }),
      signal: AbortSignal.timeout(60000),
    });

    const body = await readJson(response);
    if (!response.ok || !body.success || !body.slide) {
      const detail = typeof body.detail === 'string' ? body.detail : body.message || 'AI generation failed';
      return NextResponse.json({ success: false, error: `AI backend error ${response.status}: ${detail}`.slice(0, 300) }, { status: 502 });
    }
    return NextResponse.json({ success: true, slide: body.slide });
  } catch (error) {
    return NextResponse.json({ success: false, error: unreachableMessage(error) }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'active', service: 'AI slide generation proxy' });
}
