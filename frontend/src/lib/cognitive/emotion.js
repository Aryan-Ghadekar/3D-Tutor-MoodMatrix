// Emotion cognitive load, ported from MoodMatrix (backend/cognitive_load_fusion.py).
//
// MoodMatrix gets a 7-way emotion distribution from DeepFace; in the browser the same distribution is
// estimated from MediaPipe face blendshapes (`estimateEmotions`, a rule-based mapping, not a trained
// classifier). Everything after that follows the Python pipeline:
//
//   E      = emotion probabilities in EMOTION_KEYS order, averaged over the last 5 frames
//   F      = clip(E . W + intercept, 0, 1)         W = emotion_importance.json, normalised to sum |W| = 1
//   F      = 0.9 F_prev + 0.1 F                    (focus smoothing, BETA)
//   e'     = W[angry] E[angry] + W[sad] E[sad] + W[fear] E[fear]
//   CL_math= clip(1 - exp(-0.8 (1 - F) - 1.2 e'), 0, 1)
//   CL_ml  = F  (MoodMatrix falls back to F when the random-forest model file is missing; a .pkl cannot run
//            in the browser, so that fallback is always used here)
//   CL     = 0.6 CL_math + 0.4 CL_ml -> 0.9 CL_prev + 0.1 CL -> Kalman filter -> x100
//
// When no face has been seen for MISSING_THRESHOLD frames the load drops to 0 and the Kalman filter resets.

import { kalmanInit, kalmanUpdate } from './posture.js';

export const EMOTIONS = ['happy', 'sad', 'angry', 'fear', 'disgust', 'surprise', 'neutral'];

// Trained importance weights (MoodMatrix backend/emotion_importance.json).
export const EMOTION_IMPORTANCE = {
  happy: 0.19326543547798736,
  sad: 0.16034385158675785,
  angry: 0.1850118738780912,
  fear: 0.11978457121110223,
  disgust: 0.07989741940649933,
  surprise: 0.12752375784162792,
  neutral: 0.1341730905979341,
};
export const INTERCEPT = 0;

const importanceSum = EMOTIONS.reduce((s, e) => s + Math.abs(EMOTION_IMPORTANCE[e]), 0);
export const W = Object.fromEntries(EMOTIONS.map((e) => [e, EMOTION_IMPORTANCE[e] / importanceSum]));

export const BETA = 0.9;
export const ALPHA1 = 0.8;
export const ALPHA2 = 1.2;
export const EMOTION_WINDOW = 5;
export const MISSING_THRESHOLD = 10;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const avg = (...values) => values.reduce((a, b) => a + b, 0) / values.length;

/** [{categoryName, score}] (MediaPipe output) -> { name: score } */
export function blendshapesToMap(categories = []) {
  const map = {};
  for (const c of categories) map[c.categoryName] = c.score;
  return map;
}

/** Raw (unnormalised) activation of each emotion, 0-1, from the 52 ARKit-style face blendshapes. */
export function emotionActivations(bs) {
  const g = (name) => bs[name] ?? 0;

  const happy = avg(g('mouthSmileLeft'), g('mouthSmileRight'));
  const surprise = clamp01(0.4 * avg(g('eyeWideLeft'), g('eyeWideRight')) + 0.4 * g('jawOpen') + 0.2 * g('browInnerUp'));
  const sad = clamp01(0.6 * avg(g('mouthFrownLeft'), g('mouthFrownRight')) + 0.4 * g('browInnerUp') * (1 - g('jawOpen')));
  const fear = clamp01(0.4 * avg(g('eyeWideLeft'), g('eyeWideRight')) + 0.3 * g('browInnerUp') + 0.3 * avg(g('mouthStretchLeft'), g('mouthStretchRight')));
  const angry = clamp01(0.5 * avg(g('browDownLeft'), g('browDownRight')) + 0.25 * avg(g('eyeSquintLeft'), g('eyeSquintRight')) + 0.25 * avg(g('mouthPressLeft'), g('mouthPressRight')));
  const disgust = clamp01(0.5 * avg(g('noseSneerLeft'), g('noseSneerRight')) + 0.5 * avg(g('mouthUpperUpLeft'), g('mouthUpperUpRight')));

  const strongest = Math.max(happy, surprise, sad, fear, angry, disgust);
  // A relaxed face has every expression near zero; neutral wins until something clearly activates.
  const neutral = clamp01(0.45 - strongest) + 0.05;

  return { happy, sad, angry, fear, disgust, surprise, neutral };
}

/** Probability-like distribution over EMOTIONS (sums to 1). */
export function estimateEmotions(bs) {
  const raw = emotionActivations(bs);
  const total = EMOTIONS.reduce((sum, e) => sum + raw[e], 0);
  const probs = {};
  for (const e of EMOTIONS) probs[e] = total > 0 ? raw[e] / total : e === 'neutral' ? 1 : 0;
  return probs;
}

export function dominantEmotion(probs) {
  return EMOTIONS.reduce((best, e) => (probs[e] > probs[best] ? e : best), 'neutral');
}

export class EmotionLoadEstimator {
  constructor() {
    this.reset();
  }

  reset() {
    this.history = Object.fromEntries(EMOTIONS.map((e) => [e, []]));
    this.prevFocus = 0.5;
    this.prevLoad = 0.5;
    this.kalman = { x: [0, 0], P: [[1, 0], [0, 1]] }; // the emotion filter starts from 0, unlike the body one
    this.missingFrames = 0;
  }

  /** Call every frame. `probs` is an emotion distribution, or null when no face was found. Returns 0-100. */
  update(probs) {
    if (!probs) {
      this.missingFrames += 1;
      if (this.missingFrames >= MISSING_THRESHOLD) {
        this.kalman = { x: [0, 0], P: [[1, 0], [0, 1]] };
        return 0;
      }
      return Math.round(this.prevLoad * 100);
    }
    this.missingFrames = 0;

    for (const e of EMOTIONS) {
      const h = this.history[e];
      h.push(probs[e] || 0);
      if (h.length > EMOTION_WINDOW) h.shift();
    }
    const E = Object.fromEntries(EMOTIONS.map((e) => [e, this.history[e].reduce((a, c) => a + c, 0) / this.history[e].length]));

    const F = clamp01(EMOTIONS.reduce((s, e) => s + E[e] * W[e], 0) + INTERCEPT);
    const focus = BETA * this.prevFocus + (1 - BETA) * F;
    this.prevFocus = focus;

    const eDash = W.angry * E.angry + W.sad * E.sad + W.fear * E.fear;
    const clMath = clamp01(1 - Math.exp(-ALPHA1 * (1 - focus) - ALPHA2 * eDash));
    const clMl = clamp01(F);
    const fused = 0.6 * clMath + 0.4 * clMl;

    const smoothed = BETA * this.prevLoad + (1 - BETA) * fused;
    this.prevLoad = smoothed;

    const filtered = kalmanUpdate(this.kalman, smoothed);
    this.kalman = filtered.state;
    return Math.round(clamp01(filtered.value) * 100);
  }
}
