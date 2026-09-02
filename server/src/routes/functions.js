/**
 * Server functions routes (M7 / M8 / M8.5 / M15).
 * pushInAppNotification + finalizeReviewAutoPublish are internal-only
 * (entity hooks / delayed jobs) — no public HTTP (M15 #4 #22 #24).
 */
import { Router } from 'express';
import { requireAuth, requireOwnerOrAdmin } from '../middleware/auth.js';
import { geocodeAddresses } from '../lib/geocode-addresses.js';
import { addBookingToCalendar } from '../lib/add-booking-to-calendar.js';
import {
  handleSyncWebhookAck,
  syncGoogleCalendar,
} from '../lib/sync-google-calendar.js';
import { createCalendarConnectionStore } from '../lib/calendar-connection-store.js';
import { executeOwnerAssistantOp } from '../lib/owner-assistant-ops.js';
import { sendGuestMessage } from '../lib/send-guest-message.js';
import { sendSupplierMessage } from '../lib/send-supplier-message.js';
import { performCheckout } from '../lib/perform-checkout.js';
import { generateAIRecommendations } from '../lib/generate-ai-recommendations.js';

/**
 * @param {ReturnType<import('../lib/entity-store.js').createEntityStore>} store
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export function createFunctionsRouter(store, prisma) {
  const router = Router();
  const connections = createCalendarConnectionStore(prisma);

  router.post('/geocodeAddresses', requireAuth, async (req, res) => {
    try {
      const result = await geocodeAddresses(req.body?.addresses);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  // M15 #4 #24 — not exposed to clients
  router.post('/pushInAppNotification', (_req, res) => {
    res.status(403).json({ error: 'Forbidden: internal only' });
  });

  // M15 #22 — delayed jobs only
  router.post('/finalizeReviewAutoPublish', (_req, res) => {
    res.status(403).json({ error: 'Forbidden: internal only' });
  });

  router.post('/addBookingToCalendar', requireAuth, async (req, res) => {
    try {
      const result = await addBookingToCalendar(
        { store, connections },
        {
          bookingId: req.body?.booking_id,
          actor: req.actor || req.user,
        },
      );
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  // M15 #8ב — LLM assistant mutations with server whitelist + ownership checks
  router.post('/executeOwnerAssistantOp', requireAuth, async (req, res) => {
    try {
      const ownerId = req.body?.owner_id || req.user.id;
      const result = await executeOwnerAssistantOp(store, {
        operation: req.body?.operation,
        ownerId,
        actor: req.actor || req.user,
        ownerName: req.user?.full_name || '',
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/syncGoogleCalendar', async (req, res) => {
    try {
      const body = req.body || {};
      const ack = handleSyncWebhookAck(body);
      if (ack) return res.json(ack);

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      let ownerId = body.owner_id || req.user.id;
      if (req.user.role !== 'admin' && ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const result = await syncGoogleCalendar(
        { store, connections },
        { ownerId, fromWorkflow: false },
      );
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/performCheckout', requireAuth, async (req, res) => {
    try {
      const result = await performCheckout(store, req.body || {}, req.actor || req.user);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/sendGuestMessage', requireOwnerOrAdmin, async (req, res) => {
    try {
      const payload = { ...(req.body || {}) };
      if (req.user.role !== 'admin') {
        payload.owner_id = req.user.id;
        if (payload.booking_id) {
          const b = await store.get('BookingRequest', payload.booking_id, req.actor);
          if (b.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
          }
        }
      }
      const result = await sendGuestMessage(store, payload);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/sendSupplierMessage', requireOwnerOrAdmin, async (req, res) => {
    try {
      const result = await sendSupplierMessage(store, req.body || {}, req.actor || req.user);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/generateAIRecommendations', requireAuth, async (req, res) => {
    try {
      const result = await generateAIRecommendations(
        store,
        req.body || {},
        req.actor || req.user,
      );
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/sendStayMessages', (_req, res) => {
    res.status(403).json({ error: 'Forbidden: internal only' });
  });

  router.post('/sendScheduledSupplierMessages', (_req, res) => {
    res.status(403).json({ error: 'Forbidden: internal only' });
  });

  return router;
}

function sendError(res, err) {
  const status = err.status || 500;
  if (err.body) {
    res.status(status).json(err.body);
    return;
  }
  res.status(status).json({
    error: err instanceof Error ? err.message : String(err),
  });
}
