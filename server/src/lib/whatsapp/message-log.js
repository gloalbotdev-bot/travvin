/**
 * WhatsAppMessage log — audit trail, delivery-status tracking and inbound de-duplication.
 * Logging is best-effort: a failed log write never fails a send.
 */
import { SERVICE_ACTOR } from '../service-role.js';

const MAX_BODY = 1000;
const SERVICE_OPTS = { actor: SERVICE_ACTOR, createdById: SERVICE_ACTOR.id, createdBy: SERVICE_ACTOR.email };

/**
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {Record<string, unknown>} row
 */
export async function logWhatsAppMessage(store, row) {
  try {
    const clean = Object.fromEntries(
      Object.entries(row).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );
    if (typeof clean.body === 'string') clean.body = clean.body.slice(0, MAX_BODY);
    return await store.create('WhatsAppMessage', clean, SERVICE_OPTS);
  } catch (e) {
    console.warn('[whatsapp] message log write failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * True when an inbound provider message id was already logged (webhook retries / duplicates).
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {string} providerMessageId
 */
export async function wasInboundSeen(store, providerMessageId) {
  if (!providerMessageId) return false;
  const rows = await store.filter(
    'WhatsAppMessage',
    { direction: 'in', provider_message_id: providerMessageId },
    undefined,
    1,
    SERVICE_ACTOR,
  );
  return rows.length > 0;
}

const STATUS_RANK = { sent: 1, delivered: 2, read: 3 };

/**
 * Apply a delivery receipt to the outbound row it belongs to. Never moves status backwards.
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {import('./contract.js').StatusEvent} event
 */
export async function applyStatusEvent(store, event) {
  if (!event.messageId) return false;
  const [row] = await store.filter(
    'WhatsAppMessage',
    { direction: 'out', provider_message_id: event.messageId },
    undefined,
    1,
    SERVICE_ACTOR,
  );
  if (!row) return false;
  const forward = event.status === 'failed'
    || (STATUS_RANK[event.status] || 0) > (STATUS_RANK[row.status] || 0);
  if (!forward) return false;
  await store.update(
    'WhatsAppMessage',
    row.id,
    { status: event.status, status_updated_at: event.timestamp },
    SERVICE_ACTOR,
  );
  return true;
}
