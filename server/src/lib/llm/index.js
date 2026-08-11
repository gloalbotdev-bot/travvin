/**
 * InvokeLLM facade — same contract as Base44 Core.InvokeLLM.
 * Provider: Gemini only (single GEMINI_API_KEY) — decisions.md §5.
 * { prompt, response_json_schema?, add_context_from_internet?, model? }
 * → string (no schema) | object (with schema)
 */
import { invokeGemini } from './gemini.js';

/**
 * @param {object} payload
 * @param {{ fetchImpl?: typeof fetch }} [deps]
 */
export async function invokeLlm(payload = {}, deps = {}) {
  const prompt = payload.prompt;
  if (prompt == null || String(prompt).trim() === '') {
    const err = new Error('prompt required');
    err.status = 400;
    throw err;
  }

  if (process.env.LLM_MOCK === '1') {
    return mockInvoke(payload);
  }

  return invokeGemini({
    prompt: String(prompt),
    model: payload.model,
    response_json_schema: payload.response_json_schema,
    add_context_from_internet: payload.add_context_from_internet === true,
    fetchImpl: deps.fetchImpl,
  });
}

function mockInvoke(payload) {
  if (payload.response_json_schema) {
    return {
      action: 'ask',
      message: 'תשובת mock בעברית',
      zimmer_ids: [],
    };
  }
  return 'תשובת mock בעברית';
}
