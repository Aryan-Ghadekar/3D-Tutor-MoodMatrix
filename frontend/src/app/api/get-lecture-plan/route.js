import { NextResponse } from 'next/server';
import { backendFetch, unreachableMessage } from '@/lib/server/backend';

// Looks a saved lecture plan up in the FastAPI service by sessionId / lectureId.
// Pass latest=true to fall back to the most recent plan.
export async function GET(request) {
  const incoming = new URL(request.url).searchParams;
  const params = new URLSearchParams();
  for (const key of ['sessionId', 'lectureId', 'latest']) {
    if (incoming.get(key)) params.set(key, incoming.get(key));
  }

  try {
    const response = await backendFetch(`/get-lecture-plan?${params}`, { signal: AbortSignal.timeout(10000), cache: 'no-store' });

    if (response.status === 404) {
      return NextResponse.json({ success: false, error: 'Lecture plan not found' }, { status: 404 });
    }
    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Backend error ${response.status}` }, { status: 502 });
    }

    return NextResponse.json({ success: true, lecturePlan: await response.json() });
  } catch (error) {
    return NextResponse.json({ success: false, error: unreachableMessage(error) }, { status: 503 });
  }
}
