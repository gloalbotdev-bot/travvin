/**
 * Role-access requests — user↔owner dual-role / switch approval by admin.
 */
import { Router } from 'express';
import { verifyRoleAccessRequestToken } from '../lib/jwt.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { createUserStore } from '../lib/user-store.js';
import { SERVICE_ACTOR } from '../lib/service-role.js';

const VALID_TO = new Set(['user', 'owner']);

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {ReturnType<import('../lib/entity-store.js').createEntityStore>} store
 */
export function createRoleAccessRequestsRouter(prisma, store) {
  const router = Router();
  const users = createUserStore(prisma);

  /** List pending (admin). */
  router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
      const status = String(req.query.status || 'pending');
      const rows = await store.filter(
        'RoleAccessRequest',
        { status },
        '-created_date',
        100,
        req.actor,
      );
      res.json(rows);
    } catch (err) {
      sendErr(res, err);
    }
  });

  /**
   * Create request — either via short-lived request_token (OAuth mismatch)
   * or authenticated session (RoleGate).
   */
  router.post('/', async (req, res) => {
    try {
      const token = String(req.body?.request_token || '').trim();
      let userId;
      let email;
      let fromRole;
      let toRole;

      if (token) {
        const claims = verifyRoleAccessRequestToken(token);
        if (!claims) {
          return res.status(400).json({ error: 'Invalid or expired request token' });
        }
        userId = claims.userId;
        email = claims.email;
        fromRole = claims.fromRole;
        toRole = claims.toRole;
      } else if (req.user) {
        toRole = String(req.body?.to_role || '').trim();
        fromRole = req.user.role === 'owner' || req.user.role === 'user' ? req.user.role : null;
        if (!fromRole || !VALID_TO.has(toRole) || fromRole === toRole) {
          return res.status(400).json({ error: 'Invalid from/to role' });
        }
        if (req.user.role === 'admin') {
          return res.status(400).json({ error: 'Admins do not need role-access requests' });
        }
        userId = req.user.id;
        email = req.user.email;
      } else {
        return res.status(401).json({ error: 'Authentication or request_token required' });
      }

      if (!VALID_TO.has(fromRole) || !VALID_TO.has(toRole) || fromRole === toRole) {
        return res.status(400).json({ error: 'Invalid from/to role' });
      }

      const row = await users.findById(userId);
      if (!row) return res.status(404).json({ error: 'User not found' });
      if (row.role === 'admin') {
        return res.status(400).json({ error: 'Admins do not need role-access requests' });
      }

      const existing = await store.filter(
        'RoleAccessRequest',
        { user_id: userId, to_role: toRole, status: 'pending' },
        '-created_date',
        5,
        SERVICE_ACTOR,
      );
      if (existing.length) {
        return res.status(200).json({ ...existing[0], already_pending: true });
      }

      const created = await store.create(
        'RoleAccessRequest',
        {
          user_id: userId,
          user_email: (email || row.email || '').toLowerCase(),
          from_role: fromRole,
          to_role: toRole,
          status: 'pending',
        },
        { actor: SERVICE_ACTOR },
      );
      res.status(201).json(created);
    } catch (err) {
      sendErr(res, err);
    }
  });

  /**
   * Admin decision: switch | both | reject
   * body: { decision: 'switch'|'both'|'reject' }
   */
  router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const decision = String(req.body?.decision || '').trim();
      if (!['switch', 'both', 'reject'].includes(decision)) {
        return res.status(400).json({ error: 'decision must be switch, both, or reject' });
      }

      const current = await store.get('RoleAccessRequest', id, req.actor);
      if (!current) return res.status(404).json({ error: 'Request not found' });
      if (current.status !== 'pending') {
        return res.status(409).json({ error: 'Request already resolved' });
      }

      if (decision === 'reject') {
        const updated = await store.update(
          'RoleAccessRequest',
          id,
          { status: 'rejected' },
          req.actor,
        );
        return res.json(updated);
      }

      const targetUser = await users.findById(current.user_id);
      if (!targetUser) return res.status(404).json({ error: 'User not found' });
      if (targetUser.role === 'admin') {
        return res.status(409).json({ error: 'Cannot change admin via role-access request' });
      }

      if (decision === 'switch') {
        await users.update(current.user_id, {
          role: current.to_role,
          allowedRoles: null,
        });
        const updated = await store.update(
          'RoleAccessRequest',
          id,
          { status: 'approved_switch' },
          req.actor,
        );
        return res.json(updated);
      }

      // both
      await users.update(current.user_id, {
        allowedRoles: ['user', 'owner'],
      });
      const updated = await store.update(
        'RoleAccessRequest',
        id,
        { status: 'approved_both' },
        req.actor,
      );
      res.json(updated);
    } catch (err) {
      sendErr(res, err);
    }
  });

  return router;
}

function sendErr(res, err) {
  res.status(err.status || 500).json({ error: err.message || String(err) });
}
