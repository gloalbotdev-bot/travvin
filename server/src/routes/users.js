/**
 * users.inviteUser — faithful restore (no server admin gate; deferred-fix #1).
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
      const { email, role } = req.body || {};
      if (!email || !role) {
        return res.status(400).json({ error: 'email and role required' });
      }
      const invited = await users.invite(email, role);
      res.json(invited);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || String(err) });
    }
  });

  return router;
}
