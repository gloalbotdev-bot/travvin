/**
 * Assistant API — Phase 2 skeleton (parallel to /api/ai/invoke-llm).
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { handleAssistantChat } from '../lib/assistant/assistant-service.js';
import { AI_PROFILE_BASELINES } from '../lib/assistant/profiles.js';

const guestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.ASSISTANT_GUEST_RATE_LIMIT || 30),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  skip: (req) => !!req.user,
  message: { error: 'Too many requests', code: 'RATE_LIMIT' },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.ASSISTANT_AUTH_RATE_LIMIT || 60),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  skip: (req) => !req.user,
  message: { error: 'Too many requests', code: 'RATE_LIMIT' },
});

export function createAssistantRouter(deps = {}) {
  const router = Router();
  const { prisma, store } = deps;

  router.get('/profiles', (_req, res) => {
    res.json({
      profiles: AI_PROFILE_BASELINES.map((p) => ({
        id: p.id,
        responseMode: p.responseMode,
      })),
    });
  });

  router.post('/chat', guestLimiter, authLimiter, async (req, res) => {
    try {
      const result = await handleAssistantChat(req.body, req.actor || req.user, {
        prisma,
        store,
        user: req.user || null,
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

function sendError(res, err) {
  const status = err.status || 500;
  res.status(status).json({
    error: err instanceof Error ? err.message : String(err),
    code: err.code || (status === 500 ? 'INTERNAL' : 'ERROR'),
  });
}
