/**
 * GET /api/app/public-settings — Base44-compatible bootstrap for AuthContext.
 */
import { Router } from 'express';
import { verifyToken, extractBearer } from '../lib/jwt.js';
import { createUserStore } from '../lib/user-store.js';

/** @param {import('@prisma/client').PrismaClient} prisma */
export function createAppSettingsRouter(prisma) {
  const router = Router();
  const users = createUserStore(prisma);

  router.get('/public-settings', async (req, res) => {
    const appId = process.env.APP_ID || process.env.VITE_BASE44_APP_ID || 'travvin';
    const settings = await prisma.appSettings.findUnique({ where: { id: 'default' } });
    const public_settings = settings?.publicSettings ?? {};

    const token = extractBearer(req) || req.headers['x-access-token'];
    if (!token) {
      return res.json({ id: appId, public_settings });
    }

    const claims = verifyToken(token);
    if (!claims) {
      return res.status(403).json({
        error: 'Authentication required',
        extra_data: { reason: 'auth_required' },
      });
    }

    const row = await users.findById(claims.id);
    if (!row) {
      return res.status(403).json({
        error: 'Authentication required',
        extra_data: { reason: 'auth_required' },
      });
    }
    if (!row.registered) {
      return res.status(403).json({
        error: 'User not registered',
        extra_data: { reason: 'user_not_registered' },
      });
    }

    res.json({ id: appId, public_settings });
  });

  return router;
}
