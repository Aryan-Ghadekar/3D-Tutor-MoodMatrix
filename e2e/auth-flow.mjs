// Security behaviour: API key on the AI service, login rate limiting, "Remember me", no dead links.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:8001';
const REQUIRE_KEY = process.env.API_TOKEN_EXPECTED === '1';
const problems = [];
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log(`[FAIL] ${msg}`); } else console.log(`[e2e] ok: ${msg}`); };

const browser = await chromium.launch();
const stamp = Date.now();
const password = 'secret123';

async function register(request, email) {
  const r = await request.post(`${BASE}/api/auth/register`, { data: { name: 'Sec Test', email, password, role: 'student' } });
  return r.status();
}

// ------------------------------------------------------------------ "Remember me"
{
  const email = `remember_${stamp}@example.com`;
  const context = await browser.newContext();
  check((await register(context.request, email)) === 201, 'account created');

  const session = async (remember) => {
    await context.clearCookies();
    const r = await context.request.post(`${BASE}/api/auth/login`, { data: { email, password, remember } });
    if (r.status() !== 200) throw new Error(`login failed (${r.status()})`);
    return (await context.cookies()).find((c) => c.name === 'mm_session');
  };

  const plain = await session(false);
  check(plain && plain.expires === -1, 'without "Remember me" the cookie is a browser-session cookie');
  check(plain.httpOnly === true, 'the session cookie is HttpOnly');

  const remembered = await session(true);
  const days = (remembered.expires - Date.now() / 1000) / 86400;
  check(days > 25 && days < 31, `with "Remember me" the cookie lasts about 30 days (${days.toFixed(1)} days)`);
  await context.close();
}

// ------------------------------------------------------------------ rate limiting
{
  const email = `limit_${stamp}@example.com`;
  const context = await browser.newContext();
  await register(context.request, email);
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    statuses.push((await context.request.post(`${BASE}/api/auth/login`, { data: { email, password: `wrong${i}` } })).status());
  }
  check(statuses.slice(0, 5).every((s) => s === 401), 'the first five wrong passwords are answered with 401');
  check(statuses[5] === 429, `the sixth attempt is blocked (${statuses[5]})`);

  const blocked = await context.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
  check(blocked.status() === 429 && Number(blocked.headers()['retry-after']) > 0, 'even the correct password is refused while locked, with a Retry-After header');
  const body = await blocked.json();
  check(/try again in \d+ minute/i.test(body.error), 'the message says how long to wait');

  // another account from the same address is not locked
  const other = `other_${stamp}@example.com`;
  await register(context.request, other);
  check((await context.request.post(`${BASE}/api/auth/login`, { data: { email: other, password } })).status() === 200, 'a different account can still sign in');
  await context.close();
}

// ------------------------------------------------------------------ login page
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/auth/login`);
  check(await page.locator('text=Forgot password').count() === 0, 'no dead "Forgot password?" link');
  check(await page.locator('text=Remember me').count() === 1, '"Remember me" is offered');
  await page.close();
}

// ------------------------------------------------------------------ AI service key
{
  const root = await (await fetch(`${API}/`)).json();
  check((await fetch(`${API}/health`)).status === 200, '/health is open');
  if (REQUIRE_KEY) {
    check(root.auth_required === true, 'the AI service reports that a key is required');
    const unauth = await fetch(`${API}/get-lecture-plan?latest=true`);
    check(unauth.status === 401, 'the AI service refuses requests without the key');
    const wrong = await fetch(`${API}/get-lecture-plan?latest=true`, { headers: { 'X-API-Key': 'nope' } });
    check(wrong.status === 401, 'the AI service refuses a wrong key');
    check((await fetch(`${API}/classroom/ZZZZZZ/state`)).status === 404, 'classroom endpoints stay reachable (they use join codes and teacher tokens)');
    // through the web app's server (which holds the key) the same call works or reports "not found", never 401
    const viaNext = await fetch(`${BASE}/api/get-lecture-plan?latest=true`);
    check(viaNext.status !== 401 && viaNext.status !== 503, `the web app's server can still reach the AI service (${viaNext.status})`);
  } else {
    console.log('[e2e] skipped: API-key checks (run through e2e/run.mjs to enable them)');
  }
}

await browser.close();
console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join('\n- ')}` : '\nALL CHECKS PASSED');
process.exit(problems.length ? 1 : 0);
