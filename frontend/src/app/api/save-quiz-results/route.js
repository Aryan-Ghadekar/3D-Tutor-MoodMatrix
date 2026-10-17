import { NextResponse } from 'next/server';
import { backendFetch, readJson, unreachableMessage } from '@/lib/server/backend';

// Stores a finished quiz (for example the knowledge test) in the FastAPI service.
// Body uses the backend's field names: session_id, lecture_id, score, correct, total, questions, answers,
// misconceptions, weak_topics, recommendations.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const response = await backendFetch('/save-quiz-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await readJson(response);
    if (!response.ok) {
      return NextResponse.json({ success: false, error: typeof data.detail === 'string' ? data.detail : 'Could not save the results' }, { status: response.status });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: unreachableMessage(error) }, { status: 503 });
  }
}
