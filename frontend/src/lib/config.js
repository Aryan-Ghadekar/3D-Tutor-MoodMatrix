// Base URL of the FastAPI service. Server code can override it with BACKEND_URL;
// browser code only sees NEXT_PUBLIC_* variables.
export const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export const GOALS = ['gate', 'jee', 'neet', 'semester', 'concept'];
