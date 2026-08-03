import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let payload = {};
    try { payload = await req.json(); } catch (e) { payload = {}; }

    const reviewId = payload.review_id;
    if (!reviewId) return Response.json({ error: 'review_id required' }, { status: 400 });

    let review = null;
    try {
      review = await base44.asServiceRole.entities.Review.get(reviewId);
    } catch (e) {
      return Response.json({ ok: false, error: 'review not found', review_id: reviewId }, { status: 404 });
    }
    if (!review) return Response.json({ ok: false, error: 'review not found', review_id: reviewId }, { status: 404 });

    // Publish only if still in a pre-publish state — owner/customer may have already acted.
    if (review.status === 'pending_publish' || review.status === 'pending_owner') {
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.Review.update(reviewId, {
        status: 'published',
        published_at: now,
      });
      return Response.json({ ok: true, action: 'published', review_id: reviewId });
    }

    return Response.json({ ok: true, action: 'skipped', status: review.status, review_id: reviewId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}