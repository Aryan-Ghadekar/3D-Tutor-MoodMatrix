import test from 'node:test';
import assert from 'node:assert/strict';
import {
  statementsFrom, relevantStatements, buildLocalQuiz, conceptSlide, explainMoreSlide, questionSlide,
  quizResultsSlide, simplifiedSlide, completionSlide,
} from './offlineContent.js';

// A lecture that is deliberately NOT about computer science.
const topics = [
  { id: 'topic-1', title: 'Photosynthesis', description: 'Plants convert sunlight into chemical energy using chlorophyll. The process takes place in the chloroplasts of leaf cells.', full_content: 'Light reactions happen in the thylakoid membranes. The Calvin cycle fixes carbon dioxide into sugars.', keyInsights: [], commonMisconceptions: ['Plants get their mass from soil'], importance: 'high', weightage: 80 },
  { id: 'topic-2', title: 'Cellular Respiration', description: 'Cells release stored energy from glucose through respiration. Mitochondria produce most of the ATP in a cell.', full_content: '', keyInsights: ['Glycolysis splits glucose in the cytoplasm'], commonMisconceptions: [] },
  { id: 'topic-3', title: 'Mendelian Genetics', description: 'Traits are inherited through genes passed from both parents. Dominant alleles mask recessive alleles in heterozygous offspring.', full_content: '', keyInsights: [] },
];

const seeded = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

test('statements come from the lecture text and key insights, de-duplicated', () => {
  const s = statementsFrom({ keyInsights: ['A key insight that is long enough.'], description: 'First sentence is long enough to count. First sentence is long enough to count. Short.' });
  assert.deepEqual(s, ['A key insight that is long enough.', 'First sentence is long enough to count.']);
  assert.deepEqual(statementsFrom({}), []);
});

test('relevantStatements ranks lecture passages by shared words and names their topic', () => {
  const found = relevantStatements('What does glycolysis do?', topics);
  assert.ok(found.length >= 1);
  assert.equal(found[0].topic, 'Cellular Respiration');
  assert.match(found[0].text, /Glycolysis/);
  assert.deepEqual(relevantStatements('zzz qqq', topics), []);
  assert.deepEqual(relevantStatements('the and of', topics), []);
});

test('local quiz: well-formed questions built only from the lecture, in any subject', () => {
  const quiz = buildLocalQuiz({ topic: topics[0], topics, difficulty: 'easy', goal: 'neet', random: seeded });
  assert.ok(quiz.questions.length >= 3);
  assert.equal(quiz.title, 'NEET Quiz: Photosynthesis');
  for (const q of quiz.questions) {
    assert.ok(q.options.length >= 3 && q.options.length <= 4);
    assert.equal(q.options.filter((o) => o.isCorrect).length, 1);
    assert.equal(new Set(q.options.map((o) => o.text)).size, q.options.length, 'options must be distinct');
    assert.ok(q.explanation);
  }
  const text = JSON.stringify(quiz);
  assert.ok(!/deadlock|semaphore|virtual memory|operating system/i.test(text));
});

test('true-statement questions use statements from other topics as distractors; topic questions use titles', () => {
  const quiz = buildLocalQuiz({ topic: topics[0], topics, random: seeded });
  const statementQ = quiz.questions.find((q) => q.type === 'conceptual');
  const wrong = statementQ.options.filter((o) => !o.isCorrect).map((o) => o.text);
  assert.ok(wrong.some((w) => /mitochondria|glycolysis|alleles/i.test(w)));
  const topicQ = quiz.questions.find((q) => q.type === 'application');
  assert.ok(topicQ.options.some((o) => o.isCorrect && o.text === 'Photosynthesis'));
  assert.ok(topicQ.options.filter((o) => !o.isCorrect).every((o) => ['Cellular Respiration', 'Mendelian Genetics'].includes(o.text)));
});

test('a one-topic lecture still gets statement questions (with generic distractors) but no topic-matching ones', () => {
  const quiz = buildLocalQuiz({ topic: topics[0], topics: [topics[0]], random: seeded });
  assert.ok(quiz.questions.length >= 1);
  assert.ok(quiz.questions.every((q) => q.type === 'conceptual' && q.options.length === 4));
});

test('no text means no quiz', () => {
  assert.equal(buildLocalQuiz({ topic: { id: 'x', title: 'Empty' }, topics: [] }), null);
});

test('offline slides are subject-neutral and use the lecture content', () => {
  const concept = conceptSlide(topics[0], 'neet');
  assert.equal(concept.title, 'Photosynthesis');
  assert.match(concept.narrative, /chlorophyll/);
  assert.match(concept.narrative, /AI tutor is unavailable/);
  assert.deepEqual(concept.analogies, []);
  assert.equal(concept.realWorldScenario, null);
  assert.deepEqual(concept.commonTraps, ['Plants get their mass from soil']);

  const more = explainMoreSlide(topics[0]);
  assert.match(more.narrative, /Calvin cycle/);

  const all = JSON.stringify([concept, more, quizResultsSlide(topics[0], 'Quiz score: 40%'), simplifiedSlide(topics[0], 'it is about light'), completionSlide({ topics, completed: 1, averageScore: 70, goal: 'neet' })]);
  assert.ok(!/deadlock|semaphore|traffic|warehouse|building construction/i.test(all));
});

test('question slide answers from the lecture, or says it could not find anything', () => {
  const hit = questionSlide(topics[1], 'What does the mitochondria do?', topics);
  assert.ok(hit.keyInsights.some((k) => /Mitochondria produce most of the ATP/.test(k) && /Cellular Respiration/.test(k)));
  const miss = questionSlide(topics[1], 'Explain quantum chromodynamics', topics);
  assert.deepEqual(miss.keyInsights, []);
  assert.match(miss.narrative, /could not find/);
});

test('simplified and completion slides', () => {
  const simple = simplifiedSlide(topics[0], 'so light is the energy source');
  assert.match(simple.narrative, /The teacher just said/);
  assert.ok(simple.keyInsights.length <= 3);
  const done = completionSlide({ topics, completed: 2, averageScore: 80, goal: 'jee' });
  assert.match(done.narrative, /all 3 topics.*mastered 2.*80%/);
  assert.equal(done.keyInsights.length, 3);
  assert.match(done.examRelevance, /JEE/);
});
