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

/**
 * @param {unknown} body
 * @returns {{ profile: string, message: string, conversationId: string|null, clientState: object|null }}
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
    if (serialized.length > MAX_CLIENT_STATE_JSON) {
      const err = new Error('clientState too large');
      err.status = 400;
      err.code = 'VALIDATION';
      throw err;
    }
    clientState = body.clientState;
  }

  return {
    profile: profile.trim(),
    message: message.trim(),
    conversationId,
    clientState,
  };
}
