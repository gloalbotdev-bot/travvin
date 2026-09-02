/**
 * One-time OAuth auth codes (SEC-012).
 */
import crypto from 'node:crypto';

const authCodes = new Map();
const TTL_MS = 60 * 1000;

export function pruneAuthCodes() {
  const now = Date.now();
  for (const [k, v] of authCodes) {
    if (now - v.at > TTL_MS) authCodes.delete(k);
  }
}

/** @param {string} userId */
export function issueAuthCode(userId) {
  pruneAuthCodes();
  const code = crypto.randomBytes(24).toString('hex');
  authCodes.set(code, { userId, at: Date.now() });
  return code;
}

/** @returns {{ userId: string, at: number } | null} */
export function consumeAuthCode(code) {
  pruneAuthCodes();
  const entry = authCodes.get(code);
  if (!entry) return null;
  authCodes.delete(code);
  return entry;
}
