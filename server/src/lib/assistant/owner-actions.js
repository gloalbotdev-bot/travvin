/**
 * Uniform confirm-before-execute for owner assistant actions.
 * A turn never executes: it stores a pending_action and returns a confirm_action uiEffect.
 * The client then sends clientState.confirmActionId / cancelActionId; the server verifies
 * owner + expiry + single execution, runs the whitelisted op and returns executedActions.
 */
import { randomUUID } from 'node:crypto';
import { describeOwnerOperation, isActionableOperation, sanitizeOperation } from '../owner-assistant-ops.js';
import { dispatchOwnerAssistantOperation, prepareOwnerAssistantOperation } from './action-dispatcher.js';
import { appendOwnerActionLog } from './conversation-service.js';
import { resolveOwnerId } from './context-builder/owner-assistant.js';
import {
  buildThreadTurn,
  findPendingActionMessage,
  loadOwnerThread,
  mutateOwnerThread,
  normalizeSurface,
  threadWritable,
} from './owner-thread.js';

export const PENDING_ACTION_TTL_MS = 30 * 60 * 1000;

/** Admin sessions have no thread — their pending actions live in memory (short TTL). */
const adminPending = new Map();
/** In-process guard against double confirmation while an action executes. */
const executing = new Set();

const BOOKING_EDIT_KEYS = ['booking_id', 'guest_name', 'guest_phone', 'check_in', 'check_out', 'zimmer_name', 'zimmer_id', 'num_guests', 'notes', 'status', 'price_override'];

export function isActionDecision(clientState) {
  return Boolean(
    clientState &&
      (typeof clientState.confirmActionId === 'string' || typeof clientState.cancelActionId === 'string'),
  );
}

/**
 * @param {object} rawOp
 * @param {object[]} zimmers
 * @param {string} profileId
 * @returns {object|null} pending action (op sanitized) or null when the op is invalid
 */
export function createPendingAction(rawOp, zimmers, profileId) {
  const sanitized = sanitizeOperation(rawOp);
  if (!isActionableOperation(sanitized)) return null;
  const op = prepareOwnerAssistantOperation(sanitized, zimmers || []);
  const { summary, details } = describeOwnerOperation(op, zimmers || []);
  return {
    id: randomUUID(),
    op,
    summary,
    details,
    profile: profileId,
    status: 'pending',
    expiresAt: new Date(Date.now() + PENDING_ACTION_TTL_MS).toISOString(),
  };
}

export function confirmActionEffect(pending) {
  return {
    type: 'confirm_action',
    actionId: pending.id,
    summary: pending.summary,
    details: pending.details || [],
    opType: pending.op?.type || null,
  };
}

/** Admin fallback storage (owner sessions keep the action on their thread turn). */
export function rememberPendingForAdmin(pending, ownerId, actor) {
  if (threadWritable(actor, ownerId)) return;
  for (const [id, entry] of adminPending) {
    if (Date.parse(entry.pending.expiresAt) < Date.now()) adminPending.delete(id);
  }
  adminPending.set(pending.id, { pending, ownerId, actorId: actor.id });
}

function mergeEditedFields(op, edited) {
  if (!edited || typeof edited !== 'object' || Array.isArray(edited)) return op;
  switch (op.type) {
    case 'create_zimmer':
      return { ...op, ...edited, type: op.type, name: typeof edited.name === 'string' && edited.name.trim() ? edited.name : op.name };
    case 'update_zimmer':
      return { ...op, fields: { ...(op.fields || {}), ...edited } };
    case 'create_booking':
    case 'update_booking': {
      const next = { ...op };
      for (const k of BOOKING_EDIT_KEYS) if (edited[k] !== undefined) next[k] = edited[k];
      return next;
    }
    default:
      return op;
  }
}

function decisionError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function decisionResponse(profile, content, extra = {}) {
  return {
    conversationId: null,
    message: { role: 'assistant', content, time: new Date().toISOString() },
    uiEffects: extra.uiEffects || [],
    executedActions: extra.executedActions || [],
    meta: {
      profile: profile.id,
      responseMode: profile.responseMode,
      decision: extra.decision || null,
      timing: extra.timing || undefined,
    },
  };
}

/** Only needed when propose did not already resolve zimmer_id (name match at confirm). */
function needsZimmerListForPrepare(op) {
  if (!op || op.type === 'create_zimmer') return false;
  if (op.zimmer_id) return false;
  return Boolean(op.zimmer_name || op.name);
}

function patchPendingOnMessage(messages, messageId, status, extra = {}) {
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].id !== messageId) continue;
    const prev = messages[i].pending_action || {};
    messages[i] = {
      ...messages[i],
      pending_action: { ...prev, status, ...extra },
    };
    return messages[i].pending_action;
  }
  return null;
}

/**
 * @param {{ clientState: object|null }} req
 * @param {{ id: string, responseMode: string }} profile
 * @param {import('../authz.js').Actor} actor
 * @param {{ store: ReturnType<import('../entity-store.js').createEntityStore>, user?: object|null }} deps
 */
export async function handleOwnerActionDecision(req, profile, actor, deps) {
  const t0 = Date.now();
  const cs = req.clientState || {};
  const confirm = typeof cs.confirmActionId === 'string';
  const actionId = String(confirm ? cs.confirmActionId : cs.cancelActionId).trim();
  const ownerId = resolveOwnerId(actor, cs);
  if (!ownerId || !actionId) throw decisionError('owner context required', 400, 'VALIDATION');

  const writable = threadWritable(actor, ownerId);
  let pending = null;
  let threadMessage = null;
  if (writable) {
    const thread = await loadOwnerThread(deps.store, ownerId, actor);
    threadMessage = findPendingActionMessage(thread, actionId);
    pending = threadMessage?.pending_action || null;
  } else {
    const entry = adminPending.get(actionId);
    if (entry && entry.ownerId === ownerId && entry.actorId === actor.id) pending = entry.pending;
  }
  if (!pending) throw decisionError('הפעולה לא נמצאה', 404, 'ACTION_NOT_FOUND');
  if (pending.status !== 'pending' || executing.has(actionId)) {
    throw decisionError('הפעולה כבר טופלה', 409, 'ACTION_ALREADY_HANDLED');
  }

  const surface = normalizeSurface(cs.surface, threadMessage?.surface || 'home');

  if (Date.parse(pending.expiresAt) < Date.now()) {
    if (writable && threadMessage) {
      await mutateOwnerThread(deps.store, ownerId, actor, (messages) => {
        patchPendingOnMessage(messages, threadMessage.id, 'expired');
      });
    } else {
      adminPending.delete(actionId);
    }
    throw decisionError('תוקף הפעולה פג — בקש/י אותה שוב', 410, 'ACTION_EXPIRED');
  }

  if (!confirm) {
    let threadWriteMs = 0;
    if (writable && threadMessage) {
      const content = 'בוטל ✋ — לא בוצע שום שינוי.';
      const { threadWriteMs: ms } = await mutateOwnerThread(deps.store, ownerId, actor, (messages) => {
        patchPendingOnMessage(messages, threadMessage.id, 'cancelled');
        messages.push(buildThreadTurn({ role: 'bot', content, surface }, actor));
      });
      threadWriteMs = ms;
    } else {
      adminPending.delete(actionId);
    }
    const content = 'בוטל ✋ — לא בוצע שום שינוי.';
    return decisionResponse(profile, content, {
      uiEffects: [{ type: 'action_resolved', actionId, status: 'cancelled' }],
      decision: 'cancelled',
      timing: { decisionMs: Date.now() - t0, threadWriteMs },
    });
  }

  executing.add(actionId);
  try {
    const op = mergeEditedFields(pending.op, cs.editedFields);
    let zimmers = [];
    let zimmerFetchMs = 0;
    if (needsZimmerListForPrepare(op)) {
      const z0 = Date.now();
      zimmers = await deps.store.filter('Zimmer', { owner_id: ownerId }, '-created_date', 80, actor);
      zimmerFetchMs = Date.now() - z0;
    }

    let result;
    try {
      result = await dispatchOwnerAssistantOperation(deps.store, {
        operation: op,
        ownerId,
        actor,
        ownerName: deps.user?.full_name || '',
        zimmers,
      });
    } catch (e) {
      // Failed attempts stay confirmable so the owner can fix the details and retry.
      let threadWriteMs = 0;
      const content = e.message || '⚠️ לא הצלחתי לבצע את הפעולה.';
      if (writable && threadMessage) {
        const { threadWriteMs: ms } = await mutateOwnerThread(deps.store, ownerId, actor, (messages) => {
          patchPendingOnMessage(messages, threadMessage.id, 'pending');
          messages.push(buildThreadTurn({ role: 'bot', content, surface }, actor));
        });
        threadWriteMs = ms;
      }
      const err = decisionError(content, e.status || 400, e.code || 'ACTION_FAILED');
      err.body = e.body;
      err.timing = { decisionMs: Date.now() - t0, threadWriteMs, zimmerFetchMs };
      throw err;
    }

    let threadWriteMs = 0;
    if (writable && threadMessage) {
      const { threadWriteMs: ms } = await mutateOwnerThread(deps.store, ownerId, actor, (messages) => {
        patchPendingOnMessage(messages, threadMessage.id, 'done', {
          resultEntityId: result.entityId || null,
        });
        messages.push(
          buildThreadTurn(
            { role: 'bot', content: result.message, surface, zimmerId: result.zimmer?.id || null },
            actor,
          ),
        );
      });
      threadWriteMs = ms;
    } else {
      adminPending.delete(actionId);
    }

    await appendOwnerActionLog(deps.store, actor, {
      profile: profile.id,
      actionType: result.kind,
      summary: result.message || pending.summary,
      entityType: result.entityType,
      entityId: result.entityId,
    }).catch(() => {});

    return decisionResponse(profile, result.message, {
      uiEffects: [{ type: 'action_resolved', actionId, status: 'done' }],
      executedActions: [result],
      decision: 'done',
      timing: { decisionMs: Date.now() - t0, threadWriteMs, zimmerFetchMs },
    });
  } finally {
    executing.delete(actionId);
  }
}
