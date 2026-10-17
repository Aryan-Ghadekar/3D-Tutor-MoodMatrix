// Starts the whole stack with a mock LLM, runs the browser scenarios and shuts everything down.
//
//   cd e2e && npm install && npx playwright install chromium
//   node run.mjs                    # all scenarios against a production build
//   node run.mjs auth student       # only some scenarios
//   node run.mjs --dev              # use `next dev` instead of a production build
//
// Needs: Python with backend/fastapi-service/requirements.txt (or at least fastapi, uvicorn, pdfplumber,
// python-pptx, python-multipart, requests) and `npm install` done in frontend/. Set PYTHON to choose the
// interpreter. The scenarios never call the real OpenRouter API.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const isWin = process.platform === 'win32';
const args = process.argv.slice(2);
const dev = args.includes('--dev');
const wanted = args.filter((a) => !a.startsWith('--'));

const SCENARIOS = {
  auth:      { file: 'auth-flow.mjs',      llm: true,  env: { API_TOKEN_EXPECTED: '1' } },
  student:   { file: 'student-flow.mjs',   llm: true },
  classroom: { file: 'classroom-flow.mjs', llm: true },
  offline:   { file: 'offline-flow.mjs',   llm: false },   // FastAPI runs without any LLM
};
const selected = (wanted.length ? wanted : Object.keys(SCENARIOS)).map((n) => {
  if (!SCENARIOS[n]) throw new Error(`Unknown scenario "${n}". Choose from: ${Object.keys(SCENARIOS).join(', ')}`);
  return [n, SCENARIOS[n]];
});

const ports = { llm: 9100, api: 8001, web: 3000 };
const API_TOKEN = 'e2e-api-token';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'moodmatrix-e2e-'));
const children = new Set();

function start(name, cmd, cmdArgs, options) {
  const out = fs.openSync(path.join(tmp, `${name}.log`), 'a');
  const child = spawn(cmd, cmdArgs, { stdio: ['ignore', out, out], shell: isWin, ...options });
  children.add(child);
  child.on('exit', () => children.delete(child));
  return child;
}

function killAll() {
  for (const child of children) {
    try {
      if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      else child.kill('SIGTERM');
    } catch { /* already gone */ }
  }
  children.clear();
}
process.on('exit', killAll);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { killAll(); process.exit(130); });

async function waitFor(url, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not start (see logs in ${tmp})`);
}

async function stopApi(child) {
  if (!child) return;
  if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  else child.kill('SIGTERM');
  children.delete(child);
  await new Promise((r) => setTimeout(r, 1000));
}

function startApi(withLlm) {
  const env = {
    ...process.env,
    DATA_DIR: path.join(tmp, `data-${Date.now()}`),
    API_TOKEN,
    OPENROUTER_API_KEY: withLlm ? 'test-key' : '',
    OPENROUTER_URL: `http://127.0.0.1:${ports.llm}/v1/chat`,
  };
  return start('fastapi', PYTHON, ['-m', 'uvicorn', 'main:app', '--port', String(ports.api)], { cwd: path.join(root, 'backend', 'fastapi-service'), env });
}

// -------------------------------------------------------------------------------------------------- setup
console.log(`[run] logs and temp data: ${tmp}`);

const pptx = path.join(tmp, 'lecture.pptx');
const made = spawnSync(PYTHON, [path.join(here, 'make_pptx.py'), pptx], { stdio: 'inherit' });
if (made.status !== 0) throw new Error('Could not create the sample lecture (is python-pptx installed?)');

start('mock-llm', PYTHON, [path.join(here, 'mock_llm.py')], { cwd: here });

const frontend = path.join(root, 'frontend');
if (!dev && !fs.existsSync(path.join(frontend, '.next', 'BUILD_ID'))) {
  console.log('[run] building the frontend...');
  const build = spawnSync('npx', ['next', 'build'], { cwd: frontend, stdio: 'inherit', shell: isWin });
  if (build.status !== 0) throw new Error('Frontend build failed');
}

fs.rmSync(path.join(frontend, '.data'), { recursive: true, force: true });
start('web', 'npx', ['next', dev ? 'dev' : 'start', '-p', String(ports.web)], {
  cwd: frontend,
  env: { ...process.env, SESSION_SECRET: 'e2e-session-secret', BACKEND_API_TOKEN: API_TOKEN, BACKEND_URL: `http://localhost:${ports.api}` },
});

let api = null;
let apiHasLlm = null;
let failed = 0;

try {
  await waitFor(`http://127.0.0.1:${ports.llm}/`, 'mock LLM').catch(() => {});   // answers POST only; any reply = up
  for (const [name, scenario] of selected) {
    if (apiHasLlm !== scenario.llm) {
      await stopApi(api);
      api = startApi(scenario.llm);
      apiHasLlm = scenario.llm;
      await waitFor(`http://localhost:${ports.api}/health`, 'FastAPI service');
    }
    await waitFor(`http://localhost:${ports.web}/`, 'web app');

    console.log(`\n[run] ===== ${name} =====`);
    const result = spawnSync('node', [path.join(here, scenario.file)], {
      cwd: here,
      stdio: 'inherit',
      env: { ...process.env, BASE_URL: `http://localhost:${ports.web}`, API_URL: `http://localhost:${ports.api}`, LECTURE_PPTX: pptx, ...(scenario.env || {}) },
    });
    if (result.status !== 0) failed++;
  }
} finally {
  killAll();
}

console.log(failed ? `\n[run] ${failed} scenario(s) FAILED. Logs: ${tmp}` : '\n[run] ALL SCENARIOS PASSED');
if (!failed) fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
