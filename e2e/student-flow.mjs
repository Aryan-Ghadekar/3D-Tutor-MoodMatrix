import { chromium } from 'playwright';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PPTX = path.resolve(process.env.LECTURE_PPTX || 'lecture.pptx');
const problems = [];
const log = (m) => console.log(`[e2e] ${m}`);
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log(`[FAIL] ${msg}`); } else log(`ok: ${msg}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => { problems.push(`pageerror: ${e.message}`); console.log(`[pageerror] ${e.message}`); });
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) { problems.push(`console.error: ${m.text()}`); console.log(`[console.error] ${m.text()}`); } });
page.on('response', (r) => { if (r.status() >= 500) { problems.push(`HTTP ${r.status()} ${r.url()}`); console.log(`[http ${r.status()}] ${r.url()}`); } });
page.on('dialog', async (d) => { problems.push(`alert: ${d.message()}`); console.log(`[alert] ${d.message()}`); await d.dismiss(); });

let lastQuiz = null;
await page.route('**/api/generate-quiz', async (route) => {
  const response = await route.fetch();
  const body = await response.json();
  lastQuiz = body.quiz;
  await route.fulfill({ response, json: body });
});

// The browser must never call the AI service directly (only Next.js does, with the server-side API key).
const directAiCalls = [];
page.on('request', (r) => { const u = r.url(); if (u.includes(':8001') && !u.includes('/classroom')) directAiCalls.push(u); });

const email = `e2e_${Date.now()}@example.com`;

// ---------- register ----------
await page.goto(`${BASE}/auth/register`);
await page.fill('input[name="name"]', 'E2E Student');
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', 'secret123');
await page.fill('input[name="confirmPassword"]', 'secret123');
await page.check('input[type="checkbox"]');
await page.click('button[type="submit"]');
await page.waitForURL(/\/auth\/login/, { timeout: 15000 });
check(true, 'registered and redirected to login');

// wrong password shows an error
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', 'wrongpass');
await page.click('button[type="submit"]');
await page.waitForSelector('form [role="alert"]', { timeout: 10000 });
check((await page.textContent('form [role="alert"]')).includes('Incorrect'), 'wrong password shows an error');

await page.fill('input[name="password"]', 'secret123');
await page.click('button[type="submit"]');
await page.waitForURL(/\/onboarding\/goal/, { timeout: 15000 });
check(true, 'login succeeded -> onboarding');

// ---------- goal ----------
await page.click('text=JEE Advanced');
await page.click('text=Start Studying');
await page.waitForURL(/\/lecture-input/, { timeout: 15000 });
check((await page.evaluate(() => localStorage.getItem('learning_goal'))) === 'jee', 'goal stored in localStorage');
const me = await (await page.request.get(`${BASE}/api/user/profile`)).json();
check(me.goal === 'jee' && me.user?.email === email, 'goal persisted on the server for the user');

// ---------- upload lecture ----------
await page.setInputFiles('input[type="file"]', PPTX);
await page.click('text=Generate Study Session');
await page.waitForURL(/\/knowledge-test/, { timeout: 120000 });
check(true, 'lecture analysed -> knowledge test');
const url = new URL(page.url());
const lectureSessionId = url.searchParams.get('sessionId');
check(!!lectureSessionId, 'knowledge test URL carries the lecture sessionId');

// ---------- knowledge test ----------
await page.waitForSelector('text=Question 1', { timeout: 60000 });
let guard = 0;
while (guard++ < 20) {
  const complete = page.locator('button:has-text("Complete Assessment")');
  if (await complete.count() && await complete.isEnabled()) break;
  // answer the visible question (first option) which auto-advances
  const option = page.locator('button:has(span), button').filter({ hasText: /^[A-D]/ }).first();
  const opts = page.locator('main button').filter({ hasText: /\S/ });
  // option buttons are the ones that call handleAnswer; click the first answer-looking button inside the question card
  await page.locator('main .space-y-3 button, main .grid button').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);
}
await page.click('button:has-text("Complete Assessment")');
await page.waitForURL(/\/study-session/, { timeout: 60000 });
check(true, 'knowledge test submitted -> study session');
const kl = await page.evaluate(() => localStorage.getItem('knowledge_level'));
check(['beginner', 'intermediate', 'advanced'].includes(kl), `knowledge level saved (${kl})`);
const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('quiz_results_all') || '[]'));
check(profile.length === 1 && profile[0].source === 'knowledge_test', 'knowledge test result stored in the student profile');

// ---------- study session ----------
await page.waitForSelector('text=AI slide', { timeout: 90000 });
check(true, 'first slide is AI generated');
const topicsText = await page.textContent('body');
check(/Topic 1\/\d+/.test(topicsText), 'topic counter visible');

// next slide goes to topic 2 with an AI slide for that topic
await page.click('button:has-text("Next Topic")');
await page.waitForSelector('text=Topic 2/', { timeout: 90000 });
await page.waitForFunction(() => !document.body.innerText.includes('Preparing the next topic'), null, { timeout: 90000 });
check((await page.textContent('body')).includes('AI slide'), 'topic 2 slide is AI generated (not the local template)');
const slideNo = await page.textContent('text=/of \\d+/');
log(`slide counter: ${slideNo}`);

// previous returns to topic 1
await page.click('button:has-text("Previous")');
await page.waitForSelector('text=Topic 1/', { timeout: 10000 });
check(true, 'previous slide returns to topic 1');

// explain more
await page.click('text=Explain More');
await page.waitForFunction(() => /Slide\s*\d+\s*of\s*3/.test(document.body.innerText), null, { timeout: 90000 });
check(true, 'explain-more appended a slide (no overwrite)');

// ask question
await page.click('text=Ask Questions');
await page.fill('input[placeholder="Type your question..."]', 'Why does balancing matter?');
await page.click('button:has-text("Ask")');
await page.waitForFunction(() => /Slide\s*\d+\s*of\s*4/.test(document.body.innerText), null, { timeout: 90000 });
check(true, 'ask-question appended a slide');
check(await page.locator('[role="dialog"]:has-text("Learning support")').count() === 0, 'two help requests do not trigger the overload popup');

// quiz: answer every question with the option the server marked correct
await page.click('text=Take Quiz');
await page.waitForSelector('text=Question 1 of', { timeout: 90000 });
check(lastQuiz && lastQuiz.questions.length > 0, `quiz generated (source: ${lastQuiz?.metadata?.source || lastQuiz?.metadata?.generationSource})`);
check(lastQuiz.difficulty === 'medium', `a student who is not struggling gets a medium quiz (got ${lastQuiz.difficulty})`);
const correctTexts = lastQuiz.questions.map(q => q.options.find(o => o.isCorrect).text);
for (let i = 0; i < correctTexts.length; i++) {
  await page.waitForSelector(`text=Question ${i + 1} of`, { timeout: 10000 });
  await page.locator('.space-y-3 > button', { hasText: correctTexts[i] }).first().click();
  await page.click('button:has-text("Submit Answer")');
  await page.click('button:has-text("Next Question"), button:has-text("See Results")');
}
await page.waitForSelector('text=Quiz Completed!', { timeout: 30000 });
const scoreText = await page.locator('.text-3xl', { hasText: /^\d+%$/ }).first().textContent();
check(scoreText.trim() === '100%', `answering every question correctly scores 100% (got ${scoreText.trim()})`);
await page.waitForFunction(() => /Slide\s*\d+\s*of\s*5/.test(document.body.innerText), null, { timeout: 90000 });
check(true, 'quiz-results slide appended after quiz');
await page.click('button:has-text("Continue Learning")');

// progress modal
await page.click('text=View Progress');
await page.waitForSelector('text=Learning Progress');
await page.click('button:has-text("Continue Learning")');

// navigate through to the end (the button is disabled while a slide is being generated)
let clicks = 0;
const nextButton = page.locator('button:has-text("Next Slide"), button:has-text("Next Topic"), button:has-text("Finish Lecture")').first();
while (clicks++ < 60) {
  if ((await page.textContent('body')).includes('AI slide: Summary')) break;
  await nextButton.click({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500);
}
await page.waitForTimeout(500);
check((await page.textContent('body')).includes('AI slide: Summary') || (await page.textContent('body')).includes('Lecture Complete'), 'reached the completion slide');
check(await page.locator('button:has-text("Finish Lecture"), button:has-text("Next Slide"), button:has-text("Next Topic")').first().isDisabled(), 'next button disabled on the completion slide');

// restart session wipes and reloads
await page.click('button[title="Restart Session"]');
await page.waitForSelector('text=AI slide', { timeout: 90000 });
check(/Slide\s*1\s*of\s*1/.test(await page.innerText('body')), 'restart created a fresh session with one slide');

check(directAiCalls.length === 0, `the browser never calls the AI service directly (${directAiCalls.length} direct calls)`);
await browser.close();
console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join('\n- ')}` : '\nALL CHECKS PASSED');
process.exit(problems.length ? 1 : 0);
