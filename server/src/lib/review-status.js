/**
 * Review status transition whitelist (M15 #23).
 * Mirrors UI flows in CustomerReviewsTab / ReviewsPanel / SuperAdminReviewsPanel
 * + finalizeReviewAutoPublish (service).
 */

import { normalizeActor } from './authz.js';
import { SERVICE_ACTOR } from './service-role.js';

const CREATE_CUSTOMER = new Set(['pending_publish', 'pending_owner']);

/** @type {Record<string, Set<string>>} */
const OWNER_TRANSITIONS = {
  pending_publish: new Set(['disputed', 'published']),
  pending_owner: new Set(['published', 'compromise_offered', 'disputed']),
  compromise_offered: new Set(['published', 'disputed']),
  disputed: new Set(['published', 'compromise_offered', 'removed']),
};

/** @type {Record<string, Set<string>>} */
const CUSTOMER_TRANSITIONS = {
  compromise_offered: new Set(['removed', 'pending_owner']),
};

const SERVICE_TRANSITIONS = {
  pending_publish: new Set(['published']),
  pending_owner: new Set(['published']),
};

function isService(actor) {
  return actor?.id === SERVICE_ACTOR.id;
}

function isAdmin(actor) {
  return actor?.role === 'admin';
}

function isReviewOwner(actor, review) {
  return Boolean(actor?.id && review?.owner_id && actor.id === review.owner_id);
}

function isReviewCustomer(actor, review) {
  return Boolean(actor?.id && review?.customer_id && actor.id === review.customer_id);
}

/**
 * Enforce allowed initial status on create.
 * @param {import('./authz.js').Actor} actor
 * @param {string|undefined} status
 */
export function assertReviewCreateStatus(actor, status) {
  const user = normalizeActor(actor);
  const next = status || 'pending_publish';

  if (isService(user) || isAdmin(user)) return;

  if (!CREATE_CUSTOMER.has(next)) {
    const err = new Error(
      `Forbidden: cannot create Review with status "${next}"`,
    );
    err.status = 403;
    throw err;
  }
}

/**
 * M15 #14 — compromise offer fields + required percentage when offering compromise.
 * @param {object} current
 * @param {object} patch
 */
export function assertReviewSettlementOffer(current, patch) {
  const nextStatus = patch?.status ?? current?.status;
  const offer = {
    ...(current?.settlement_offer && typeof current.settlement_offer === 'object'
      ? current.settlement_offer
      : {}),
    ...(patch?.settlement_offer && typeof patch.settlement_offer === 'object'
      ? patch.settlement_offer
      : {}),
  };

  if (patch?.settlement_offer) {
    const pct = offer.percentage;
    const amt = offer.amount;
    if (pct != null && (pct < 0 || pct > 100)) {
      const err = new Error('settlement_offer.percentage must be 0–100');
      err.status = 400;
      throw err;
    }
    if (amt != null && amt < 0) {
      const err = new Error('settlement_offer.amount must be >= 0');
      err.status = 400;
      throw err;
    }
  }

  if (nextStatus === 'compromise_offered' && offer.percentage == null) {
    const err = new Error('compromise_offered requires settlement_offer.percentage');
    err.status = 400;
    throw err;
  }
}

/**
 * Enforce status transitions on update. No-op if status unchanged / omitted.
 * @param {import('./authz.js').Actor} actor
 * @param {object} current — existing public review
 * @param {object} patch — validated update payload
 */
export function assertReviewStatusTransition(actor, current, patch) {
  if (!patch || patch.status === undefined) return;
  const from = current?.status;
  const to = patch.status;
  if (from === to) return;

  const user = normalizeActor(actor);

  if (isAdmin(user) && !isService(user)) return;

  if (isService(user)) {
    const allowed = SERVICE_TRANSITIONS[from];
    if (allowed?.has(to)) return;
    const err = new Error(
      `Forbidden: service cannot transition Review ${from} → ${to}`,
    );
    err.status = 403;
    throw err;
  }

  if (isReviewOwner(user, current)) {
    const allowed = OWNER_TRANSITIONS[from];
    if (allowed?.has(to)) return;
    const err = new Error(
      `Forbidden: owner cannot transition Review ${from} → ${to}`,
    );
    err.status = 403;
    throw err;
  }

  if (isReviewCustomer(user, current)) {
    const allowed = CUSTOMER_TRANSITIONS[from];
    if (allowed?.has(to)) return;
    const err = new Error(
      `Forbidden: customer cannot transition Review ${from} → ${to}`,
    );
    err.status = 403;
    throw err;
  }

  const err = new Error(
    `Forbidden: cannot transition Review ${from} → ${to}`,
  );
  err.status = 403;
  throw err;
}
