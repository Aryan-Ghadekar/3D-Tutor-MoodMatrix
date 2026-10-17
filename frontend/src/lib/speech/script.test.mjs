import test from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoChunks, buildSpokenScript, estimateSpeechMs } from './script.js';

const CONTENT = {
  title: 'Hash Tables',
  narrative: 'A hash table maps keys to buckets. It gives fast lookups.',
  keyInsights: ['Collisions are unavoidable', 'Chaining stores colliding keys together'],
  analogies: [{ comparison: 'Like a coat check with numbered hooks', lesson: 'The number tells you where to look.' }],
  realWorldScenario: { situation: 'A web server caching sessions', application: 'x', outcome: 'Lookups stay fast.' },
  memoryHook: 'Hash, bucket, chain',
};

test('splitIntoChunks keeps sentences together up to the limit', () => {
  const chunks = splitIntoChunks('One short sentence. Another one here. And a third sentence follows.', 40);
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((c) => c.length <= 40));
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), 'One short sentence. Another one here. And a third sentence follows.');
});

test('splitIntoChunks breaks a run-on sentence', () => {
  const text = 'This is a very long sentence, with many clauses, that keeps going on and on without any full stop at all, so it must be cut';
  const chunks = splitIntoChunks(text, 50);
  assert.ok(chunks.length > 2);
  assert.ok(chunks.every((c) => c.length <= 52));
});

test('splitIntoChunks handles empty input and strips markdown characters', () => {
  assert.deepEqual(splitIntoChunks(''), []);
  assert.deepEqual(splitIntoChunks(null), []);
  assert.deepEqual(splitIntoChunks('**Bold** idea.'), ['Bold idea.']);
});

test('full script covers narrative, key points, analogy, example and memory hook', () => {
  const script = buildSpokenScript(CONTENT);
  for (const expected of ['Hash Tables.', 'maps keys to buckets', 'Point 1: Collisions are unavoidable.', 'Think of it like this', 'coat check', 'For example, a web server caching sessions', 'To remember this: Hash, bucket, chain.']) {
    assert.ok(script.includes(expected), `missing: ${expected}`);
  }
});

test('simple script is shorter and restates the key idea', () => {
  const full = buildSpokenScript(CONTENT);
  const simple = buildSpokenScript(CONTENT, { style: 'simple' });
  assert.ok(simple.length < full.length);
  assert.ok(simple.includes('For example, a web server caching sessions'));
  assert.ok(simple.includes('In other words, collisions are unavoidable.'));
  assert.ok(!simple.includes('Point 1'));
});

test('script tolerates missing fields', () => {
  assert.equal(buildSpokenScript(null), '');
  assert.equal(buildSpokenScript({ narrative: 'Just this' }), 'Just this.');
});

test('estimateSpeechMs scales with length and rate', () => {
  const text = 'word '.repeat(150);
  assert.equal(estimateSpeechMs(text, 1), 60000);
  assert.equal(estimateSpeechMs(text, 2), 30000);
  assert.equal(estimateSpeechMs('hi'), 600);
});
