/**
 * AI routes — M10 InvokeLLM.
 * No auth: guests use /chat and /desktop-search (faithful to Base44 SDK).
 */
import { Router } from 'express';
import { invokeLlm } from '../lib/llm/index.js';

export function createAiRouter() {
  const router = Router();

  router.post('/invoke-llm', async (req, res) => {
    try {
      const result = await invokeLlm(req.body || {});
      // Wrap so string results stay strings after JSON serialization on the client unwrap.
      res.json({ result });
    } catch (err) {
      const status = err?.status || 500;
      res.status(status).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
