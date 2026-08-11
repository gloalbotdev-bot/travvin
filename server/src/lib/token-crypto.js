/**
 * AES-256-GCM helpers for calendar refresh tokens at rest (M8).
 * Env: CALENDAR_TOKEN_ENCRYPTION_KEY — 32 raw bytes as base64, or 64 hex chars.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'v1';

export function getEncryptionKey() {
  const raw = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || '';
  if (!raw) {
    const err = new Error('CALENDAR_TOKEN_ENCRYPTION_KEY is not set');
    err.status = 500;
    throw err;
  }
  let key;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }
  if (key.length !== 32) {
    const err = new Error('CALENDAR_TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
    err.status = 500;
    throw err;
  }
  return key;
}

/** @param {string} plaintext */
export function encryptSecret(plaintext) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString('base64')}.${Buffer.concat([enc, tag]).toString('base64')}`;
}

/** @param {string} encoded */
export function decryptSecret(encoded) {
  const key = getEncryptionKey();
  const body = String(encoded || '');
  if (!body.startsWith(`${PREFIX}:`)) {
    const err = new Error('Unsupported token ciphertext version');
    err.status = 500;
    throw err;
  }
  const rest = body.slice(PREFIX.length + 1);
  const [ivB64, dataB64] = rest.split('.');
  if (!ivB64 || !dataB64) {
    const err = new Error('Malformed token ciphertext');
    err.status = 500;
    throw err;
  }
  const iv = Buffer.from(ivB64, 'base64');
  const buf = Buffer.from(dataB64, 'base64');
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
