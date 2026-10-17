// Run with: npm test   (node --test)
import test from 'node:test';
import assert from 'node:assert/strict';

import { estimateEmotions, dominantEmotion, emotionLoad, blendshapesToMap, EMOTIONS } from './emotion.js';
import { PostureAnalyzer, LM } from './posture.js';
import { fuse, levelFor, LoadFusion } from './fusion.js';

// ---------------------------------------------------------------- emotion
test('a relaxed face is neutral and low load', () => {
  const probs = estimateEmotions({});
  assert.equal(dominantEmotion(probs), 'neutral');
  assert.ok(emotionLoad(probs) <= 25);
});

test('probabilities sum to one', () => {
  const probs = estimateEmotions({ mouthSmileLeft: 0.7, mouthSmileRight: 0.6, browDownLeft: 0.2 });
  const sum = EMOTIONS.reduce((s, e) => s + probs[e], 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test('smiling reads as happy with very low load', () => {
  const probs = estimateEmotions({ mouthSmileLeft: 0.8, mouthSmileRight: 0.8 });
  assert.equal(dominantEmotion(probs), 'happy');
  assert.ok(emotionLoad(probs) < 25);
});

test('furrowed brows read as angry', () => {
  const probs = estimateEmotions({ browDownLeft: 0.9, browDownRight: 0.9, eyeSquintLeft: 0.6, eyeSquintRight: 0.6, mouthPressLeft: 0.5, mouthPressRight: 0.5 });
  assert.equal(dominantEmotion(probs), 'angry');
});

test('wide eyes with raised brows and open mouth read as surprise or fear and raise the load', () => {
  const probs = estimateEmotions({ eyeWideLeft: 0.9, eyeWideRight: 0.9, browInnerUp: 0.9, jawOpen: 0.7 });
  assert.ok(['surprise', 'fear'].includes(dominantEmotion(probs)));
  assert.ok(emotionLoad(probs) > 55);
});

test('frowning with raised inner brows reads as sad', () => {
  const probs = estimateEmotions({ mouthFrownLeft: 0.8, mouthFrownRight: 0.8, browInnerUp: 0.6 });
  assert.equal(dominantEmotion(probs), 'sad');
  assert.ok(emotionLoad(probs) > 50);
});

test('blendshapesToMap converts the MediaPipe category list', () => {
  assert.deepEqual(blendshapesToMap([{ categoryName: 'jawOpen', score: 0.4 }]), { jawOpen: 0.4 });
});

// ---------------------------------------------------------------- posture
function body({ shoulderWidth = 0.4, earRise = 0.3, noseShift = 0, wristNearFace = false, jitter = 0 } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  const cx = 0.5 + jitter;
  lm[LM.L_SHOULDER] = { x: cx - shoulderWidth / 2, y: 0.7, visibility: 1 };
  lm[LM.R_SHOULDER] = { x: cx + shoulderWidth / 2, y: 0.7, visibility: 1 };
  const earY = 0.7 - earRise * shoulderWidth * 2.5; // earRise scales the ear height in shoulder widths
  lm[LM.L_EAR] = { x: cx - 0.05, y: earY, visibility: 1 };
  lm[LM.R_EAR] = { x: cx + 0.05, y: earY, visibility: 1 };
  lm[LM.NOSE] = { x: cx + noseShift, y: earY + 0.03, visibility: 1 };
  lm[LM.L_WRIST] = wristNearFace ? { x: cx + noseShift - 0.03, y: earY + 0.08, visibility: 1 } : { x: cx - 0.3, y: 0.95, visibility: 1 };
  lm[LM.R_WRIST] = { x: cx + 0.3, y: 0.95, visibility: 1 };
  return lm;
}

function calibrated(analyzer) {
  let last;
  for (let i = 0; i < 20; i++) last = analyzer.update(body());
  return last;
}

test('posture analyzer calibrates first and then reports a low score for the baseline posture', () => {
  const a = new PostureAnalyzer();
  assert.equal(a.update(body()).calibrated, false);
  const result = calibrated(a);
  assert.equal(result.calibrated, true);
  assert.ok(result.score <= 5, `baseline posture should score ~0, got ${result.score}`);
});

test('slouching, leaning back and resting the head on a hand raise the score', () => {
  const a = new PostureAnalyzer();
  calibrated(a);
  const slouch = a.update(body({ earRise: 0.1 }));
  assert.ok(slouch.features.slouch > 0.8);

  const back = a.update(body({ shoulderWidth: 0.28 }));
  assert.ok(back.features.leaningBack > 0.8);

  const hand = a.update(body({ wristNearFace: true }));
  assert.ok(hand.features.headOnHand > 0.8);
  assert.ok(hand.score > 20);
});

test('turning the head away is detected', () => {
  const a = new PostureAnalyzer();
  calibrated(a);
  assert.ok(a.update(body({ noseShift: 0.2 })).features.gazeAway > 0.6);
});

test('fidgeting is movement over time, not a single pose', () => {
  const a = new PostureAnalyzer();
  calibrated(a);
  let r;
  for (let i = 0; i < 12; i++) r = a.update(body({ jitter: i % 2 ? 0.05 : -0.05 }));
  assert.ok(r.features.fidget > 0.5);

  const still = new PostureAnalyzer();
  calibrated(still);
  for (let i = 0; i < 12; i++) r = still.update(body());
  assert.equal(r.features.fidget, 0);
});

test('missing or invisible upper body yields no reading', () => {
  const a = new PostureAnalyzer();
  assert.equal(a.update(null), null);
  const hidden = body();
  hidden[LM.L_SHOULDER].visibility = 0.1;
  assert.equal(a.update(hidden), null);
});

// ---------------------------------------------------------------- fusion
test('fuse renormalises over the available signals', () => {
  assert.equal(fuse({ emotion: 80, posture: 40, behavior: 20 }), 0.5 * 80 + 0.3 * 40 + 0.2 * 20);
  assert.equal(fuse({ behavior: 60 }), 60);
  assert.equal(fuse({ emotion: 100, posture: 0 }), (0.5 * 100) / 0.8);
  assert.equal(fuse({}), null);
  assert.equal(fuse({ emotion: NaN }), null);
});

test('levelFor thresholds', () => {
  assert.equal(levelFor(80), 'high');
  assert.equal(levelFor(50), 'medium');
  assert.equal(levelFor(20), 'low');
});

test('smoothing: one spiky reading barely moves the score, a sustained one does', () => {
  const f = new LoadFusion({ tauMs: 6000 });
  let t = 0;
  for (let i = 0; i < 10; i++) f.update({ emotion: 20 }, (t += 500));
  const spike = f.update({ emotion: 100 }, (t += 500));
  assert.ok(spike.score < 40 && spike.level !== 'high');

  let r;
  for (let i = 0; i < 40; i++) r = f.update({ emotion: 100 }, (t += 500));
  assert.ok(r.score > 90 && r.level === 'high');
});

test('hysteresis: the level does not flicker around the high threshold', () => {
  const f = new LoadFusion({ tauMs: 1 });
  let t = 0;
  assert.equal(f.update({ emotion: 70 }, (t += 1000)).level, 'high');
  assert.equal(f.update({ emotion: 60 }, (t += 1000)).level, 'high');   // between exit (55) and enter (65)
  assert.equal(f.update({ emotion: 50 }, (t += 1000)).level, 'medium');
  assert.equal(f.update({ emotion: 60 }, (t += 1000)).level, 'medium'); // not back to high until 65
});

test('with no signals the previous reading is kept', () => {
  const f = new LoadFusion();
  f.update({ behavior: 80 }, 1000);
  assert.equal(f.update({}, 2000).score, 80);
});
