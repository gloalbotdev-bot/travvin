/**
 * toggleVideoLike — atomic-ish like toggle (Base44 port).
 */
import { SERVICE_ACTOR } from './service-role.js';

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  err.body = { status, message };
  throw err;
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ video_id: string, actor: import('./authz.js').Actor }} opts
 */
export async function toggleVideoLike(store, { video_id, actor }) {
  if (!actor?.id) fail(401, 'Unauthorized');
  if (!video_id) fail(400, 'missing video_id');

  const existing = await store.filter(
    'VideoLike',
    { video_id, user_id: actor.id },
    undefined,
    undefined,
    SERVICE_ACTOR,
  );

  let liked;
  if (existing?.length) {
    await store.delete('VideoLike', existing[0].id, SERVICE_ACTOR);
    liked = false;
  } else {
    await store.create(
      'VideoLike',
      { video_id, user_id: actor.id },
      { actor: SERVICE_ACTOR, createdById: actor.id, createdBy: actor.email },
    );
    liked = true;
  }

  const all = await store.filter('VideoLike', { video_id }, undefined, undefined, SERVICE_ACTOR);
  const count = (all || []).length;
  await store.update('ZimmerVideo', video_id, { likes_count: count }, SERVICE_ACTOR);

  return { ok: true, liked, likes_count: count };
}
