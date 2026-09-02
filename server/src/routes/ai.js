/**
 * AI routes — M10 InvokeLLM (deprecated Phase 8; use /api/assistant/chat).
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const guestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.LLM_GUEST_RATE_LIMIT || 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  skip: (req) => !!req.user,
  message: { error: 'Too many requests' },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.LLM_AUTH_RATE_LIMIT || 60),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  skip: (req) => !req.user,
  message: { error: 'Too many requests' },
});

/**
 * @param {object} body
 * @param {{ id?: string, role?: string } | null | undefined} user
 */
export function applyLlmGuestCaps(body, user) {
  const payload = { ...(body || {}) };
  const maxPrompt = user?.id ? 32 * 1024 : 16 * 1024;
  if (String(payload.prompt || '').length > maxPrompt) {
    const err = new Error('prompt too long');
    err.status = 400;
    throw err;
  }
  if (!user?.id) {
    if (payload.add_context_from_internet === true) {
      const err = new Error('Forbidden: internet context requires authentication');
      err.status = 403;
      throw err;
    }
    delete payload.model;
  }
  return payload;
}

export function createAiRouter() {
  const router = Router();

  router.post('/invoke-llm', guestLimiter, authLimiter, (_req, res) => {
    res.status(410).json({
      error:
        'POST /api/ai/invoke-llm is deprecated. Use POST /api/assistant/chat with a profile instead.',
      code: 'DEPRECATED',
    });
  });

  return router;
}
