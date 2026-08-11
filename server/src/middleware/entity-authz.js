/**
 * Express helpers for entity authz (milestone 4.5).
 * M5: JWT user from attachAuthUser takes precedence over headers.
 */
import { normalizeActor } from '../lib/authz.js';

/** Attach `req.actor` — skip if JWT middleware already set it. */
export function attachActor(req, _res, next) {
  if (req.actor) {
    next();
    return;
  }
  req.actor = normalizeActor({
    id: header(req, 'x-user-id'),
    email: header(req, 'x-user-email'),
    role: header(req, 'x-user-role'),
  });
  next();
}

function header(req, name) {
  const v = req.headers[name];
  if (Array.isArray(v)) return v[0] || null;
  return v || null;
}
