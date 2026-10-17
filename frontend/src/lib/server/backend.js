// Server-side access to the FastAPI service. All AI endpoints are called from Next.js route handlers (never
// from the browser) so that the optional API key stays on the server.
import { BACKEND_URL } from '@/lib/config';

/** fetch() against the FastAPI service, adding the server-side API key when BACKEND_API_TOKEN is set. */
export function backendFetch(path, { headers, ...init } = {}) {
  const token = process.env.BACKEND_API_TOKEN;
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { ...(headers || {}), ...(token ? { 'X-API-Key': token } : {}) },
  });
}

/** Parse a response body as JSON, falling back to a message built from the raw text. */
export async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text.slice(0, 300) || 'Unexpected response from the AI service.' };
  }
}

export const unreachableMessage = (error) =>
  error?.name === 'TimeoutError'
    ? 'The AI service took too long to answer.'
    : `Cannot reach the AI service at ${BACKEND_URL}. Is the FastAPI server running?`;
