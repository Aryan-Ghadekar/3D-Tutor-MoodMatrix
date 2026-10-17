// New features: live classroom (teacher + 2 students), RAG sources, avatar, notes, camera sensor.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:8001';
const PPTX = path.resolve(process.env.LECTURE_PPTX || 'lecture.pptx');
const problems = [];
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log(`[FAIL] ${msg}`); } else console.log(`[e2e] ok: ${msg}`); };

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

function watch(page, label) {
  page.on('pageerror', (e) => { problems.push(`${label} pageerror: ${e.message}`); console.log(`[${label} pageerror] ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|XNNPACK/.test(m.text())) { problems.push(`${label} console.error: ${m.text()}`); console.log(`[${label} console.error] ${m.text()}`); } });
  page.on('response', (r) => { if (r.status() >= 500) { problems.push(`${label} HTTP ${r.status()} ${r.url()}`); console.log(`[${label} http ${r.status()}] ${r.url()}`); } });
  page.on('dialog', async (d) => { problems.push(`${label} alert: ${d.message()}`); await d.dismiss(); });
}

let helpOfferSeen = false;

async function newPage(label, permissions = []) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions, acceptDownloads: true });
  const page = await context.newPage();
  watch(page, label);
  // The help offer is a modal that appears (by design) when a student struggles, for example after a poor quiz.
  // It may show up between any two test steps, so dismiss it wherever it blocks the page.
  await page.addLocatorHandler(page.locator('button:has-text("Continue without help")'), async (button) => {
    helpOfferSeen = true;
    await button.click();
  });
  return page;
}

const stamp = Date.now();

// =============================================================== teacher
const teacher = await newPage('teacher');
await teacher.goto(`${BASE}/auth/register`);
await teacher.click('button:has-text("Teacher")');
await teacher.fill('input[name="name"]', 'Ms Rao');
await teacher.fill('input[name="email"]', `teacher_${stamp}@example.com`);
await teacher.fill('input[name="specialization"]', 'Data Structures');
await teacher.fill('input[name="password"]', 'secret123');
await teacher.fill('input[name="confirmPassword"]', 'secret123');
await teacher.check('input[type="checkbox"]');
await teacher.click('button[type="submit"]');
await teacher.waitForURL(/\/auth\/login/, { timeout: 15000 });

await teacher.click('button:has-text("Teacher")');
await teacher.fill('input[name="email"]', `teacher_${stamp}@example.com`);
await teacher.fill('input[name="password"]', 'secret123');
await teacher.click('button[type="submit"]');
await teacher.waitForURL(/\/teacher/, { timeout: 15000 });
check(true, 'teacher login lands on the teacher dashboard');
await teacher.waitForSelector('text=Start a live class');
check(await teacher.locator('button:has-text("Start class")').isDisabled(), 'cannot start a class before uploading a lecture');

await teacher.goto(`${BASE}/lecture-input`);
await teacher.setInputFiles('input[type="file"]', PPTX);
await teacher.click('text=Generate Study Session');
await teacher.waitForURL(/\/teacher/, { timeout: 120000 });
check(true, 'after uploading, a teacher is taken to the dashboard (no knowledge test)');
await teacher.waitForSelector('[data-testid="setup-lecture"]');
await teacher.click('button:has-text("Start class")');
await teacher.waitForSelector('[data-testid="class-code"]');
const code = (await teacher.textContent('[data-testid="class-code"]')).trim();
check(/^[A-Z2-9]{6}$/.test(code), `class started with code ${code}`);

// a student cannot open the teacher dashboard
const outsider = await newPage('outsider');
await outsider.goto(`${BASE}/teacher`);
await outsider.waitForSelector('text=Teacher access only');
check(true, 'the dashboard is closed to non-teachers');
await outsider.context().close();

// =============================================================== students
async function joinAs(label, name) {
  const page = await newPage(label);
  await page.goto(`${BASE}/join`);
  await page.fill('#code', 'WRONG1');
  await page.fill('#name', name);
  await page.click('button:has-text("Join class")');
  await page.waitForSelector('form [role="alert"]');
  check((await page.textContent('form [role="alert"]')).includes('Class not found'), `${label}: a wrong code is rejected with a message`);
  await page.fill('#code', code.toLowerCase());
  await page.click('button:has-text("Join class")');
  await page.waitForURL(/\/study-session\?.*classroom=/, { timeout: 30000 });
  await page.waitForSelector('text=AI slide', { timeout: 90000 });
  return page;
}
const s1 = await joinAs('student1', 'Asha');
const s2 = await joinAs('student2', 'Ben');
check(true, 'both students joined and see an AI slide for the teacher\'s lecture');
await s1.waitForSelector('[data-testid="classroom-banner"]:has-text("Live class")');
check((await s1.textContent('[data-testid="classroom-banner"]')).includes(code), 'student sees the live-class banner');

await teacher.waitForFunction(() => document.querySelector('[data-testid="stat-active"]')?.textContent === '2', null, { timeout: 30000 });
check(true, 'teacher sees 2 active students');

// =============================================================== overload
const slideTotal = async (page) => Number(((await page.innerText('body')).match(/Slide\s*\d+\s*of\s*(\d+)/) || [])[1] || 0);
async function askQuestion(page, text) {
  const dlg = page.locator('button:has-text("Continue without help")');
  if (await dlg.count()) { helpOfferSeen = true; await dlg.click(); }
  const before = await slideTotal(page);
  await page.click('text=Ask Questions');
  await page.fill('input[placeholder="Type your question..."]', text);
  await page.click('button:has-text("Ask")');
  await page.waitForFunction((n) => { const m = document.body.innerText.match(/Slide\s*\d+\s*of\s*(\d+)/); return m && Number(m[1]) > n; }, before, { timeout: 90000 });
}
const dismissHelp = async (page) => {
  const btn = page.locator('button:has-text("Continue without help")');
  if (await btn.count()) await btn.click();
};

await askQuestion(s1, 'How are hash collisions resolved?');
check(await s1.locator('[data-testid="slide-sources"]').count() === 1, 'retrieval: an answer shows the lecture passages it was based on');
const sourceText = await s1.locator('[data-testid="slide-sources"]').textContent();
check(/collision|hash/i.test(sourceText), 'the retrieved passage is about hash tables / collisions');

await askQuestion(s1, 'Why does the load factor matter?');
await askQuestion(s1, 'What is chaining exactly?');
await s1.waitForSelector('[role="dialog"]:has-text("Learning support")', { timeout: 20000 }).catch(() => {});
check(helpOfferSeen || await s1.locator('[role="dialog"]:has-text("Learning support")').count() > 0, 'repeated help requests trigger the help offer');
await dismissHelp(s1);

await teacher.waitForSelector('[data-testid="overload-alert"]', { timeout: 30000 });
check(true, 'teacher gets an overload alert when half the class is struggling');
check((await teacher.textContent('[data-testid="level-high"]')).trim() === '1', 'dashboard shows exactly one student in high load');
check(await teacher.locator('[data-testid="class-level"]').innerText() !== '', 'class level is shown');

// =============================================================== topic sync
await teacher.click('[data-testid="topic-2"]');
await s2.waitForFunction(() => /Topic\s*3\//.test(document.body.innerText), null, { timeout: 60000 });
check(true, 'students follow the topic the teacher selects');

// =============================================================== pause + quiz (with live audio context)
const token = JSON.parse(await teacher.evaluate(() => localStorage.getItem('classroom_teacher'))).token;
await teacher.request.post(`${API}/classroom/${code}/transcript`, { headers: { 'X-Teacher-Token': token }, data: { text: 'so remember that double hashing uses a second hash function' } });
await teacher.waitForSelector('[data-testid="transcript"]', { timeout: 10000 });
check((await teacher.textContent('[data-testid="transcript"]')).includes('double hashing'), 'teacher dashboard shows the captured lecture audio');

const quizRequests = [];
s2.on('request', (r) => { if (r.url().includes('/api/generate-quiz')) quizRequests.push(r.postDataJSON()); });
await teacher.waitForTimeout(3500); // let the transcript reach the students' next heartbeat
await teacher.click('[data-testid="btn-pause-quiz"]');
await s2.waitForSelector('text=Question 1 of', { timeout: 90000 });
check(true, 'pausing for a quiz opens the quiz on the student\'s screen');
check(quizRequests.length === 1 && /double hashing/.test(quizRequests[0].recentContext || ''), 'the quiz request carries what the teacher just said');
check(await s2.locator('[data-testid="classroom-banner"]:has-text("paused")').count() === 1, 'student sees the class is paused');
check(await s2.locator('button:has-text("Next Slide"), button:has-text("Next Topic")').first().isDisabled(), 'navigation is locked while paused');

// answer every question (first option each time; the score only has to match what the teacher sees)
for (let q = 1; q <= 20; q++) {
  if (await s2.locator('text=Quiz Completed!').count()) break;
  await s2.waitForSelector(`text=Question ${q} of`, { timeout: 15000 }).catch(() => {});
  await s2.locator('.space-y-3 > button').first().click();
  await s2.click('button:has-text("Submit Answer")');
  await s2.click('button:has-text("Next Question"), button:has-text("See Results")');
}
await s2.waitForSelector('text=Quiz Completed!', { timeout: 30000 });
const s2Score = Number((await s2.locator('.text-3xl', { hasText: /^\d+%$/ }).first().textContent()).replace('%', ''));
await teacher.waitForFunction(() => /^\d+%$/.test(document.querySelector('[data-testid="stat-quiz"]')?.textContent || ''), null, { timeout: 20000 });
const teacherSeen = Number((await teacher.textContent('[data-testid="stat-quiz"]')).replace('%', ''));
check(Math.abs(teacherSeen - s2Score) <= 1, `the pause-quiz score reaches the teacher (student ${s2Score}%, teacher ${teacherSeen}%)`);

await teacher.click('[data-testid="btn-resume"]');
await s2.waitForFunction(() => !/paused by your teacher/.test(document.body.innerText), null, { timeout: 20000 });
check(true, 'resuming unlocks the students');
await s2.click('button:has-text("Continue Learning")').catch(() => {});

// =============================================================== pause + avatar
await teacher.click('[data-testid="btn-pause-avatar"]');
await s1.waitForSelector('[data-testid="avatar-panel"]', { timeout: 30000 });
check(true, 'pausing for the avatar opens the avatar on the student\'s screen');
await s1.waitForFunction(() => /Explaining/.test(document.querySelector('[data-testid="avatar-status"]')?.textContent || ''), null, { timeout: 90000 });
check(true, 'the avatar starts explaining the simplified slide');
check(await s1.locator('[data-testid="avatar-canvas"], [data-testid="avatar-fallback"]').count() === 1, '3D avatar canvas is rendered');
const caption = await s1.textContent('[data-testid="avatar-caption"]');
check(caption.trim().length > 10, 'captions show what the avatar is saying');
await s1.click('[data-testid="avatar-stop"]');
await s1.waitForFunction(() => /Ready/.test(document.querySelector('[data-testid="avatar-status"]')?.textContent || ''), null, { timeout: 5000 });
check(true, 'the avatar can be stopped');
await s1.click('[data-testid="avatar-speak"]');
await s1.waitForFunction(() => /Explaining/.test(document.querySelector('[data-testid="avatar-status"]')?.textContent || ''), null, { timeout: 10000 });
check(true, 'the avatar explains the current slide on request');
await s1.click('[data-testid="avatar-stop"]');
await teacher.click('[data-testid="btn-resume"]');

// =============================================================== camera sensor (fake camera)
await s2.click('[data-testid="btn-camera"]');
await s2.waitForSelector('[data-testid="sensor-panel"]');
check(await s2.locator('text=never uploaded').count() === 1, 'the camera panel explains privacy before asking');
await s2.context().grantPermissions(['camera']);
await s2.click('[data-testid="sensor-enable"]');
const sensorState = await Promise.race([
  s2.waitForFunction(() => /\d+% (low|medium|high)/.test(document.querySelector('[data-testid="sensor-level"]')?.textContent || ''), null, { timeout: 120000 }).then(() => 'reading'),
  s2.waitForSelector('[data-testid="sensor-error"]', { timeout: 120000 }).then(async () => `error: ${await s2.textContent('[data-testid="sensor-error"]')}`),
]);
check(sensorState === 'reading', `camera load tracking produces a reading (${sensorState})`);
if (sensorState === 'reading') {
  const details = await s2.textContent('[data-testid="sensor-details"]');
  check(/no face in view/.test(details), 'a synthetic test video has no face, and the panel says so');
  check(await s2.locator('[data-testid="sensor-video"]').count() === 1, 'live preview is shown');
  await s2.click('[data-testid="sensor-disable"]');
  await s2.waitForSelector('[data-testid="sensor-enable"]');
  check(true, 'the camera can be turned off again');
}

// =============================================================== notes
await s2.click('[data-testid="btn-notes"]');
const [download] = await Promise.all([s2.waitForEvent('download'), s2.click('[data-testid="notes-md"]')]);
const notes = fs.readFileSync(await download.path(), 'utf8');
check(/^# .* - Study Notes/.test(notes), `notes download as Markdown (${download.suggestedFilename()})`);
check(/## Session summary/.test(notes) && /Quizzes taken: 1/.test(notes), 'notes include the session summary and the quiz');
check(/### Quiz: \d+%/.test(notes), 'notes include the quiz review');
check(/## \d+\. /.test(notes), 'notes include per-topic sections');

// =============================================================== teacher report + end
const [report] = await Promise.all([teacher.waitForEvent('download'), teacher.click('button:has-text("Report")')]);
const reportText = fs.readFileSync(await report.path(), 'utf8');
check(reportText.includes(`Code ${code}`) && /Students joined: 2/.test(reportText) && /Pause 1: /.test(reportText), 'class report contains attendance, load and quiz results');
check(/Paused for a quick quiz/.test(reportText) && /Moved to topic 3/.test(reportText), 'class report contains the timeline');

teacher.removeAllListeners('dialog');
teacher.on('dialog', (d) => d.accept());
const [endDownload] = await Promise.all([teacher.waitForEvent('download'), teacher.click('button:has-text("End class")')]);
check(!!endDownload, 'ending the class downloads the final report');
await s1.waitForFunction(() => /class has ended/.test(document.body.innerText), null, { timeout: 15000 });
check(true, 'students are told the class has ended');

await browser.close();
console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join('\n- ')}` : '\nALL CHECKS PASSED');
process.exit(problems.length ? 1 : 0);
