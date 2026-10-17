// Turns the available load signals into the three levels the app works with (low / medium / high).
//
// The camera pipeline (fusion.js, ported from MoodMatrix) only reports "high" at 52.5 and above and
// "low" otherwise. The study session needs a middle band, otherwise a student who is simply reading would be
// "low" load and get the hardest quizzes. So:
//
//   camera on   : high exactly when the camera pipeline says high; low only at CAMERA_LOW or below;
//                 everything in between is medium.
//   camera off  : the behaviour score (quiz results, help requests) maps with BEHAVIOR_HIGH / BEHAVIOR_LOW.

export const BEHAVIOR_HIGH = 65;
export const BEHAVIOR_LOW = 30;
export const CAMERA_LOW = 30;

export function behaviorLevel(score) {
  return score >= BEHAVIOR_HIGH ? 'high' : score <= BEHAVIOR_LOW ? 'low' : 'medium';
}

/**
 * @param {{external: ({score:number, level:string}|null), behavior: number}} signals
 * @returns {{score:number, level:'low'|'medium'|'high', source:'camera'|'behavior'}}
 */
export function sessionLevel({ external, behavior }) {
  if (external && typeof external.score === 'number') {
    const score = Math.round(external.score);
    const level = external.level === 'high' ? 'high' : score <= CAMERA_LOW ? 'low' : 'medium';
    return { score, level, source: 'camera' };
  }
  const score = Math.round(behavior);
  return { score, level: behaviorLevel(score), source: 'behavior' };
}

/** Quiz difficulty that suits a load level: struggling students get easier questions, relaxed ones harder. */
export function quizDifficultyFor(level) {
  return level === 'high' ? 'easy' : level === 'low' ? 'hard' : 'medium';
}

/** Behaviour-based load score from recent signs of struggling (0-100). */
export function behaviorScore({ recentStruggles = 0, lastQuizScore = null } = {}) {
  let score = 35 + Math.min(recentStruggles, 4) * 12;
  if (lastQuizScore !== null) score += lastQuizScore < 50 ? 35 : lastQuizScore >= 85 ? -15 : 0;
  return Math.max(5, Math.min(95, score));
}
