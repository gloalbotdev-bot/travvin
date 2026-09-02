/**
 * Assistant conversation persistence — Phase 5.
 * - Authenticated customers: ChatSession threads (GPT-like history on server).
 * - Owners/admins: append-only AssistantActionLog (no full chat thread).
 */
import { sanitizeUntrustedText } from '../sanitize-prompt-data.js';

const CUSTOMER_PERSIST_PROFILES = new Set(['customer_chat', 'customer_date_search']);
const OWNER_LOG_PROFILES = new Set([
  'owner_assistant',
  'owner_booking_creator',
  'owner_zimmer_creator',
  'admin_zimmer_editor',
]);

const MAX_STORED_MESSAGES = 200;
const MAX_TURN_CHARS = 2000;
const MAX_ACTION_LOG = 500;
const DEFAULT_ACTION_LOG_LIMIT = 15;

function isoTime() {
  return new Date().toISOString();
}

function truncate(text, max = MAX_TURN_CHARS) {
  return sanitizeUntrustedText(String(text || '')).slice(0, max);
}

function sessionMessagesToTurns(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.flatMap((m) => {
    if (!m || typeof m !== 'object') return [];
    const role = m.role === 'user' ? 'user' : m.role === 'bot' ? 'bot' : null;
    if (!role) return [];
    const content = truncate(m.content);
    if (!content) return [];
    return [{ role, content }];
  });
}

function shouldPersistCustomer(actor, profileId) {
  return !!actor?.id && actor.role === 'user' && CUSTOMER_PERSIST_PROFILES.has(profileId);
}

function shouldLogOwnerAction(actor, profileId) {
  return (
    !!actor?.id &&
    (actor.role === 'owner' || actor.role === 'admin') &&
    OWNER_LOG_PROFILES.has(profileId)
  );
}

/**
 * Load customer thread; validates ownership when conversationId is set.
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {import('../authz.js').Actor|null|undefined} actor
 * @param {string|null} conversationId
 * @param {string} profileId
 */
export async function prepareCustomerConversation(store, actor, conversationId, profileId) {
  if (!shouldPersistCustomer(actor, profileId)) {
    return { conversationId: null, recentTurns: [], sessionRow: null };
  }

  if (!conversationId) {
    return { conversationId: null, recentTurns: [], sessionRow: null };
  }

  try {
    const row = await store.get('ChatSession', conversationId, actor);
    if (row.user_id !== actor.id) {
      const err = new Error('Conversation not found');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    return {
      conversationId,
      recentTurns: sessionMessagesToTurns(row.messages),
      sessionRow: row,
    };
  } catch (e) {
    if (e.status === 403 || e.status === 404) {
      const err = new Error('Invalid conversationId');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    throw e;
  }
}

/**
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {import('../authz.js').Actor} actor
 * @param {{ id: string, email?: string, full_name?: string }} user
 * @param {{
 *   conversationId: string|null,
 *   sessionRow: object|null,
 *   profileId: string,
 *   userMessage: string,
 *   assistantContent: string,
 *   zimmerIds?: string[],
 *   bookingCreated?: boolean,
 * }} input
 * @returns {Promise<string|null>}
 */
export async function persistCustomerExchange(store, actor, user, input) {
  if (!shouldPersistCustomer(actor, input.profileId)) return null;

  const userTurn = {
    role: 'user',
    content: truncate(input.userMessage),
    time: isoTime(),
  };
  const botTurn = {
    role: 'bot',
    content: truncate(input.assistantContent),
    time: isoTime(),
  };

  let messages = Array.isArray(input.sessionRow?.messages)
    ? [...input.sessionRow.messages]
    : [];
  messages.push(userTurn, botTurn);
  if (messages.length > MAX_STORED_MESSAGES) {
    messages = messages.slice(-MAX_STORED_MESSAGES);
  }

  const zimmerIdsShown = [
    ...new Set([
      ...(input.sessionRow?.zimmer_ids_shown || []),
      ...(input.zimmerIds || []),
    ]),
  ];

  const payload = {
    user_id: user.id,
    user_name: user.full_name || '',
    user_email: user.email || '',
    messages,
    zimmer_ids_shown: zimmerIdsShown,
    booking_created:
      !!input.bookingCreated || !!input.sessionRow?.booking_created,
  };

  if (input.conversationId) {
    await store.update('ChatSession', input.conversationId, payload, actor);
    return input.conversationId;
  }

  const created = await store.create('ChatSession', payload, { actor });
  return created.id;
}

/**
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {import('../authz.js').Actor} actor
 * @param {{
 *   profile: string,
 *   actionType: string,
 *   summary: string,
 *   entityType?: string|null,
 *   entityId?: string|null,
 * }} entry
 */
export async function appendOwnerActionLog(store, actor, entry) {
  if (!shouldLogOwnerAction(actor, entry.profile)) return null;

  const row = await store.create(
    'AssistantActionLog',
    {
      owner_id: actor.id,
      owner_email: actor.email || '',
      profile: entry.profile,
      action_type: entry.actionType,
      summary: truncate(entry.summary, 500),
      entity_type: entry.entityType || undefined,
      entity_id: entry.entityId || undefined,
    },
    { actor },
  );

  return row.id;
}

/**
 * Recent owner assistant actions for prompt context (Phase 6+).
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {import('../authz.js').Actor} actor
 * @param {number} [limit]
 */
export async function loadRecentOwnerActions(store, actor, limit = DEFAULT_ACTION_LOG_LIMIT) {
  if (!actor?.id || (actor.role !== 'owner' && actor.role !== 'admin')) {
    return [];
  }
  const capped = Math.min(Math.max(1, limit), MAX_ACTION_LOG);
  const rows = await store.filter(
    'AssistantActionLog',
    { owner_id: actor.id },
    '-created_date',
    capped,
    actor,
  );
  return rows;
}

export function mergeClientStateWithConversation(clientState, conversation) {
  const base =
    clientState && typeof clientState === 'object' && !Array.isArray(clientState)
      ? { ...clientState }
      : {};

  if (conversation.conversationId && conversation.recentTurns.length > 0) {
    base.recentTurns = conversation.recentTurns;
  }

  return base;
}

export function collectZimmerIdsFromResponse(uiEffects, parsed) {
  const ids = new Set();
  for (const effect of uiEffects || []) {
    if (Array.isArray(effect.zimmerIds)) {
      effect.zimmerIds.forEach((id) => ids.add(id));
    }
    if (effect.zimmerId) ids.add(effect.zimmerId);
  }
  if (Array.isArray(parsed?.zimmer_ids)) {
    parsed.zimmer_ids.forEach((id) => ids.add(id));
  }
  if (parsed?.zimmer_id) ids.add(parsed.zimmer_id);
  return [...ids];
}
