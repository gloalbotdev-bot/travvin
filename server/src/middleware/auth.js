/**
 * Optional JWT auth — attaches req.user + req.actor when Bearer token present.
 */
import { extractBearer, verifyToken } from '../lib/jwt.js';
import { normalizeActor } from '../lib/authz.js';
import { createUserStore } from '../lib/user-store.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export function createAuthMiddleware(prisma) {
  const users = createUserStore(prisma);

  return async function attachAuthUser(req, _res, next) {
    let token = extractBearer(req);
    if (!token && req.query) {
      const q = req.query.token ?? req.query.access_token;
      if (typeof q === 'string' && q) token = q;
    }
    if (!token) return next();

    const claims = verifyToken(token);
    if (!claims) return next();

    try {
      const row = await users.findById(claims.id);
      if (row) {
        req.user = users.toAuth(row);
        req.actor = normalizeActor({
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
        });
      }
    } catch {
      /* ignore */
    }
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}
