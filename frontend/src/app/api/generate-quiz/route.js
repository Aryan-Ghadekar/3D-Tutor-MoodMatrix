/**
 * Topic quiz generation: validates the request and proxies to the FastAPI service.
 * When the AI is unavailable it answers 503 and the client (IntelligenceEngine) builds the quiz locally
 * from the lecture's own statements, so there is no second, lower-quality generator here.
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

  if (!data.topic || typeof data.topic !== 'object') {
    return NextResponse.json({ success: false, error: 'Missing required field: topic' }, { status: 400 });
  }
  if (!data.sessionId) {
    return NextResponse.json({ success: false, error: 'Missing required field: sessionId' }, { status: 400 });
  }

  const payload = {
    topic: data.topic,
    difficulty: data.difficulty || 'medium',
    studentGoal: data.studentGoal || 'gate',
    numberOfQuestions: Math.max(1, Math.min(Number(data.numberOfQuestions) || 5, 10)),
    sessionId: data.sessionId,
    misconceptions: (data.misconceptions || []).filter((m) => m && typeof m === 'object'),
    previousPerformance: data.previousPerformance || {},
    cognitiveLoad: data.cognitiveLoad || 'medium',
    recentContext: typeof data.recentContext === 'string' ? data.recentContext : '',
  };

  try {
    const response = await backendFetch('/generate-topic-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });
    const body = await readJson(response);

    if (!response.ok || !body.success || !body.quiz) {
      const detail = typeof body.detail === 'string' ? body.detail : 'AI quiz generation failed';
      return NextResponse.json({ success: false, error: detail }, { status: 503 });
    }
    return NextResponse.json({ success: true, quiz: body.quiz });
  } catch (error) {
    return NextResponse.json({ success: false, error: unreachableMessage(error) }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'active', service: 'quiz generation proxy' });
}
