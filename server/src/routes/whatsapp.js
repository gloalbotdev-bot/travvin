/**
 * WhatsApp HTTP routes — provider-agnostic. Verification and payload parsing live in
 * lib/whatsapp/providers/*; these handlers only see normalized InboundEvents.
 *
 * - createWhatsAppRouter: public webhook. Mounted BEFORE the global JSON parser so providers
 *   that sign the raw body (Meta) can verify it.
 * - createWhatsAppAdminRouter: admin status + test send. Mounted after auth.
 */
import express, { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { SERVICE_ACTOR } from '../lib/service-role.js';
import {
  createWhatsAppProvider,
  isWhatsAppEnabled,
  sendWhatsAppText,
  whatsAppOutboxStats,
} from '../lib/whatsapp/index.js';

/** @param {import('../lib/whatsapp/contract.js').InboundEvent[]} events */
function logInboundEvents(events) {
  for (const e of events) {
    console.log(
      '[whatsapp] inbound',
      e.type === 'message' ? `message kind=${e.kind}` : `status=${e.status}`,
    );
  }
}

/**
 * @param {{
 *   store: ReturnType<import('../lib/entity-store.js').createEntityStore>,
 *   onEvents?: (events: import('../lib/whatsapp/contract.js').InboundEvent[]) => unknown,
 * }} deps
 */
export function createWhatsAppRouter({ store, onEvents = logInboundEvents }) {
  const router = Router();
  // Built once at boot so a bad WHATSAPP_PROVIDER fails fast.
  const provider = createWhatsAppProvider({ store });

  router.get('/webhook', (req, res) => {
    const challenge = provider.answerWebhookChallenge(req.query);
    if (!challenge) return res.sendStatus(404);
    return res.status(challenge.status).type('text/plain').send(challenge.body);
  });

  router.post(
    '/webhook',
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        /** @type {any} */ (req).rawBody = buf;
      },
    }),
    async (req, res) => {
      if (!provider.supportsInbound) return res.sendStatus(404);
      const verified = provider.verifyWebhook({
        headers: req.headers,
        query: req.query,
        rawBody: /** @type {any} */ (req).rawBody,
      });
      if (!verified) return res.sendStatus(401);

      let events;
      try {
        events = provider.parseWebhook(req.body);
      } catch (e) {
        console.error('[whatsapp] webhook parse failed:', e instanceof Error ? e.message : e);
        return res.sendStatus(400);
      }

      // Ack before handling — providers retry slow or failed deliveries.
      res.sendStatus(200);
      try {
        await onEvents(events);
      } catch (e) {
        console.error('[whatsapp] inbound handler failed:', e instanceof Error ? e.message : e);
      }
    },
  );

  return router;
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden: admin only' });
  next();
}

/**
 * @param {{ store: ReturnType<import('../lib/entity-store.js').createEntityStore> }} deps
 */
export function createWhatsAppAdminRouter({ store }) {
  const router = Router();

  router.get('/status', requireAuth, requireAdmin, async (_req, res) => {
    const provider = createWhatsAppProvider({ store });
    const [health, usage, recentFailures] = await Promise.all([
      provider.health ? provider.health() : null,
      provider.getUsage ? provider.getUsage() : null,
      store.filter('WhatsAppMessage', { status: 'failed' }, '-created_date', 20, SERVICE_ACTOR),
    ]);
    res.json({
      enabled: isWhatsAppEnabled(),
      provider: provider.name,
      inbound: provider.supportsInbound,
      health,
      usage,
      outbox: whatsAppOutboxStats(),
      recentFailures: recentFailures.map((m) => ({
        id: m.id,
        created_date: m.created_date,
        phone: m.phone,
        source: m.source,
        intent: m.intent,
        error: m.error,
      })),
    });
  });

  router.post('/test-send', requireAuth, requireAdmin, async (req, res) => {
    const to = typeof req.body?.to === 'string' ? req.body.to : '';
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (!to || !text.trim()) return res.status(400).json({ error: 'to and text required' });
    const result = await sendWhatsAppText(store, {
      to,
      text,
      source: 'manual',
      intent: 'admin.test',
      userId: req.user.id,
    });
    res.status(result.ok ? 200 : 502).json(result);
  });

  return router;
}
