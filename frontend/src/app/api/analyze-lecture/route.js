import { BACKEND_URL } from '@/lib/config';

// Analysing a lecture (transcription + LLM calls) can take several minutes.
export const maxDuration = 600;

export async function POST(request) {
  const ytLink = new URL(request.url).searchParams.get('yt_link');

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ detail: 'Invalid upload: expected multipart form data.' }, { status: 400 });
  }

  let backendUrl = `${BACKEND_URL}/analyze-lecture`;
  if (ytLink) backendUrl += `?yt_link=${encodeURIComponent(ytLink)}`;

  let response;
  try {
    response = await fetch(backendUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
  } catch (error) {
    const timedOut = error.name === 'TimeoutError';
    return Response.json(
      {
        detail: timedOut
          ? 'The lecture analysis took too long. Try a shorter file.'
          : `Cannot reach the analysis service at ${BACKEND_URL}. Is the FastAPI server running?`,
      },
      { status: timedOut ? 504 : 503 }
    );
  }

  const text = await response.text();
  try {
    return Response.json(JSON.parse(text), { status: response.status });
  } catch {
    return Response.json({ detail: text.slice(0, 300) || 'Unexpected response from the analysis service.' }, { status: 502 });
  }
}
