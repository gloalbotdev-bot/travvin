/**
 * Assistant action dispatcher — Phase 6.
 * Executes whitelisted owner mutations via executeOwnerAssistantOp.
 */
import {
  executeOwnerAssistantOp,
  sanitizeOperation,
} from '../owner-assistant-ops.js';

/**
 * Resolve zimmer_id on update_zimmer using owner zimmer list (mirrors frontend prepareAssistantOp).
 * @param {object} op
 * @param {object[]} zimmers
 */
export function prepareOwnerAssistantOperation(op, zimmers) {
  if (!op || op.type !== 'update_zimmer' || !Array.isArray(zimmers)) return op;

  const out = { ...op, fields: { ...(op.fields || {}) } };
  if (out.price != null && out.fields.price_per_night == null) {
    out.fields.price_per_night = out.price;
  }
  if (out.price_per_night != null && out.fields.price_per_night == null) {
    out.fields.price_per_night = out.price_per_night;
  }
  for (const key of ['weekday_price', 'weekend_price', 'description', 'amenities', 'min_nights_rules', 'outdoor_area']) {
    if (out[key] != null && out.fields[key] == null) out.fields[key] = out[key];
  }
  if (out.zimmer_id) return out;

  const hint = out.zimmer_name || out.name;
  const matched = hint
    ? zimmers.find(
        (z) => z.name === hint || z.name.includes(hint) || hint.includes(z.name),
      )
    : null;
  if (matched) out.zimmer_id = matched.id;
  return out;
}

/**
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {{
 *   operation: object,
 *   ownerId: string,
 *   actor: object,
 *   ownerName?: string,
 *   zimmers?: object[],
 * }} input
 */
export async function dispatchOwnerAssistantOperation(store, input) {
  const sanitized = sanitizeOperation(input.operation);
  if (!sanitized) {
    const err = new Error('Invalid or missing operation');
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }

  const prepared = prepareOwnerAssistantOperation(sanitized, input.zimmers || []);
  const result = await executeOwnerAssistantOp(store, {
    operation: prepared,
    ownerId: input.ownerId,
    actor: input.actor,
    ownerName: input.ownerName || '',
  });

  return {
    type: result.kind,
    kind: result.kind,
    message: result.message,
    entityType:
      result.kind === 'create_booking' || result.kind === 'update_booking' || result.kind === 'block_dates'
        ? 'BookingRequest'
        : ['create_zimmer', 'update_zimmer', 'add_seasonal_price'].includes(result.kind)
          ? 'Zimmer'
          : null,
    entityId: result.booking?.id || result.zimmer?.id || null,
    zimmer: result.zimmer || null,
    booking: result.booking || null,
  };
}
