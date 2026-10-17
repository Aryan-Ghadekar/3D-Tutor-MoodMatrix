import test from 'node:test';
import assert from 'node:assert/strict';
import { createFailureLimiter, createRateLimiter, clientKey } from './ratelimit.js';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test('five failures lock the key for 15 minutes, then it unlocks', () => {
  const c = clock();
  const limiter = createFailureLimiter({ now: c.now });
  for (let i = 0; i < 4; i++) { limiter.fail('a'); assert.equal(limiter.check('a').allowed, true); }
  limiter.fail('a');
  const locked = limiter.check('a');
  assert.equal(locked.allowed, false);
  assert.equal(locked.retryAfterMs, 15 * 60_000);

  c.advance(10 * 60_000);
  assert.equal(limiter.check('a').allowed, false);
  assert.equal(limiter.check('a').retryAfterMs, 5 * 60_000);

  c.advance(5 * 60_000 + 1);
  assert.equal(limiter.check('a').allowed, true);
});

test('keys are independent and a success resets the counter', () => {
  const c = clock();
  const limiter = createFailureLimiter({ now: c.now });
  for (let i = 0; i < 4; i++) limiter.fail('a');
  limiter.reset('a');
  limiter.fail('a');
  assert.equal(limiter.check('a').allowed, true);
  for (let i = 0; i < 5; i++) limiter.fail('b');
  assert.equal(limiter.check('b').allowed, false);
  assert.equal(limiter.check('a').allowed, true);
});

test('old failures fall out of the window and do not add up', () => {
  const c = clock();
  const limiter = createFailureLimiter({ now: c.now });
  for (let i = 0; i < 4; i++) limiter.fail('a');
  c.advance(16 * 60_000);
  limiter.fail('a');
  assert.equal(limiter.check('a').allowed, true);
});

test('idle entries are pruned', () => {
  const c = clock();
  const limiter = createFailureLimiter({ now: c.now });
  limiter.fail('a');
  assert.equal(limiter.size, 1);
  c.advance(20 * 60_000);
  limiter.check('anything');
  assert.equal(limiter.size, 0);
});

test('rate limiter allows max calls per window', () => {
  const c = clock();
  const limiter = createRateLimiter({ max: 3, windowMs: 60_000, now: c.now });
  assert.ok(limiter.take('ip').allowed && limiter.take('ip').allowed && limiter.take('ip').allowed);
  const blocked = limiter.take('ip');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 60_000);
  assert.equal(limiter.take('other').allowed, true);
  c.advance(60_001);
  assert.equal(limiter.take('ip').allowed, true);
});

test('clientKey prefers the first X-Forwarded-For address', () => {
  const req = (h) => ({ headers: { get: (k) => h[k.toLowerCase()] ?? null } });
  assert.equal(clientKey(req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })), '1.2.3.4');
  assert.equal(clientKey(req({ 'x-real-ip': '5.6.7.8' })), '5.6.7.8');
  assert.equal(clientKey(req({})), 'local');
});
