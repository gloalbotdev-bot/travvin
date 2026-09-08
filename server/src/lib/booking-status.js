/**
 * BookingRequest patch + status guards (SEC-009).
 */
import { normalizeActor } from './authz.js';

const CUSTOMER_PATCH_FIELDS = new Set(['cancel_request_reason', 'cancel_request_at']);

/** @type {Record<string, Set<string>>} */
const OWNER_STATUS_TRANSITIONS = {
  'ממתינה': new Set(['אושרה', 'נדחתה']),
  'אושרה': new Set(['נדחתה']),
  'נדחתה': new Set(['ממתינה', 'אושרה']),
  'חסום': new Set(['ממתינה', 'אושרה', 'נדחתה']),
};

function isAdmin(actor) {
  return actor?.role === 'admin';
}

function isBookingOwner(actor, booking) {
  return Boolean(actor?.id && booking?.owner_id && actor.id === booking.owner_id);
}

function isBookingCustomer(actor, booking) {
  return Boolean(
    actor?.id &&
      booking?.created_by_id &&
      actor.id === booking.created_by_id,
  );
}

/**
 * Customer may only request cancellation — not change status or other fields.
 */
export function assertBookingCustomerPatch(user, current, patch) {
  if (!patch || typeof patch !== 'object') return;
  const actor = normalizeActor(user);
  if (isAdmin(actor) || isBookingOwner(actor, current)) return;
  if (!isBookingCustomer(actor, current)) return;

  for (const key of Object.keys(patch)) {
    if (!CUSTOMER_PATCH_FIELDS.has(key)) {
      const err = new Error(
        `Forbidden: customers may only update ${[...CUSTOMER_PATCH_FIELDS].join(', ')}`,
      );
      err.status = 403;
      throw err;
    }
  }
}

/**
 * Enforce owner/admin status transitions. No-op if status unchanged / omitted.
 */
export function assertBookingStatusTransition(user, current, patch) {
  if (!patch || patch.status === undefined) return;
  const from = current?.status;
  const to = patch.status;
  if (from === to) return;

  const actor = normalizeActor(user);
  if (isAdmin(actor)) return;

  if (isBookingOwner(actor, current)) {
    const allowed = OWNER_STATUS_TRANSITIONS[from];
    if (allowed?.has(to)) return;
    const err = new Error(
      `Forbidden: owner cannot transition BookingRequest ${from} → ${to}`,
    );
    err.status = 403;
    throw err;
  }

  if (isBookingCustomer(actor, current)) {
    const err = new Error('Forbidden: customer cannot change booking status');
    err.status = 403;
    throw err;
  }

  const err = new Error(
    `Forbidden: cannot transition BookingRequest ${from} → ${to}`,
  );
  err.status = 403;
  throw err;
}
