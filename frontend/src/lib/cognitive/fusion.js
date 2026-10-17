// Final cognitive load = emotion load + body-posture load, ported from MoodMatrix
// (backend/cognitive_load_fusion.py, "FUSED FINAL CL").
//
//   emotion > 52% and body < 45%  ->  0.95 emotion + 0.05 body   (strong facial signal, calm body)
//   otherwise                     ->  0.50 emotion + 0.50 body
//   level                         ->  "high" at 52.5% and above, otherwise "low"
//
// MoodMatrix has no behavioural signal. 3D Tutor does (quiz results, help requests), so when one is passed
// it is blended in with weight BEHAVIOR_WEIGHT; without it the result is exactly the MoodMatrix formula.
// A missing camera signal is dropped and the other one used on its own.

export const EMOTION_HIGH = 52;       // emotion_norm > 0.52
export const BODY_LOW = 45;           // body_norm < 0.45
export const HIGH_THRESHOLD = 52.5;   // cl_status_final
export const BEHAVIOR_WEIGHT = 0.2;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** @returns {number|null} 0-100 fused score, or null when no signal is available */
export function fuse({ emotion, posture, behavior } = {}) {
  let camera = null;
  if (isNum(emotion) && isNum(posture)) {
    const [we, wb] = emotion > EMOTION_HIGH && posture < BODY_LOW ? [0.95, 0.05] : [0.5, 0.5];
    camera = we * emotion + wb * posture;
  } else if (isNum(emotion)) camera = emotion;
  else if (isNum(posture)) camera = posture;

  if (isNum(behavior)) return camera === null ? behavior : (1 - BEHAVIOR_WEIGHT) * camera + BEHAVIOR_WEIGHT * behavior;
  return camera;
}

/** MoodMatrix reports only Low / High. */
export function levelFor(score) {
  return score >= HIGH_THRESHOLD ? 'high' : 'low';
}

export class LoadFusion {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = null;
    this.level = 'medium'; // "no reading yet"
  }

  update(signals) {
    const fused = fuse(signals);
    if (fused === null) return { score: this.score, level: this.level };
    this.score = Math.round(fused);
    this.level = levelFor(fused);
    return { score: this.score, level: this.level };
  }
}
