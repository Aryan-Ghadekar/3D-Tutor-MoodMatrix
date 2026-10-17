// Body-posture cognitive load, ported from MoodMatrix (backend/scripts/cognitive_body_posture.py,
// estimate_body_cl). Same cues, constants and smoothing chain as the Python version:
//
//   slouch   - torso lean: horizontal shoulder-to-hip offset over torso length, tanh(|slope| / 0.15)
//   hand     - closest wrist to the nose over torso length, tanh((0.2 - d) / 0.05)
//   fidget   - wrist movement between frames, tanh(velocity / 0.05)
//   raw      = 0.30 slouch + 0.35 hand + 0.35 fidget
//   percent  = 100 / (1 + exp(-5 raw))  ->  exponential smoothing (0.08)  ->  Kalman filter  ->  mean of last 10
//
// Differences from the Python original: it runs per browser frame on MediaPipe PoseLandmarker output (one
// person) instead of YOLO + per-person tracking, and there is no calibration step.

export const LM = {
  NOSE: 0, L_SHOULDER: 11, R_SHOULDER: 12, L_WRIST: 15, R_WRIST: 16, L_HIP: 23, R_HIP: 24,
};

export const POSTURE_WEIGHTS = { slouch: 0.3, handNearHead: 0.35, fidget: 0.35 };
export const SMOOTHING_ALPHA = 0.08;
export const WINDOW_SIZE_BODY = 10;
export const HAND_HISTORY = 30;

export const POSTURE_REASONS = { slouch: 'Slouching', handNearHead: 'Hand near head', fidget: 'Fidgeting' };

// Kalman filter (constant-velocity model), identical matrices to the Python code.
// State is [value, velocity]; every matrix is 2x2 so they are written out by hand.
const Q = [[1e-5, 0], [0, 1e-4]];
const R = 1e-2;

export function kalmanInit() {
  return { x: [0.5, 0], P: [[1, 0], [0, 1]] };
}

/** One predict+update step. Returns the new state and the filtered value. */
export function kalmanUpdate({ x, P }, measurement) {
  // predict: x = A x, P = A P A^T + Q, with A = [[1,1],[0,1]]
  const xp = [x[0] + x[1], x[1]];
  const Pp = [
    [P[0][0] + P[0][1] + P[1][0] + P[1][1] + Q[0][0], P[0][1] + P[1][1] + Q[0][1]],
    [P[1][0] + P[1][1] + Q[1][0], P[1][1] + Q[1][1]],
  ];
  // update with H = [1, 0]
  const y = measurement - xp[0];
  const S = Pp[0][0] + R;
  const K = [Pp[0][0] / S, Pp[1][0] / S];
  const xn = [xp[0] + K[0] * y, xp[1] + K[1] * y];
  const Pn = [
    [(1 - K[0]) * Pp[0][0], (1 - K[0]) * Pp[0][1]],
    [Pp[1][0] - K[1] * Pp[0][0], Pp[1][1] - K[1] * Pp[0][1]],
  ];
  return { state: { x: xn, P: Pn }, value: xn[0] };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const visible = (p) => p && (p.visibility === undefined || p.visibility > 0.5);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class PostureAnalyzer {
  constructor() {
    this.reset();
  }

  reset() {
    this.handHistory = [];
    this.smoothed = null;
    this.kalman = null;
    this.window = [];
  }

  /**
   * @param landmarks MediaPipe pose landmarks (33 normalised points) for one person
   * @returns {{score:number, features:object, reasons:string[], calibrated:true}|null}
   */
  update(landmarks) {
    if (!landmarks) return null;
    const nose = landmarks[LM.NOSE];
    const lSh = landmarks[LM.L_SHOULDER];
    const rSh = landmarks[LM.R_SHOULDER];
    const lHip = landmarks[LM.L_HIP];
    const rHip = landmarks[LM.R_HIP];
    const lWr = landmarks[LM.L_WRIST];
    const rWr = landmarks[LM.R_WRIST];
    // Hips are usually off-screen at a desk; MediaPipe still extrapolates them, so (like the Python
    // original) only the points that anchor the measurement have to be visible.
    if (![nose, lSh, rSh, lHip, rHip, lWr, rWr].every(Boolean) || ![nose, lSh, rSh].every(visible)) return null;

    const shoulderMid = { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2 };
    const hipMid = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const torsoLength = Math.hypot(hipMid.x - shoulderMid.x, hipMid.y - shoulderMid.y) + 1e-6;

    const slope = (hipMid.x - shoulderMid.x) / torsoLength;
    const slouch = Math.tanh(Math.abs(slope) / 0.15);

    const handDistNorm = Math.min(dist(lWr, nose), dist(rWr, nose)) / torsoLength;
    const handNearHead = Math.tanh((0.2 - handDistNorm) / 0.05);

    const handPos = [lWr.x, lWr.y, rWr.x, rWr.y];
    let velocity = 0;
    const last = this.handHistory[this.handHistory.length - 1];
    if (last) velocity = Math.hypot(...handPos.map((v, i) => v - last[i]));
    this.handHistory.push(handPos);
    if (this.handHistory.length > HAND_HISTORY) this.handHistory.shift();
    const fidget = Math.tanh(velocity / 0.05);

    const raw = POSTURE_WEIGHTS.slouch * slouch + POSTURE_WEIGHTS.handNearHead * handNearHead + POSTURE_WEIGHTS.fidget * fidget;
    const percent = 100 / (1 + Math.exp(-5 * raw));

    const prev = this.smoothed ?? percent;
    this.smoothed = SMOOTHING_ALPHA * percent + (1 - SMOOTHING_ALPHA) * prev;

    const filtered = kalmanUpdate(this.kalman || kalmanInit(), this.smoothed);
    this.kalman = filtered.state;

    this.window.push(filtered.value);
    if (this.window.length > WINDOW_SIZE_BODY) this.window.shift();
    const mean = this.window.reduce((a, c) => a + c, 0) / this.window.length;

    const features = { slouch, handNearHead, fidget };
    const reasons = Object.keys(features).filter((k) => features[k] > 0.5).map((k) => POSTURE_REASONS[k]);
    return { score: Math.round(clamp(mean, 0, 100)), features, reasons, calibrated: true };
  }
}
