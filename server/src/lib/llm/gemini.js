/**
 * Gemini-only InvokeLLM provider (single API key).
 * Text, JSON schema, and optional Google Search grounding.
 * Retries alternate models on high-demand / capacity errors.
 */
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const MODEL_MAP = {
  gemini_3_flash: DEFAULT_MODEL,
  gemini_flash: DEFAULT_MODEL,
};

/** Tried in order after the primary model when Google returns capacity errors. */
const FALLBACK_MODELS = (
  process.env.GEMINI_FALLBACK_MODELS ||
  'gemini-3.6-flash,gemini-flash-latest,gemini-3.1-flash-lite'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {string} [opts.model]
 * @param {object} [opts.response_json_schema]
 * @param {boolean} [opts.add_context_from_internet]
 * @param {typeof fetch} [opts.fetchImpl]
 */
export async function invokeGemini({
  prompt,
  model,
  response_json_schema,
  add_context_from_internet = false,
  fetchImpl = fetch,
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.status = 503;
    throw err;
  }

  const primary = resolveModel(model);
  const candidates = [
    primary,
    ...FALLBACK_MODELS.filter((m) => m !== primary),
  ];

  const body = buildRequestBody({
    prompt,
    response_json_schema,
    add_context_from_internet,
  });

  const JSON_PARSE_ATTEMPTS = 3;
  let lastErr = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const mapped = candidates[i];
    for (let attempt = 0; attempt < JSON_PARSE_ATTEMPTS; attempt += 1) {
      try {
        return await callGeminiOnce({
          apiKey,
          model: mapped,
          body,
          response_json_schema,
          fetchImpl,
        });
      } catch (err) {
        lastErr = err;
        if (isParseError(err) && attempt < JSON_PARSE_ATTEMPTS - 1) {
          console.warn(
            `[llm] ${mapped} non-JSON response — retry ${attempt + 2}/${JSON_PARSE_ATTEMPTS}`,
          );
          continue;
        }
        const retryable = isCapacityError(err);
        if (!retryable || i === candidates.length - 1) throw err;
        console.warn(
          `[llm] ${mapped} busy/unavailable — trying ${candidates[i + 1]}`,
        );
        break;
      }
    }
  }
  throw lastErr;
}

function buildRequestBody({
  prompt,
  response_json_schema,
  add_context_from_internet,
}) {
  let userText = String(prompt || '');
  /** @type {Record<string, unknown>} */
  const body = {
    contents: [{ role: 'user', parts: [{ text: userText }] }],
  };

  if (add_context_from_internet) {
    body.tools = [{ google_search: {} }];
  }

  if (response_json_schema) {
    const geminiSchema = toGeminiSchema(response_json_schema);
    /** @type {Record<string, unknown>} */
    const generationConfig = {
      responseMimeType: 'application/json',
    };
    if (geminiSchema) {
      generationConfig.responseSchema = geminiSchema;
    } else {
      userText = `${userText}\n\nRespond with a single JSON object matching this schema (no markdown):\n${JSON.stringify(response_json_schema)}`;
      body.contents = [{ role: 'user', parts: [{ text: userText }] }];
    }
    body.generationConfig = generationConfig;
  }

  return body;
}

async function callGeminiOnce({
  apiKey,
  model,
  body,
  response_json_schema,
  fetchImpl,
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error ||
      `Gemini error ${res.status}`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.code = data?.error?.status || data?.error?.code;
    throw err;
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p) => p.text || '').join('')
    : '';
  if (!text) {
    const err = new Error('Gemini returned empty content');
    err.status = 502;
    throw err;
  }

  if (response_json_schema) {
    try {
      return parseJsonFromLlmText(text);
    } catch {
      const err = new Error('Gemini returned non-JSON content for schema request');
      err.status = 502;
      err.code = 'JSON_PARSE';
      throw err;
    }
  }

  return text;
}

/**
 * Parse JSON from Gemini text output — tolerates markdown fences and stray backticks.
 * @param {string} text
 */
export function parseJsonFromLlmText(text) {
  let s = String(text || '').trim();
  const fenced = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    s = fenced[1].trim();
  } else {
    if (s.startsWith('```json')) s = s.slice(7).trim();
    else if (s.startsWith('```')) s = s.slice(3).trim();
    if (s.endsWith('```')) s = s.slice(0, -3).trim();
  }
  s = s.replace(/`+$/, '').trim();
  return JSON.parse(s);
}

function isParseError(err) {
  return err?.code === 'JSON_PARSE';
}

function isCapacityError(err) {
  const msg = String(err?.message || '').toLowerCase();
  const status = err?.status;
  return (
    status === 429 ||
    status === 503 ||
    /high demand|overloaded|resource.?exhausted|unavailable|try again later|quota/i.test(
      msg,
    )
  );
}

function resolveModel(model) {
  if (model && MODEL_MAP[model]) return MODEL_MAP[model];
  if (typeof model === 'string' && model.startsWith('gemini-')) return model;
  if (typeof model === 'string' && model.startsWith('gemini_')) {
    return MODEL_MAP[model] || DEFAULT_MODEL;
  }
  return DEFAULT_MODEL;
}

/**
 * Convert Base44/JSON Schema subset → Gemini responseSchema, or null if unsupported.
 * @param {object} schema
 * @returns {object|null}
 */
export function toGeminiSchema(schema) {
  try {
    return convertNode(structuredClone(schema));
  } catch {
    return null;
  }
}

function convertNode(node) {
  if (!node || typeof node !== 'object') {
    throw new Error('invalid node');
  }

  if (Array.isArray(node.type)) {
    const nonNull = node.type.filter((t) => t !== 'null');
    if (nonNull.length !== 1) throw new Error('union types');
    node.type = nonNull[0];
  }

  if (node.type === 'object' || (!node.type && node.properties)) {
    if (node.additionalProperties === true) {
      throw new Error('additionalProperties');
    }
    if (!node.properties || typeof node.properties !== 'object') {
      throw new Error('bare object');
    }
    const outProps = {};
    for (const [k, v] of Object.entries(node.properties)) {
      outProps[k] = convertNode(v);
    }
    const out = {
      type: 'OBJECT',
      properties: outProps,
    };
    const keys = Object.keys(outProps);
    if (keys.length) out.required = node.required || keys;
    return out;
  }

  if (node.type === 'array') {
    if (!node.items) throw new Error('array items');
    return {
      type: 'ARRAY',
      items: convertNode(node.items),
    };
  }

  if (node.type === 'string') {
    const out = { type: 'STRING' };
    if (Array.isArray(node.enum)) out.enum = node.enum;
    return out;
  }
  if (node.type === 'number' || node.type === 'integer') {
    return { type: node.type === 'integer' ? 'INTEGER' : 'NUMBER' };
  }
  if (node.type === 'boolean') {
    return { type: 'BOOLEAN' };
  }

  throw new Error(`unsupported type ${node.type}`);
}
