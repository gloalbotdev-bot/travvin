/**
 * finalizeReviewAutoPublish — faithful restore of base44/functions/finalizeReviewAutoPublish/entry.ts
 * Internal only (delayed jobs). HTTP route returns 403 (M15 #22).
 */

import { SERVICE_ACTOR } from './service-role.js';

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {object} payload
 */
export async function finalizeReviewAutoPublish(store, payload = {}) {
  const reviewId = payload.review_id;
  if (!reviewId) {
    const err = new Error('review_id required');
    err.status = 400;
    throw err;
  }

  let review;
  try {
    review = await store.get('Review', reviewId, SERVICE_ACTOR);
  } catch (e) {
    if (e.status === 404) {
      const err = new Error('review not found');
      err.status = 404;
      err.body = { ok: false, error: 'review not found', review_id: reviewId };
      throw err;
    }
    throw e;
  }

  if (!review) {
    const err = new Error('review not found');
    err.status = 404;
    err.body = { ok: false, error: 'review not found', review_id: reviewId };
    throw err;
  }

  if (review.status === 'pending_publish' || review.status === 'pending_owner') {
    const now = new Date().toISOString();
    await store.update(
      'Review',
      reviewId,
      { status: 'published', published_at: now },
      SERVICE_ACTOR,
    );
    return { ok: true, action: 'published', review_id: reviewId };
  }

  return { ok: true, action: 'skipped', status: review.status, review_id: reviewId };
}
