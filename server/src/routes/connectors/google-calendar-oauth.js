/**
 * Google Calendar connector routes (M8) — per-owner OAuth.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  buildCalendarAuthUrl,
  exchangeCalendarCode,
  isCalendarGoogleConfigured,
} from '../../lib/google-calendar-oauth.js';
import { createCalendarConnectionStore } from '../../lib/calendar-connection-store.js';
import { decryptSecret } from '../../lib/token-crypto.js';
import { SERVICE_ACTOR } from '../../lib/service-role.js';
import { signCalendarOAuthState, verifyCalendarOAuthState } from '../../lib/jwt.js';
import { CalendarConnectionStatus } from '@prisma/client';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {ReturnType<import('../../lib/entity-store.js').createEntityStore>} store
 */
export function createGoogleCalendarConnectorRouter(prisma, store) {
  const router = Router();
  const connections = createCalendarConnectionStore(prisma);

  router.get('/oauth', requireAuth, (req, res) => {
    if (!isCalendarGoogleConfigured()) {
      return res.status(503).json({ error: 'Google Calendar OAuth not configured' });
    }
    const role = req.user?.role;
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Only owners can connect calendar' });
    }
    const ownerId = req.user.id;
    const state = signCalendarOAuthState({
      ownerId,
      redirect: typeof req.query.redirect === 'string' ? req.query.redirect : '/owner',
    });
    res.redirect(buildCalendarAuthUrl({ state }));
  });

  router.get('/oauth/callback', async (req, res) => {
    const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
    try {
      const { code, state, error } = req.query;
      if (error) {
        return res.redirect(
          `${frontend}/owner?calendar_error=${encodeURIComponent(String(error))}`,
        );
      }
      const claims = verifyCalendarOAuthState(String(state || ''));
      if (!claims?.ownerId) {
        return res.redirect(`${frontend}/owner?calendar_error=invalid_state`);
      }
      const tokens = await exchangeCalendarCode(String(code));
      let refreshToken = tokens.refresh_token || null;
      if (!refreshToken) {
        // Google often omits refresh_token on re-consent; reuse existing encrypted token.
        const prior = await connections.find(claims.ownerId);
        if (
          prior?.refreshTokenEnc &&
          prior.status === CalendarConnectionStatus.active
        ) {
          try {
            const prev = decryptSecret(prior.refreshTokenEnc);
            if (prev && prev !== 'revoked') refreshToken = prev;
          } catch {
            /* fall through */
          }
        }
      }
      if (!refreshToken) {
        return res.redirect(
          `${frontend}/owner?calendar_error=${encodeURIComponent('missing_refresh_token')}`,
        );
      }
      await connections.upsertFromOAuth(claims.ownerId, {
        refreshToken,
        accessToken: tokens.access_token,
        scopes: tokens.scope,
      });

      const existing = await store.filter(
        'SyncState',
        { owner_id: claims.ownerId, provider: 'google' },
        undefined,
        undefined,
        SERVICE_ACTOR,
      );
      if (!existing.length) {
        await store.create(
          'SyncState',
          {
            owner_id: claims.ownerId,
            provider: 'google',
            auto_sync: true,
            last_status: 'ok',
          },
          {
            actor: SERVICE_ACTOR,
            createdById: claims.ownerId,
            createdBy: null,
          },
        );
      }

      const dest = typeof claims.redirect === 'string' ? claims.redirect : '/owner';
      res.redirect(`${frontend}${dest.startsWith('/') ? dest : '/owner'}?calendar=connected`);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      console.error('[google-calendar/oauth/callback]', raw);
      // Keep redirect short/user-safe (avoid dumping Prisma internals into the URL/UI).
      let code = 'save_failed';
      if (/P1001|Can't reach database/i.test(raw)) code = 'db_unreachable';
      else if (/calendar_connections|does not exist|P2021/i.test(raw)) code = 'db_schema_missing';
      else if (/Foreign key|P2003/i.test(raw)) code = 'owner_not_found';
      else if (/missing_refresh_token/i.test(raw)) code = 'missing_refresh_token';
      res.redirect(`${frontend}/owner?calendar_error=${encodeURIComponent(code)}`);
    }
  });

  router.get('/status', requireAuth, async (req, res) => {
    try {
      const row = await connections.find(req.user.id);
      res.json(connections.toPublic(row));
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.delete('/', requireAuth, async (req, res) => {
    try {
      await connections.revoke(req.user.id);
      res.json({ ok: true, connected: false });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  return router;
}
