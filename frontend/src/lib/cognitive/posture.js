// Body-posture cues from MediaPipe pose landmarks (33 normalised points).
//
// Cues (from the README): slouching, leaning back, head resting on a hand, fidgeting, and head/gaze turning
// away. Slouching and leaning back are measured against the student's own baseline, captured during the
// first few seconds of the session.

export const LM = { NOSE: 0, L_EAR: 7, R_EAR: 8, L_SHOULDER: 11, R_SHOULDER: 12, L_WRIST: 15, R_WRIST: 16 };

export const POSTURE_WEIGHTS = { slouch: 0.25, leaningBack: 0.2, headOnHand: 0.25, fidget: 0.15, gazeAway: 0.15 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const visible = (p) => p && (p.visibility === undefined || p.visibility > 0.5);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** Geometry that does not depend on history. Returns null if the upper body is not visible. */
export function measure(landmarks) {
  const need = [LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_EAR, LM.R_EAR].map((i) => landmarks[i]);
  if (need.some((p) => !visible(p))) return null;

  const [nose, ls, rs, le, re] = need;
  const shoulderWidth = dist(ls, rs);
  if (shoulderWidth < 0.05) return null;

  const shoulderMid = mid(ls, rs);
  const earMid = mid(le, re);
  const wrists = [landmarks[LM.L_WRIST], landmarks[LM.R_WRIST]].filter(visible);

  return {
    shoulderWidth,
    // How far the ears sit above the shoulders, in shoulder widths (shrinks when slouching)
    earHeight: (shoulderMid.y - earMid.y) / shoulderWidth,
    headOffset: Math.abs(nose.x - shoulderMid.x) / shoulderWidth,
    wristToFace: wrists.length ? Math.min(...wrists.map((w) => Math.min(dist(w, nose), dist(w, earMid)))) / shoulderWidth : Infinity,
    points: [ls, rs, ...wrists],
  };
}

export class PostureAnalyzer {
  constructor({ calibrationFrames = 15, motionWindow = 12 } = {}) {
    this.calibrationFrames = calibrationFrames;
    this.motionWindow = motionWindow;
    this.reset();
  }

  reset() {
    this.samples = [];
    this.baseline = null;
    this.motion = [];
    this.previous = null;
  }

  /** @returns {{score:number, features:object, calibrated:boolean}|null} */
  update(landmarks) {
    const m = landmarks ? measure(landmarks) : null;
    if (!m) return null;

    if (!this.baseline) {
      this.samples.push(m);
      if (this.samples.length >= this.calibrationFrames) {
        this.baseline = {
          shoulderWidth: median(this.samples.map((s) => s.shoulderWidth)),
          earHeight: median(this.samples.map((s) => s.earHeight)),
        };
      }
      return { score: 0, features: {}, calibrated: false };
    }

    // Fidgeting: average movement of shoulders/wrists between frames, relative to body size
    if (this.previous && this.previous.points.length === m.points.length) {
      const step = m.points.reduce((sum, p, i) => sum + dist(p, this.previous.points[i]), 0) / m.points.length;
      this.motion.push(step / m.shoulderWidth);
      if (this.motion.length > this.motionWindow) this.motion.shift();
    }
    this.previous = m;

    const b = this.baseline;
    const motionMean = this.motion.length ? this.motion.reduce((a, c) => a + c, 0) / this.motion.length : 0;

    const features = {
      slouch: clamp01((b.earHeight - m.earHeight) / (0.4 * b.earHeight)),
      leaningBack: clamp01((b.shoulderWidth - m.shoulderWidth) / (0.25 * b.shoulderWidth)),
      headOnHand: clamp01((0.9 - m.wristToFace) / 0.4),
      fidget: clamp01((motionMean - 0.02) / 0.06),
      gazeAway: clamp01((m.headOffset - 0.2) / 0.35),
    };

    const score = Math.round(100 * Object.entries(POSTURE_WEIGHTS).reduce((sum, [k, w]) => sum + w * features[k], 0));
    return { score, features, calibrated: true };
  }
}
