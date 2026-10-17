// Minimal file-backed authentication for local use (scrypt password hashes + signed session cookie).
// Replace with a real database / auth provider before deploying.
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSION_COOKIE = 'mm_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;            // normal session: 12 hours
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;      // "Remember me": 30 days

export { SESSION_COOKIE, SESSION_TTL_MS, REMEMBER_TTL_MS };

// The signing secret must be provided in production. In development a random secret is generated once per
// process (kept on globalThis so hot reloads do not log everyone out); it is never a fixed, guessable value.
function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set. Set it to a long random string before running in production.');
  }
  globalThis.__devSessionSecret ||= crypto.randomBytes(32).toString('hex');
  return globalThis.__devSessionSecret;
}

async function readUsers() {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

// Serialise writes so concurrent registrations cannot clobber each other.
let writeQueue = Promise.resolve();
function mutateUsers(fn) {
  const run = writeQueue.then(async () => {
    const users = await readUsers();
    const result = await fn(users);
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${USERS_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(users, null, 2));
    await fs.rename(tmp, USERS_FILE);
    return result;
  });
  writeQueue = run.catch(() => {});
  return run;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function createUser({ name, email, password, role, phone, specialization }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  return mutateUsers((users) => {
    if (users.some((u) => u.email === normalizedEmail)) {
      const err = new Error('An account with this email already exists');
      err.status = 409;
      throw err;
    }
    const user = {
      id: crypto.randomUUID(),
      name: String(name).trim(),
      email: normalizedEmail,
      role: role === 'teacher' ? 'teacher' : 'student',
      phone: phone || '',
      specialization: specialization || '',
      goal: null,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    return publicUser(user);
  });
}

export async function authenticate(email, password) {
  const users = await readUsers();
  const user = users.find((u) => u.email === String(email).trim().toLowerCase());
  // Always run a hash so response time does not reveal whether the email exists.
  const stored = user?.passwordHash || hashPassword('placeholder');
  const ok = verifyPassword(String(password), stored);
  return ok && user ? publicUser(user) : null;
}

export async function updateUser(id, patch) {
  return mutateUsers((users) => {
    const user = users.find((u) => u.id === id);
    if (!user) return null;
    Object.assign(user, patch);
    return publicUser(user);
  });
}

export async function findUser(id) {
  const users = await readUsers();
  return publicUser(users.find((u) => u.id === id));
}

const sign = (payload) => crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');

export function createSessionToken(userId, ttlMs = SESSION_TTL_MS) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + ttlMs })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
}

export async function getSessionUser(request) {
  const uid = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  return uid ? findUser(uid) : null;
}

/** Without "remember", the cookie is a browser-session cookie (gone when the browser closes). */
export function setSessionCookie(response, userId, { remember = false } = {}) {
  const ttl = remember ? REMEMBER_TTL_MS : SESSION_TTL_MS;
  response.cookies.set(SESSION_COOKIE, createSessionToken(userId, ttl), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(remember ? { maxAge: ttl / 1000 } : {}),
  });
}
