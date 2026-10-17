import { BACKEND_URL } from '@/lib/config';

async function call(path, { method = 'GET', body, token } = {}) {
  let response;
  try {
    response = await fetch(`${BACKEND_URL}/classroom${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Teacher-Token': token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    const err = new Error('Cannot reach the classroom service. Is the FastAPI server running?');
    err.status = 0;
    throw err;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.detail || `Request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return data;
}

export const classroomApi = {
  create: (lecturePlan, teacherName) => call('', { method: 'POST', body: { lecture_plan: lecturePlan, teacher_name: teacherName } }),
  join: (code, name) => call(`/${encodeURIComponent(code)}/join`, { method: 'POST', body: { name } }),
  heartbeat: (code, payload) => call(`/${encodeURIComponent(code)}/heartbeat`, { method: 'POST', body: payload }),
  state: (code) => call(`/${encodeURIComponent(code)}/state`),
  result: (code, payload) => call(`/${encodeURIComponent(code)}/result`, { method: 'POST', body: payload }),
  dashboard: (code, token) => call(`/${encodeURIComponent(code)}/dashboard`, { token }),
  control: (code, token, body) => call(`/${encodeURIComponent(code)}/control`, { method: 'POST', body, token }),
  transcript: (code, token, text) => call(`/${encodeURIComponent(code)}/transcript`, { method: 'POST', body: { text }, token }),
  end: (code, token) => call(`/${encodeURIComponent(code)}/end`, { method: 'POST', token }),
};

export const STUDENT_KEY = 'classroom_student';   // { code, studentId, name }
export const TEACHER_KEY = 'classroom_teacher';   // { code, token }

export function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}
