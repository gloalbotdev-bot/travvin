/**
 * Validates POST /api/assistant/chat body — client may not send prompts or auth fields.
 */

const FORBIDDEN_KEYS = new Set([
  'prompt',
  'response_json_schema',
  'responseJsonSchema',
  'system',
  'system_prompt',
  'systemPrompt',
  'role',
  'owner_id',
  'ownerId',
  'user_id',
  'userId',
  'actor',
  'operation',
  'operations',
  'history',
  'messages',
  'context',
  'privileged_context',
  'schema',
  'model',
  'add_context_from_internet',
  'addContextFromInternet',
]);

const MAX_MESSAGE_LEN = 4000;
const MAX_CLIENT_STATE_JSON = 8192;
/** Owner wizards carry long collected state + up to 100 turns until the shared thread holds it. */
const MAX_OWNER_CLIENT_STATE_JSON = 65536;

export const OWNER_PANEL_PROFILES = new Set([
  'owner_assistant',
  'owner_booking_creator',
  'owner_zimmer_creator',
  'admin_zimmer_editor',
  'owner_calendar_day_advice',
  'owner_calendar_suggestions',
  'owner_home_suggestions',
  'owner_reply_draft',
]);
const MAX_ATTACHMENTS = 5;
const UPLOAD_PATH_RE = /^\/(?:uploads|api\/upload)\/[A-Za-z0-9._-]+$/;

function attachmentPath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return null;
    }
  }
  return UPLOAD_PATH_RE.test(pathname) ? pathname : null;
}

function validateAttachments(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS) {
    const err = new Error(`attachments must be an array of up to ${MAX_ATTACHMENTS} upload URLs`);
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }
  return value.map((v) => {
    const p = attachmentPath(v);
    if (!p) {
      const err = new Error('attachments must reference app upload storage');
      err.status = 400;
      err.code = 'VALIDATION';
      throw err;
    }
    return p;
  });
}

/**
 * @param {unknown} body
 * @returns {{ profile: string, message: string, conversationId: string|null, clientState: object|null, attachments: string[] }}
 */
export function validateChatRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const err = new Error('Invalid request body');
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }

  for (const key of Object.keys(body)) {
    if (FORBIDDEN_KEYS.has(key)) {
      const err = new Error(`Forbidden request field: ${key}`);
      err.status = 400;
      err.code = 'FORBIDDEN_FIELD';
      throw err;
    }
  }

  const profile = body.profile;
  if (typeof profile !== 'string' || !profile.trim()) {
    const err = new Error('profile required');
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }

  const message = body.message;
  if (typeof message !== 'string' || !message.trim()) {
    const err = new Error('message required');
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }
  if (message.length > MAX_MESSAGE_LEN) {
    const err = new Error('message too long');
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }

  let conversationId = null;
  if (body.conversationId != null && body.conversationId !== '') {
    if (typeof body.conversationId !== 'string') {
      const err = new Error('conversationId must be a string');
      err.status = 400;
      err.code = 'VALIDATION';
      throw err;
    }
    conversationId = body.conversationId.trim();
  }

  let clientState = null;
  if (body.clientState != null) {
    if (typeof body.clientState !== 'object' || Array.isArray(body.clientState)) {
      const err = new Error('clientState must be an object');
      err.status = 400;
      err.code = 'VALIDATION';
      throw err;
    }
    const serialized = JSON.stringify(body.clientState);
    const limit = OWNER_PANEL_PROFILES.has(String(profile).trim())
      ? MAX_OWNER_CLIENT_STATE_JSON
      : MAX_CLIENT_STATE_JSON;
    if (serialized.length > limit) {
      const err = new Error('clientState too large');
      err.status = 400;
      err.code = 'VALIDATION';
      throw err;
    }
    clientState = body.clientState;
  }

  const attachments = validateAttachments(body.attachments);

  return {
    profile: profile.trim(),
    message: message.trim(),
    conversationId,
    clientState,
    attachments,
  };
}
