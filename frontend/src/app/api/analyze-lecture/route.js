import { backendFetch, readJson, unreachableMessage } from '@/lib/server/backend';

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

  let path = '/analyze-lecture';
  if (ytLink) path += `?yt_link=${encodeURIComponent(ytLink)}`;

  let response;
  try {
    response = await backendFetch(path, { method: 'POST', body: formData, signal: AbortSignal.timeout(10 * 60 * 1000) });
  } catch (error) {
    return Response.json({ detail: unreachableMessage(error) }, { status: error.name === 'TimeoutError' ? 504 : 503 });
  }

  return Response.json(await readJson(response), { status: response.status });
}
