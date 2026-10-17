// Small in-memory limiter used to slow down password guessing and account spam.
// State lives in the server process, which is enough for a single instance; use a shared store (Redis)
// if the app runs on several instances.

/**
 * Failure limiter: after `max` failures inside `windowMs` the key is locked for `lockMs`.
 * Call check() before the attempt, fail() after a failed attempt and reset() after a success.
 */
export function createFailureLimiter({ max = 5, windowMs = 15 * 60_000, lockMs = 15 * 60_000, now = () => Date.now() } = {}) {
  const entries = new Map(); // key -> { failures: number[], lockedUntil: number }

  const prune = () => {
    const t = now();
    for (const [key, e] of entries) {
      e.failures = e.failures.filter((f) => t - f < windowMs);
      if (e.failures.length === 0 && e.lockedUntil <= t) entries.delete(key);
    }
  };

  return {
    check(key) {
      prune();
      const e = entries.get(key);
      const wait = e ? e.lockedUntil - now() : 0;
      return wait > 0 ? { allowed: false, retryAfterMs: wait } : { allowed: true, retryAfterMs: 0 };
    },
    fail(key) {
      const t = now();
      const e = entries.get(key) || { failures: [], lockedUntil: 0 };
      e.failures = e.failures.filter((f) => t - f < windowMs);
      e.failures.push(t);
      if (e.failures.length >= max) {
        e.lockedUntil = t + lockMs;
        e.failures = [];
      }
      entries.set(key, e);
    },
    reset(key) {
      entries.delete(key);
    },
    get size() {
      return entries.size;
    },
  };
}

/** Counter limiter: at most `max` calls per `windowMs` for each key. */
export function createRateLimiter({ max = 10, windowMs = 60 * 60_000, now = () => Date.now() } = {}) {
  const hits = new Map(); // key -> timestamps

  return {
    take(key) {
      const t = now();
      const recent = (hits.get(key) || []).filter((h) => t - h < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return { allowed: false, retryAfterMs: windowMs - (t - recent[0]) };
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every((h) => t - h >= windowMs)) hits.delete(k);
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}

/** Best-effort client address (behind a proxy, configure it to set X-Forwarded-For). */
export function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'local').trim();
}
