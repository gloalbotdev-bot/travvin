/**
 * Express helpers for entity authz (milestone 4.5).
 * M5+: JWT user from attachAuthUser sets req.actor; no header-based identity (SEC-001).
 */
import { normalizeActor } from '../lib/authz.js';

/** Attach `req.actor` — skip if JWT middleware already set it. */
export function attachActor(req, _res, next) {
  if (req.actor) {
    next();
    return;
  }
  req.actor = normalizeActor(null);
  next();
}
