// AI offline scenario: FastAPI runs without an LLM, so every AI call fails and the app must fall back gracefully.
import { chromium } from 'playwright';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PPTX = path.resolve(process.env.LECTURE_PPTX || 'lecture.pptx');
const problems = [];
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log(`[FAIL] ${msg}`); } else console.log(`[e2e] ok: ${msg}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => { problems.push(`pageerror: ${e.message}`); console.log(`[pageerror] ${e.message}`); });
page.on('dialog', async (d) => { problems.push(`alert: ${d.message()}`); console.log(`[alert] ${d.message()}`); await d.dismiss(); });
await page.goto(`${BASE}/lecture-input`);
await page.setInputFiles('input[type="file"]', PPTX);
await page.click('text=Generate Study Session');
await page.waitForURL(/\/knowledge-test/, { timeout: 120000 });
await page.waitForSelector('text=Question 1', { timeout: 60000 });
check(true, 'lecture analysed without an LLM (extractive topics)');

let guard = 0;
while (guard++ < 20) {
  const complete = page.locator('button:has-text("Complete Assessment")');
  if (await complete.count() && await complete.isEnabled()) break;
  await page.locator('main .space-y-3 button, main .grid button').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);
}
await page.click('button:has-text("Complete Assessment")');
await page.waitForURL(/\/study-session/, { timeout: 60000 });

// local fallback slide (no "AI slide" marker, but real topic content)
await page.waitForSelector('text=Topic 1/', { timeout: 60000 });
const body = await page.innerText('body');
check(!/Learning Session Error/.test(body), 'study session starts with local slides when the AI is down');
check(/Binary|Hash|Graph|tree|search/i.test(body), 'slide shows the lecture content');

await page.click('text=Take Quiz');
await page.waitForSelector('text=Question 1 of', { timeout: 90000 });

// Answer the first option every time; the green marker after submitting shows the true answer, so we can work
// out the score we should see and compare it with what the quiz reports.
let total = 0;
let correct = 0;
const questionTexts = [];
for (let q = 1; q <= 10; q++) {
  if (await page.locator('text=Quiz Completed!').count()) break;
  await page.waitForSelector(`text=Question ${q} of`, { timeout: 15000 }).catch(() => {});
  questionTexts.push(await page.locator('h3').filter({ hasText: /\?|\./ }).last().innerText());
  const options = page.locator('.space-y-3 > button');
  await options.first().click();
  await page.click('button:has-text("Submit Answer")');
  total++;
  if ((await options.first().getAttribute('class')).includes('border-green-500')) correct++;
  await page.click('button:has-text("Next Question"), button:has-text("See Results")');
}
await page.waitForSelector('text=Quiz Completed!', { timeout: 30000 });
check(total >= 3, `the lecture-based fallback quiz has ${total} questions`);
const shown = (await page.locator('.text-3xl', { hasText: /^\d+%$/ }).first().textContent()).trim();
check(shown === `${Math.round((100 * correct) / total)}%`, `the reported score matches the answers (${correct}/${total} -> ${shown})`);
check(questionTexts.every((t) => /lecture|topic|statement/i.test(t)), 'fallback questions are built from the lecture, not generic templates');
await page.click('button:has-text("Continue Learning")');

await page.click('button:has-text("Next Topic"), button:has-text("Next Slide")');
await page.waitForSelector('text=Topic 2/', { timeout: 60000 });
check(true, 'moving to the next topic works with local content');

await browser.close();
console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join('\n- ')}` : '\nALL CHECKS PASSED');
process.exit(problems.length ? 1 : 0);
