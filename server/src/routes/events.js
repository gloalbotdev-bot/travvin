/**
 * SSE entity change stream (M6b).
 *
 *   GET /api/events/entities/:entity
 *
 * EventSource cannot send Authorization headers — token via ?token= is supported
 * (see auth middleware).
 */
import { Router } from 'express';
import { entityEvents } from '../lib/entity-events.js';
import { can } from '../lib/authz.js';
import { getEntityMeta } from '../lib/schema-loader.js';
import { requireAuth } from '../middleware/auth.js';

const HEARTBEAT_MS = 30_000;

export function createEventsRouter() {
  const router = Router();

  router.get('/entities/:entity', requireAuth, (req, res) => {
    let entityType;
    try {
      getEntityMeta(req.params.entity);
      entityType = req.params.entity;
    } catch {
      return res.status(404).json({ error: 'Unknown entity' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const actor = req.actor;

    /** @param {{ type: string, id: string, data?: object }} event */
    const onEvent = (event) => {
      if (event.type === 'delete') {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        return;
      }
      if (event.data && can(entityType, 'read', actor, event.data)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    entityEvents.on(entityType, onEvent);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, HEARTBEAT_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      entityEvents.off(entityType, onEvent);
    });
  });

  return router;
}
