/**
 * AI slide generation: proxies to the FastAPI service. On failure it returns a non-2xx JSON error
 * and the client (IntelligenceEngine) falls back to locally generated content.
 */
import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/config';

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
    const backendResponse = await fetch(`${BACKEND_URL}/generate-dynamic-slide`, {
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

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return NextResponse.json(
        { success: false, error: `AI backend error ${backendResponse.status}: ${errorText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const result = await backendResponse.json();
    if (!result.success || !result.slide) {
      return NextResponse.json({ success: false, error: result.message || 'AI generation failed' }, { status: 502 });
    }

    return NextResponse.json({ success: true, slide: result.slide });
  } catch (error) {
    return NextResponse.json({ success: false, error: `AI backend unreachable: ${error.message}` }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'active', service: 'AI slide generation proxy', backend: BACKEND_URL });
}
