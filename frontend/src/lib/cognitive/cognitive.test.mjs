// Run with: npm test   (node --test)
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateEmotions, dominantEmotion, blendshapesToMap, EmotionLoadEstimator, EMOTIONS, W, MISSING_THRESHOLD,
} from './emotion.js';
import { PostureAnalyzer, LM, kalmanInit, kalmanUpdate } from './posture.js';
import { fuse, levelFor, LoadFusion } from './fusion.js';

// ---------------------------------------------------------------- emotion distribution
test('a relaxed face is neutral', () => {
  assert.equal(dominantEmotion(estimateEmotions({})), 'neutral');
});

test('probabilities sum to one', () => {
  const probs = estimateEmotions({ mouthSmileLeft: 0.7, mouthSmileRight: 0.6, browDownLeft: 0.2 });
  assert.ok(Math.abs(EMOTIONS.reduce((s, e) => s + probs[e], 0) - 1) < 1e-9);
});

test('smiling reads as happy, furrowed brows as angry', () => {
  assert.equal(dominantEmotion(estimateEmotions({ mouthSmileLeft: 0.8, mouthSmileRight: 0.8 })), 'happy');
  const angry = estimateEmotions({ browDownLeft: 0.9, browDownRight: 0.9, eyeSquintLeft: 0.6, eyeSquintRight: 0.6, mouthPressLeft: 0.5, mouthPressRight: 0.5 });
  assert.equal(dominantEmotion(angry), 'angry');
});

test('blendshapesToMap converts the MediaPipe category list', () => {
  assert.deepEqual(blendshapesToMap([{ categoryName: 'jawOpen', score: 0.4 }]), { jawOpen: 0.4 });
});

// ---------------------------------------------------------------- emotion load (MoodMatrix pipeline)
test('emotion weights are normalised so that sum |W| = 1', () => {
  assert.ok(Math.abs(EMOTIONS.reduce((s, e) => s + Math.abs(W[e]), 0) - 1) < 1e-12);
});

test('emotion load starts from the MoodMatrix prior and stays within 0-100', () => {
  const est = new EmotionLoadEstimator();
  const first = est.update(estimateEmotions({}));
  assert.ok(first >= 0 && first <= 100);
});

test('distressed expressions give a higher load than a smile', () => {
  const run = (bs) => { const est = new EmotionLoadEstimator(); let v; for (let i = 0; i < 80; i++) v = est.update(estimateEmotions(bs)); return v; };
  const sad = run({ mouthFrownLeft: 0.9, mouthFrownRight: 0.9, browInnerUp: 0.7 });
  const happy = run({ mouthSmileLeft: 0.9, mouthSmileRight: 0.9 });
  assert.ok(sad > happy, `sad ${sad} should exceed happy ${happy}`);
});

test('the load starts near the 0.5 prior and moves gradually towards a sustained expression', () => {
  const est = new EmotionLoadEstimator();
  const bs = { mouthFrownLeft: 1, mouthFrownRight: 1, browInnerUp: 1 };
  const first = est.update(estimateEmotions(bs));
  assert.ok(first > 40 && first < 60, `expected a value near the 50% prior, got ${first}`);
  let v;
  for (let i = 0; i < 60; i++) v = est.update(estimateEmotions(bs));
  assert.notEqual(v, first);
});

test('losing the face holds the value, then resets to 0 after MISSING_THRESHOLD frames', () => {
  const est = new EmotionLoadEstimator();
  let held;
  for (let i = 0; i < 60; i++) held = est.update(estimateEmotions({ mouthFrownLeft: 0.9, mouthFrownRight: 0.9 }));
  for (let i = 0; i < MISSING_THRESHOLD - 1; i++) assert.ok(est.update(null) > 0);
  assert.equal(est.update(null), 0);
  assert.ok(held > 0);
  assert.ok(est.update(estimateEmotions({})) < held, 'filter restarts from zero after a reset');
});

// ---------------------------------------------------------------- Kalman filter
test('kalman filter converges on a constant measurement', () => {
  let state = kalmanInit();
  let v;
  for (let i = 0; i < 100; i++) ({ state, value: v } = kalmanUpdate(state, 70));
  assert.ok(Math.abs(v - 70) < 1, `got ${v}`);
});

// ---------------------------------------------------------------- posture
function body({ lean = 0, wristNearNose = false, jitter = 0 } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  lm[LM.NOSE] = { x: 0.5, y: 0.3, visibility: 1 };
  lm[LM.L_SHOULDER] = { x: 0.4, y: 0.5, visibility: 1 };
  lm[LM.R_SHOULDER] = { x: 0.6, y: 0.5, visibility: 1 };
  lm[LM.L_HIP] = { x: 0.42 + lean, y: 0.9, visibility: 0.3 };
  lm[LM.R_HIP] = { x: 0.58 + lean, y: 0.9, visibility: 0.3 };
  lm[LM.L_WRIST] = wristNearNose ? { x: 0.47 + jitter, y: 0.32, visibility: 1 } : { x: 0.3 + jitter, y: 0.8, visibility: 1 };
  lm[LM.R_WRIST] = { x: 0.7 + jitter, y: 0.8, visibility: 1 };
  return lm;
}
const run = (analyzer, make, frames = 40) => { let r; for (let i = 0; i < frames; i++) r = analyzer.update(make(i)); return r; };

test('upright, still posture scores low and flags nothing', () => {
  const r = run(new PostureAnalyzer(), () => body());
  assert.ok(r.score < 60, `got ${r.score}`);
  assert.deepEqual(r.reasons, []);
  assert.ok(r.features.slouch < 0.1 && r.features.fidget === 0 && r.features.handNearHead < 0);
});

test('torso lean is reported as slouching and raises the score', () => {
  const upright = run(new PostureAnalyzer(), () => body());
  const lean = run(new PostureAnalyzer(), () => body({ lean: 0.15 }));
  assert.ok(lean.reasons.includes('Slouching'));
  assert.ok(lean.score > upright.score);
});

test('a hand near the nose is flagged', () => {
  const r = run(new PostureAnalyzer(), () => body({ wristNearNose: true }));
  assert.ok(r.features.handNearHead > 0.5);
  assert.ok(r.reasons.includes('Hand near head'));
});

test('fidgeting is wrist movement over time, not a single pose', () => {
  const moving = run(new PostureAnalyzer(), (i) => body({ jitter: i % 2 ? 0.05 : -0.05 }));
  assert.ok(moving.features.fidget > 0.5);
  assert.ok(moving.reasons.includes('Fidgeting'));
  assert.equal(run(new PostureAnalyzer(), () => body()).features.fidget, 0);
});

test('missing or hidden upper body yields no reading', () => {
  const a = new PostureAnalyzer();
  assert.equal(a.update(null), null);
  const hidden = body();
  hidden[LM.L_SHOULDER].visibility = 0.1;
  assert.equal(a.update(hidden), null);
});

test('posture score is exponentially smoothed: a sudden change shows up gradually', () => {
  const a = new PostureAnalyzer();
  run(a, () => body(), 30);
  const after = a.update(body({ lean: 0.2, wristNearNose: true }));
  assert.ok(after.score < 70);
});

// ---------------------------------------------------------------- fusion
test('equal weights by default', () => {
  assert.equal(fuse({ emotion: 80, posture: 60 }), 70);
});

test('high emotion with a calm body trusts the emotion signal (0.95 / 0.05)', () => {
  assert.ok(Math.abs(fuse({ emotion: 80, posture: 30 }) - (0.95 * 80 + 0.05 * 30)) < 1e-9);
  assert.equal(fuse({ emotion: 80, posture: 50 }), 65); // body not low enough: back to 0.5 / 0.5
});

test('a missing camera signal falls back to the other one; nothing at all gives null', () => {
  assert.equal(fuse({ emotion: 70 }), 70);
  assert.equal(fuse({ posture: 40 }), 40);
  assert.equal(fuse({}), null);
  assert.equal(fuse({ emotion: NaN }), null);
});

test('behaviour score is blended in only when present', () => {
  assert.equal(fuse({ emotion: 60, posture: 60, behavior: 10 }), 0.8 * 60 + 0.2 * 10);
  assert.equal(fuse({ behavior: 35 }), 35);
});

test('level is high from 52.5 upward and low below', () => {
  assert.equal(levelFor(52.5), 'high');
  assert.equal(levelFor(52.4), 'low');
});

test('LoadFusion rounds the score, reports a level and keeps the last reading when signals vanish', () => {
  const f = new LoadFusion();
  assert.deepEqual(f.update({}), { score: null, level: 'medium' });
  assert.deepEqual(f.update({ emotion: 70, posture: 60 }), { score: 65, level: 'high' });
  assert.deepEqual(f.update({}), { score: 65, level: 'high' });
  assert.deepEqual(f.update({ emotion: 20, posture: 20 }), { score: 20, level: 'low' });
});
