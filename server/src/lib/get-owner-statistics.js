/**
 * Owner statistics aggregates — port of Base44 getOwnerStatistics with owner scope.
 * Uses SERVICE_ACTOR only after verifying actor owns the zimmers queried.
 */
import { SERVICE_ACTOR } from './service-role.js';

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {import('./authz.js').Actor} actor
 */
export async function getOwnerStatistics(store, actor) {
  if (!actor?.id) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  const ownerId = actor.id;
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  // Admin may pass nothing — still only stats for their own id unless admin viewing self.
  // Always scope to actor.id (no client-supplied owner_id) to prevent IDOR.
  const scopeOwnerId = ownerId;

  const zimmers = await store.filter(
    'Zimmer',
    { owner_id: scopeOwnerId },
    undefined,
    undefined,
    actor,
  );
  const zimmerIds = Array.from(
    new Set((zimmers || []).map((z) => z.id).filter(Boolean)),
  );

  let totalSessions = 0;
  let aiHandled = 0;
  if (zimmerIds.length) {
    // ChatSession RLS hides customer sessions from owners — service role after ownership proven via Zimmer filter.
    const sessions = await store.filter(
      'ChatSession',
      {},
      '-created_date',
      500,
      SERVICE_ACTOR,
    );
    const relevant = (sessions || []).filter((s) => {
      const shown = Array.isArray(s.zimmer_ids_shown) ? s.zimmer_ids_shown : [];
      return shown.some((id) => zimmerIds.includes(id));
    });
    totalSessions = relevant.length;
    for (const s of relevant) {
      const msgs = Array.isArray(s.messages) ? s.messages : [];
      const last = msgs[msgs.length - 1];
      if (last && (last.role === 'assistant' || last.role === 'ai')) aiHandled += 1;
    }
  }

  const questions = await store.filter(
    'UnansweredQuestion',
    { owner_id: scopeOwnerId },
    '-created_date',
    500,
    actor,
  );
  const unansweredCount = (questions || []).filter((q) => q.status === 'ממתינה').length;
  const answeredAi = (questions || []).filter(
    (q) => q.status === 'נענתה' && q.answered_by === 'ai',
  ).length;

  const solved = Math.max(0, totalSessions - unansweredCount);
  const autoSolvePct =
    totalSessions > 0 ? Math.round((solved / totalSessions) * 100) : null;

  const guestMessages = await store.filter(
    'GuestMessage',
    { owner_id: scopeOwnerId },
    '-created_date',
    500,
    actor,
  );
  const guestStatus = { sent: 0, failed: 0, pending: 0 };
  for (const m of guestMessages || []) {
    const ds = m.delivery_status || {};
    const app = ds.app || 'pending';
    if (app === 'sent') guestStatus.sent += 1;
    else if (app === 'failed') guestStatus.failed += 1;
    else guestStatus.pending += 1;
  }

  const supplierMessages = await store.filter(
    'SupplierMessage',
    { owner_id: scopeOwnerId },
    '-created_date',
    500,
    actor,
  );

  const aiSolvedTotal = aiHandled + answeredAi;
  const timeSavedMinutes = Math.max(30, Math.round(aiSolvedTotal * 1.5));

  return {
    ok: true,
    aiHandled,
    aiSolvedTotal,
    totalSessions,
    unansweredCount,
    autoSolvePct,
    guestMessages: (guestMessages || []).length,
    guestStatus,
    supplierMessages: (supplierMessages || []).length,
    timeSavedMinutes,
  };
}
