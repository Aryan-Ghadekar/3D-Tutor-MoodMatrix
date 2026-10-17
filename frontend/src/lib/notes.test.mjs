import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotes, buildClassReport, markdownToHtml, safeFilename } from './notes.js';

const content = (title) => ({
  title,
  narrative: `${title} explained in a sentence.`,
  keyInsights: ['Point A', 'Point B'],
  analogies: [{ comparison: 'Like a library', lesson: 'Order helps.' }],
  realWorldScenario: { situation: 'A web cache', application: 'Use it.', outcome: 'Faster.' },
  examRelevance: 'Frequently tested.',
  commonTraps: ['Trap 1'],
  memoryHook: 'Hook!',
});

const topics = [{ title: 'Hash Tables' }, { title: 'Trees' }, { title: 'Graphs' }];
const slides = [
  { type: 'concept_explanation', content: content('Hash Tables'), metadata: { topicIndex: 0 } },
  { type: 'ask-question', content: content('Q'), metadata: { topicIndex: 0, context: 'Why chaining?' } },
  { type: 'explain-more', content: content('Deep'), metadata: { topicIndex: 0 } },
  { type: 'concept_explanation', content: content('Trees'), metadata: { topicIndex: 1 } },
  { type: 'quiz-results', content: content('Quiz'), metadata: { topicIndex: 1 } },
];
const quizReviews = [{
  topicIndex: 1, topicTitle: 'Trees', score: 50,
  items: [
    { question: 'What is a BST?', correct: true, yourAnswer: 'x', correctAnswer: 'x' },
    { question: 'Balanced height?', correct: false, yourAnswer: 'O(n)', correctAnswer: 'O(log n)', explanation: 'Balance keeps height small.' },
  ],
}];

test('notes contain every studied topic with its content, and skip topics never opened', () => {
  const md = buildNotes({ lectureTitle: 'Data Structures', goal: 'gate', knowledgeLevel: 'beginner', topics, slides, quizReviews, date: '2026-01-02' });
  assert.match(md, /^# Data Structures - Study Notes/);
  assert.match(md, /Goal: GATE \| Level: beginner/);
  assert.match(md, /- Topics studied: 2 of 3/);
  assert.match(md, /## 1\. Hash Tables/);
  assert.match(md, /## 2\. Trees/);
  assert.ok(!md.includes('Graphs'));
  assert.match(md, /\*\*Key points\*\*\n- Point A\n- Point B/);
  assert.match(md, /### Your question\n\n> Why chaining\?/);
  assert.match(md, /### Deeper explanation/);
  assert.ok(!md.includes('### Quiz review'), 'the AI quiz-review slide is replaced by the structured quiz section');
});

test('quiz review lists missed questions with the correct answer and flags the weak topic', () => {
  const md = buildNotes({ topics, slides, quizReviews });
  assert.match(md, /### Quiz: 50%/);
  assert.match(md, /\[correct\] What is a BST\?/);
  assert.match(md, /\[missed\] Balanced height\?\n {2}- Your answer: O\(n\)\n {2}- Correct answer: O\(log n\)\n {2}- Why: Balance keeps height small\./);
  assert.match(md, /## Areas to revisit/);
  assert.match(md, /Review \*\*Trees\*\*/);
});

test('notes for an empty session still render', () => {
  const md = buildNotes({ topics, slides: [] });
  assert.match(md, /Topics studied: 0 of 3/);
  assert.ok(!md.includes('Areas to revisit'));
});

test('markdownToHtml renders structure and escapes HTML', () => {
  const html = markdownToHtml('# T <b>\n\n## Sec\n\n- one **bold**\n  - nested\n- two\n\n> quote\n\ntext & more', 'My <Notes>');
  assert.match(html, /<title>My &lt;Notes&gt;<\/title>/);
  assert.match(html, /<h1>T &lt;b&gt;<\/h1>/);
  assert.match(html, /<li>one <strong>bold<\/strong>/);
  assert.match(html, /<ul>\n<li>nested<\/li>/);
  assert.equal((html.match(/<li>/g) || []).length, (html.match(/<\/li>/g) || []).length);
  assert.match(html, /<blockquote>quote<\/blockquote>/);
  assert.match(html, /<p>text &amp; more<\/p>/);
  assert.equal((html.match(/<ul>/g) || []).length, (html.match(/<\/ul>/g) || []).length);
});

test('class report summarises load, quizzes and the timeline', () => {
  const t0 = 1_700_000_000;
  const md = buildClassReport({
    lectureTopic: 'Data Structures',
    startedAt: t0,
    state: { code: 'ABC234' },
    aggregate: { joined: 12 },
    topics: ['Hash Tables', 'Trees'],
    history: [
      { t: t0 + 60, averageLoad: 40, active: 10, high: 1 },
      { t: t0 + 120, averageLoad: 78, active: 10, high: 6 },
      { t: t0 + 180, averageLoad: 50, active: 10, high: 2 },
    ],
    quizResults: { 1: { responses: 9, averageScore: 72.5 } },
    events: [
      { t: t0, kind: 'class_started' },
      { t: t0 + 1, kind: 'student_joined' },
      { t: t0 + 90, kind: 'topic_changed', topicIndex: 1 },
      { t: t0 + 130, kind: 'paused', mode: 'quiz' },
      { t: t0 + 400, kind: 'class_ended' },
    ],
    recentTranscript: 'and that is why we balance',
  });
  assert.match(md, /Code ABC234/);
  assert.match(md, /Students joined: 12/);
  assert.match(md, /Average class load: 56\/100/);
  assert.match(md, /Peak average load: 78\/100/);
  assert.match(md, /6 of 10 students in high load/);
  assert.match(md, /Pause 1: 9 responses, average 73%/);
  assert.match(md, /Moved to topic 2: Trees/);
  assert.match(md, /Paused for a quick quiz/);
  assert.ok(!md.includes('A student joined'));
  assert.match(md, /> and that is why we balance/);
});

test('class report tolerates a class with no data', () => {
  const md = buildClassReport({ startedAt: 1_700_000_000, state: { code: 'X' }, aggregate: {}, history: [], events: [] });
  assert.match(md, /No cognitive-load data was reported/);
});

test('safeFilename', () => {
  assert.equal(safeFilename('Data Structures: Trees & Graphs!'), 'data-structures-trees-graphs');
  assert.equal(safeFilename(''), 'notes');
});
