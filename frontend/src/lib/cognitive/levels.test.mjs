import test from 'node:test';
import assert from 'node:assert/strict';
import { behaviorLevel, sessionLevel, quizDifficultyFor, behaviorScore } from './levels.js';

test('a student who is just reading is medium load, not low', () => {
  const s = behaviorScore();
  assert.equal(s, 35);
  assert.equal(behaviorLevel(s), 'medium');
  assert.equal(quizDifficultyFor(behaviorLevel(s)), 'medium');
});

test('help requests raise the load gradually: two requests are still medium, three are high', () => {
  assert.equal(behaviorLevel(behaviorScore({ recentStruggles: 1 })), 'medium');
  assert.equal(behaviorLevel(behaviorScore({ recentStruggles: 2 })), 'medium');
  assert.equal(behaviorLevel(behaviorScore({ recentStruggles: 3 })), 'high');
  assert.equal(behaviorScore({ recentStruggles: 99 }), 83);
});

test('quiz results move the score: a poor quiz means high, a great quiz means low', () => {
  assert.equal(behaviorLevel(behaviorScore({ lastQuizScore: 30 })), 'high');
  assert.equal(behaviorLevel(behaviorScore({ lastQuizScore: 70 })), 'medium');
  assert.equal(behaviorLevel(behaviorScore({ lastQuizScore: 90 })), 'low');
  assert.equal(behaviorLevel(behaviorScore({ lastQuizScore: 90, recentStruggles: 2 })), 'medium');
});

test('behaviour score stays within 5-95', () => {
  assert.equal(behaviorScore({ recentStruggles: 4, lastQuizScore: 10 }), 95);
  assert.equal(behaviorScore({ lastQuizScore: 100 }), 20);
});

test('camera on: high only when the camera pipeline says high; a calm reading is medium, not low', () => {
  assert.deepEqual(sessionLevel({ external: { score: 36, level: 'low' }, behavior: 35 }), { score: 36, level: 'medium', source: 'camera' });
  assert.equal(sessionLevel({ external: { score: 53, level: 'high' }, behavior: 35 }).level, 'high');
  assert.equal(sessionLevel({ external: { score: 52, level: 'low' }, behavior: 35 }).level, 'medium');
  assert.equal(sessionLevel({ external: { score: 25, level: 'low' }, behavior: 35 }).level, 'low');
});

test('camera off: the behaviour score decides', () => {
  assert.deepEqual(sessionLevel({ external: null, behavior: 59 }), { score: 59, level: 'medium', source: 'behavior' });
  assert.equal(sessionLevel({ external: null, behavior: 71 }).level, 'high');
});

test('quiz difficulty follows the level', () => {
  assert.equal(quizDifficultyFor('high'), 'easy');
  assert.equal(quizDifficultyFor('medium'), 'medium');
  assert.equal(quizDifficultyFor('low'), 'hard');
});
