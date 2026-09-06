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
import { getVideoFeed } from '../lib/video-feed.js';
import { toggleVideoLike } from '../lib/video-likes.js';
import {
  createZimmerVideo,
  deleteVideo,
  listOwnerVideos,
  setVideoVisibility,
  setVideoCommentsHidden,
  updateVideoCaption,
} from '../lib/video-owner.js';
import { createVideoProposal, respondVideoProposal } from '../lib/video-proposal.js';
import { searchIsraelAddresses } from '../lib/israel-address-search.js';
import { buildGuestSummary } from '../lib/build-guest-summary.js';
import { appendChatMessage, splitCustomerChat } from '../lib/chat-session-write.js';
import { getOwnerStatistics } from '../lib/get-owner-statistics.js';

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

  router.post('/autoCheckoutExpiredStays', (_req, res) => {
    res.status(403).json({ error: 'Forbidden: internal only' });
  });

  router.post('/getVideoFeed', async (req, res) => {
    try {
      const result = await getVideoFeed(store, { actor: req.actor || null });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/toggleVideoLike', requireAuth, async (req, res) => {
    try {
      const result = await toggleVideoLike(store, {
        video_id: req.body?.video_id,
        actor: req.actor || req.user,
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/createZimmerVideo', requireAuth, async (req, res) => {
    try {
      const result = await createZimmerVideo(store, {
        zimmer_id: req.body?.zimmer_id,
        video_url: req.body?.video_url,
        caption: req.body?.caption,
        actor: req.actor || req.user,
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/deleteVideo', requireAuth, async (req, res) => {
    try {
      const result = await deleteVideo(store, {
        video_id: req.body?.video_id,
        actor: req.actor || req.user,
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/listOwnerVideos', requireAuth, async (req, res) => {
    try {
      const result = await listOwnerVideos(store, { actor: req.actor || req.user });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/setVideoVisibility', requireAuth, async (req, res) => {
    try {
      const result = await setVideoVisibility(store, {
        video_id: req.body?.video_id,
        hidden: req.body?.hidden,
        actor: req.actor || req.user,
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/setVideoCommentsHidden', requireAuth, async (req, res) => {
    try {
      const result = await setVideoCommentsHidden(store, {
        zimmer_id: req.body?.zimmer_id,
        comments_hidden: req.body?.comments_hidden,
        actor: req.actor || req.user,
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/updateVideoCaption', requireAuth, async (req, res) => {
    try {
      const result = await updateVideoCaption(store, {
        video_id: req.body?.video_id,
        caption: req.body?.caption,
        actor: req.actor || req.user,
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/createVideoProposal', requireAuth, async (req, res) => {
    try {
      const result = await createVideoProposal(store, {
        zimmer_id: req.body?.zimmer_id,
        video_url: req.body?.video_url,
        caption: req.body?.caption,
        note: req.body?.note,
        actor: req.actor || req.user,
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/respondVideoProposal', requireAuth, async (req, res) => {
    try {
      const result = await respondVideoProposal(store, {
        video_id: req.body?.video_id,
        decision: req.body?.decision,
        actor: req.actor || req.user,
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/searchIsraelAddresses', requireAuth, async (req, res) => {
    try {
      const result = await searchIsraelAddresses(req.body || {});
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/buildGuestSummary', requireAuth, async (req, res) => {
    try {
      const result = await buildGuestSummary(store, req.body || {}, req.actor || req.user);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/appendChatMessage', requireAuth, async (req, res) => {
    try {
      const result = await appendChatMessage(store, req.body || {}, req.actor || req.user);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/splitCustomerChat', requireAuth, async (req, res) => {
    try {
      const result = await splitCustomerChat(store, req.body || {}, req.actor || req.user);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/getOwnerStatistics', requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const result = await getOwnerStatistics(store, req.actor || req.user);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
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
