/**
 * Production env validation (SEC-011, SEC-013).
 * Render blueprint wires JWT_SECRET + FRONTEND_URL — this catches misconfigured deploys.
 */

const WEAK_SECRETS = new Set(['', 'dev-only-change-me', 'change-me', 'secret']);

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function getFrontendUrl() {
  const fromEnv = process.env.FRONTEND_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (isProduction()) return null;
  return 'http://localhost:5173';
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && !WEAK_SECRETS.has(secret)) return secret;
  if (isProduction()) return null;
  return secret || 'dev-only-change-me';
}

export function assertProductionEnv() {
  if (!isProduction()) {
    if (!process.env.JWT_SECRET) {
      console.warn('[env] JWT_SECRET not set — using dev default (non-production only)');
    }
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || WEAK_SECRETS.has(secret) || secret.length < 32) {
    console.error(
      '[env] FATAL: JWT_SECRET required in production (≥32 chars, not dev default)',
    );
    process.exit(1);
  }

  if (!process.env.FRONTEND_URL?.trim()) {
    console.error('[env] FATAL: FRONTEND_URL required in production');
    process.exit(1);
  }
}
