/**
 * AI routes — M10 InvokeLLM + TranscribeAudio (ported UI compatibility).
 * Prefer /api/assistant/chat for new assistant flows.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { invokeLlm } from '../lib/llm/index.js';
import { transcribeAudioUrl } from '../lib/transcribe-audio.js';
import { requireAuth } from '../middleware/auth.js';

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

  router.post('/invoke-llm', guestLimiter, authLimiter, async (req, res) => {
    try {
      const payload = applyLlmGuestCaps(req.body, req.user);
      const result = await invokeLlm(payload);
      res.json(result);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post('/transcribe-audio', requireAuth, guestLimiter, authLimiter, async (req, res) => {
    try {
      const audioUrl = req.body?.audio_url;
      if (!audioUrl) {
        return res.status(400).json({ error: 'audio_url required' });
      }
      const text = await transcribeAudioUrl(String(audioUrl));
      // Always return an object so clients never confuse a JSON string body.
      res.json({ text: typeof text === 'string' ? text : String(text || '') });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
