/**
 * users.inviteUser — admin-only (role changes / invites).
 */
import { Router } from 'express';
import { createUserStore } from '../lib/user-store.js';
import { requireAuth } from '../middleware/auth.js';

/** @param {import('@prisma/client').PrismaClient} prisma */
export function createUsersRouter(prisma) {
  const router = Router();
  const users = createUserStore(prisma);

  router.post('/invite', requireAuth, async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { email, role } = req.body || {};
      if (!email || !role) {
        return res.status(400).json({ error: 'email and role required' });
      }
      if (!['user', 'owner', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      const invited = await users.invite(email, role);
      res.json(invited);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || String(err) });
    }
  });

  return router;
}
