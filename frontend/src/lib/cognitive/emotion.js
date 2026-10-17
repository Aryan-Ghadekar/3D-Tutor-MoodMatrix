// Facial emotion estimate from MediaPipe face blendshapes (the 52 ARKit-style coefficients).
//
// This is a rule-based mapping, not a trained classifier: each emotion is a weighted sum of the facial
// action units that characterise it. The load weights below follow the ordering in the README (surprise,
// sad and fear matter most for cognitive load); swap `estimateEmotions` for a trained model if you have one.

export const EMOTIONS = ['surprise', 'sad', 'fear', 'happy', 'neutral', 'angry', 'disgust'];

// How strongly each emotion indicates cognitive load (0-1).
export const LOAD_WEIGHTS = {
  fear: 0.9,
  sad: 0.8,
  surprise: 0.7,
  angry: 0.6,
  disgust: 0.5,
  neutral: 0.2,
  happy: 0.05,
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const avg = (...values) => values.reduce((a, b) => a + b, 0) / values.length;

/** [{categoryName, score}] (MediaPipe output) -> { name: score } */
export function blendshapesToMap(categories = []) {
  const map = {};
  for (const c of categories) map[c.categoryName] = c.score;
  return map;
}

/** Raw (unnormalised) activation of each emotion, 0-1. */
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

  return { surprise, sad, fear, happy, neutral, angry, disgust };
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

/** Cognitive-load contribution of an emotion distribution, 0-100. */
export function emotionLoad(probs) {
  const weighted = EMOTIONS.reduce((sum, e) => sum + (probs[e] || 0) * LOAD_WEIGHTS[e], 0);
  return Math.round(weighted * 100);
}
