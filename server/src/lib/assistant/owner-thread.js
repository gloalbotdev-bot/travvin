/**
 * Shared owner assistant thread — one memory for every owner-panel bubble.
 * Written only by the server (service actor); owners read their own thread.
 * Admins never write to an owner's thread.
 */
import { randomUUID } from 'node:crypto';
import { SERVICE_ACTOR } from '../service-role.js';
import { sanitizeOwnerText } from '../sanitize-prompt-data.js';

export const MAX_THREAD_MESSAGES = 300;
export const THREAD_MEMORY_TURNS = 12;

export const SURFACE_LABELS = {
  home: 'בית',
  calendar: 'יומן',
  bookings: 'הזמנות',
  messages: 'הודעות',
  booking_creator: 'הוספת הזמנה',
  zimmer_creator: 'צימר חדש',
  zimmer_editor: 'עריכת צימר',
};

export function normalizeSurface(value, fallback = 'home') {
  return typeof value === 'string' && SURFACE_LABELS[value] ? value : fallback;
}

/** Only the owner's own session writes turns; admin acts without a thread. */
export function threadWritable(actor, ownerId) {
  return actor?.role === 'owner' && !!actor.id && String(actor.id) === String(ownerId);
}

function assertThreadAccess(actor, ownerId) {
  if (!actor?.id || (actor.role !== 'admin' && String(actor.id) !== String(ownerId))) {
    const err = new Error('Forbidden: thread belongs to another owner');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
}

/**
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {string} ownerId
 * @param {import('../authz.js').Actor} actor
 */
export async function loadOwnerThread(store, ownerId, actor) {
  assertThreadAccess(actor, ownerId);
  const rows = await store.filter(
    'OwnerAssistantThread',
    { owner_id: ownerId },
    '-created_date',
    1,
    SERVICE_ACTOR,
  );
  return rows[0] || null;
}

/**
 * @param {{ role: 'user'|'bot', content: string, surface?: string, zimmerId?: string|null, ui?: object|null, pendingAction?: object|null }} turn
 * @param {import('../authz.js').Actor} actor
 */
export function buildThreadTurn(turn, actor) {
  const out = {
    id: randomUUID(),
    role: turn.role === 'user' ? 'user' : 'bot',
    content: sanitizeOwnerText(String(turn.content || '')),
    time: new Date().toISOString(),
    surface: normalizeSurface(turn.surface),
    actor_id: actor?.id || '',
    actor_role: actor?.role || '',
  };
  if (turn.zimmerId) out.zimmer_id = String(turn.zimmerId);
  if (turn.ui && typeof turn.ui === 'object') out.ui = turn.ui;
  if (turn.pendingAction && typeof turn.pendingAction === 'object') out.pending_action = turn.pendingAction;
  return out;
}

/**
 * One load + one write. `mutator` receives a shallow-copied messages array and may
 * push / splice / map it; return value is passed through.
 * @template T
 * @param {(messages: object[], row: object|null) => T|Promise<T>} mutator
 * @returns {Promise<{ result: T, threadWriteMs: number, wrote: boolean }>}
 */
export async function mutateOwnerThread(store, ownerId, actor, mutator) {
  const t0 = Date.now();
  if (!threadWritable(actor, ownerId)) {
    const result = await mutator([], null);
    return { result, threadWriteMs: Date.now() - t0, wrote: false };
  }
  const row = await loadOwnerThread(store, ownerId, actor);
  const messages = [...(Array.isArray(row?.messages) ? row.messages : [])];
  const result = await mutator(messages, row);
  const next = messages.slice(-MAX_THREAD_MESSAGES);
  if (row) {
    await store.update('OwnerAssistantThread', row.id, { messages: next }, SERVICE_ACTOR);
  } else if (next.length) {
    await store.create(
      'OwnerAssistantThread',
      { owner_id: ownerId, messages: next },
      { actor: SERVICE_ACTOR },
    );
  }
  return { result, threadWriteMs: Date.now() - t0, wrote: true };
}

/**
 * Append turns (re-reads the row right before writing to keep the race window small).
 * @returns {Promise<object[]>} the appended turns ([] when the actor may not write)
 */
export async function appendOwnerThreadTurns(store, ownerId, actor, turns) {
  if (!threadWritable(actor, ownerId) || !turns.length) return [];
  const built = turns.map((t) => buildThreadTurn(t, actor)).filter((t) => t.content || t.pending_action);
  const { result } = await mutateOwnerThread(store, ownerId, actor, (messages) => {
    messages.push(...built);
    return built;
  });
  return result;
}

/** Patch one message by id (used to resolve pending actions). */
export async function patchOwnerThreadMessage(store, ownerId, actor, messageId, patch) {
  const { result } = await mutateOwnerThread(store, ownerId, actor, (messages, row) => {
    if (!row && !messages.length) return null;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].id === messageId) {
        messages[i] = { ...messages[i], ...patch(messages[i]) };
        return messages[i];
      }
    }
    return null;
  });
  return result;
}

export function findPendingActionMessage(thread, actionId) {
  if (!thread || !actionId) return null;
  return (thread.messages || []).find((m) => m.pending_action?.id === actionId) || null;
}

/** Most recent bot turn with a still-open pending_action (status pending / missing). */
export function findLatestOpenPendingActionMessage(thread) {
  const msgs = Array.isArray(thread?.messages) ? thread.messages : [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const pa = msgs[i]?.pending_action;
    if (!pa?.id) continue;
    const status = pa.status || 'pending';
    if (status !== 'pending') continue;
    if (pa.expiresAt && Date.parse(pa.expiresAt) < Date.now()) continue;
    return msgs[i];
  }
  return null;
}

/**
 * Tagged memory across all bubbles for the prompt, e.g. "[יומן] בעל המתחם: ...".
 * @param {object|null} thread
 * @param {number} [limit]
 */
const CARD_STATUS_LABELS = {
  pending: 'ממתין',
  done: 'בוצע',
  cancelled: 'בוטל',
  expired: 'פג תוקף',
};

function cardMemorySuffix(message) {
  const pending = message?.pending_action;
  if (!pending || typeof pending !== 'object') return '';
  const summary = sanitizeOwnerText(String(pending.summary || '').trim());
  if (!summary) return '';
  const status = CARD_STATUS_LABELS[pending.status] || '';
  return status ? ` הוצע: ${summary}. סטטוס: ${status}.` : ` הוצע: ${summary}.`;
}

export function threadMemoryText(thread, limit = THREAD_MEMORY_TURNS) {
  const msgs = Array.isArray(thread?.messages) ? thread.messages.slice(-limit) : [];
  return msgs
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => {
      const tag = SURFACE_LABELS[m.surface] || SURFACE_LABELS.home;
      const who = m.role === 'user' ? 'בעל המתחם' : 'עוזר';
      return `[${tag}] ${who}: ${sanitizeOwnerText(m.content)}${cardMemorySuffix(m)}`;
    })
    .join('\n');
}
