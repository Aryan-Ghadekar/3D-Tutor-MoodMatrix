// Weighted fusion of the cognitive-load signals, followed by temporal smoothing.
//
// Signals are 0-100 scores; any of them may be missing (camera off, no face in view...). Missing signals are
// dropped and the remaining weights are renormalised. The fused score is smoothed with a time-based
// exponential moving average so a single odd frame cannot flip the level, and the level uses hysteresis.

export const FUSION_WEIGHTS = { emotion: 0.5, posture: 0.3, behavior: 0.2 };

export const HIGH_ENTER = 65;
export const HIGH_EXIT = 55;
export const LOW_ENTER = 30;
export const LOW_EXIT = 40;

export function fuse(signals, weights = FUSION_WEIGHTS) {
  let total = 0;
  let weightSum = 0;
  for (const [name, weight] of Object.entries(weights)) {
    const value = signals[name];
    if (typeof value === 'number' && Number.isFinite(value)) {
      total += weight * value;
      weightSum += weight;
    }
  }
  return weightSum > 0 ? total / weightSum : null;
}

/** Level for a score without any history. */
export function levelFor(score) {
  return score >= HIGH_ENTER ? 'high' : score <= LOW_ENTER ? 'low' : 'medium';
}

export class LoadFusion {
  /** @param {number} tauMs smoothing time constant: after tauMs about 63% of a step change is reflected */
  constructor({ tauMs = 6000, weights = FUSION_WEIGHTS } = {}) {
    this.tauMs = tauMs;
    this.weights = weights;
    this.score = null;
    this.level = 'medium';
    this.lastAt = null;
  }

  reset() {
    this.score = null;
    this.level = 'medium';
    this.lastAt = null;
  }

  update(signals, now = Date.now()) {
    const fused = fuse(signals, this.weights);
    if (fused === null) return { score: this.score, level: this.level };

    if (this.score === null) {
      this.score = fused;
    } else {
      const dt = Math.max(0, now - this.lastAt);
      const alpha = 1 - Math.exp(-dt / this.tauMs);
      this.score += alpha * (fused - this.score);
    }
    this.lastAt = now;
    this.level = this.nextLevel(this.score);
    return { score: Math.round(this.score), level: this.level };
  }

  nextLevel(score) {
    if (this.level === 'high') return score < HIGH_EXIT ? levelFor(score) : 'high';
    if (this.level === 'low') return score > LOW_EXIT ? levelFor(score) : 'low';
    return levelFor(score);
  }
}
