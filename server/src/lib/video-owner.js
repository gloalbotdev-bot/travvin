/**
 * Owner/admin video mutations with ownership checks (Base44 port).
 */
import { SERVICE_ACTOR } from './service-role.js';

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  err.body = { status, message };
  throw err;
}

function requireAuth(actor) {
  if (!actor?.id) fail(401, 'Unauthorized');
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ zimmer_id: string, video_url: string, caption?: string, actor: import('./authz.js').Actor }} opts
 */
export async function createZimmerVideo(store, { zimmer_id, video_url, caption, actor }) {
  requireAuth(actor);
  if (!zimmer_id || !video_url) fail(400, 'missing zimmer_id or video_url');

  const owned = await store.filter('Zimmer', { id: zimmer_id, owner_id: actor.id }, undefined, undefined, actor);
  if (!owned?.length) fail(403, 'forbidden — not your zimmer');
  const zimmer = owned[0];

  const rec = await store.create(
    'ZimmerVideo',
    {
      video_url,
      owner_id: actor.id,
      zimmer_id,
      zimmer_name: zimmer.name || '',
      owner_name: actor.full_name || '',
      owner_avatar_url: '',
      caption: caption || '',
      likes_count: 0,
      hidden: false,
      comments_hidden: false,
    },
    { actor: SERVICE_ACTOR, createdById: actor.id, createdBy: actor.email },
  );

  return { ok: true, video: rec };
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ video_id: string, actor: import('./authz.js').Actor }} opts
 */
export async function deleteVideo(store, { video_id, actor }) {
  requireAuth(actor);
  if (!video_id) fail(400, 'missing video_id');

  let video;
  try {
    video = await store.get('ZimmerVideo', video_id, SERVICE_ACTOR);
  } catch (e) {
    if (e.status === 404) fail(404, 'not found');
    throw e;
  }
  if (video.owner_id !== actor.id && actor.role !== 'admin') fail(403, 'forbidden');

  const likes = await store.filter('VideoLike', { video_id }, undefined, undefined, SERVICE_ACTOR);
  for (const like of likes || []) {
    await store.delete('VideoLike', like.id, SERVICE_ACTOR);
  }
  await store.delete('ZimmerVideo', video_id, SERVICE_ACTOR);
  return { ok: true };
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ actor: import('./authz.js').Actor }} opts
 */
export async function listOwnerVideos(store, { actor }) {
  requireAuth(actor);

  const videos = await store.filter('ZimmerVideo', { owner_id: actor.id }, undefined, undefined, SERVICE_ACTOR);
  const zimmerIds = [...new Set((videos || []).map((v) => v.zimmer_id).filter(Boolean))];

  /** @type {Map<string, object>} */
  const zimmerMap = new Map();
  for (const zid of zimmerIds) {
    try {
      const z = await store.get('Zimmer', zid, SERVICE_ACTOR);
      if (z) zimmerMap.set(zid, z);
    } catch {
      /* ignore */
    }
  }

  const bookings = await store.filter('BookingRequest', {}, undefined, undefined, SERVICE_ACTOR);
  /** @type {Map<string, number>} */
  const countByVideo = new Map();
  for (const b of bookings || []) {
    if (b.source_video_id) {
      countByVideo.set(b.source_video_id, (countByVideo.get(b.source_video_id) || 0) + 1);
    }
  }

  const out = (videos || []).map((v) => {
    const zimmer = zimmerMap.get(v.zimmer_id);
    return {
      id: v.id,
      video_url: v.video_url,
      caption: v.caption || '',
      likes_count: v.likes_count || 0,
      hidden: !!v.hidden,
      comments_hidden: !!v.comments_hidden,
      zimmer_id: v.zimmer_id,
      zimmer_name: zimmer?.name || v.zimmer_name || '',
      bookings_count: countByVideo.get(v.id) || 0,
      created_date: v.created_date,
      proposal_status: v.proposal_status || 'פעיל',
      proposed_by_name: v.proposed_by_name || '',
      proposal_note: v.proposal_note || '',
    };
  });

  return { ok: true, videos: out };
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ video_id: string, hidden: boolean, actor: import('./authz.js').Actor }} opts
 */
export async function setVideoVisibility(store, { video_id, hidden, actor }) {
  requireAuth(actor);
  if (actor.role !== 'admin') fail(403, 'forbidden');
  if (!video_id) fail(400, 'missing video_id');

  await store.update('ZimmerVideo', video_id, { hidden: !!hidden }, SERVICE_ACTOR);
  return { ok: true };
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ zimmer_id: string, comments_hidden: boolean, actor: import('./authz.js').Actor }} opts
 */
export async function setVideoCommentsHidden(store, { zimmer_id, comments_hidden, actor }) {
  requireAuth(actor);
  if (actor.role !== 'admin') fail(403, 'forbidden');
  if (!zimmer_id) fail(400, 'missing zimmer_id');

  const vids = await store.filter('ZimmerVideo', { zimmer_id }, undefined, undefined, SERVICE_ACTOR);
  const count = (vids || []).length;
  for (const v of vids || []) {
    await store.update('ZimmerVideo', v.id, { comments_hidden: !!comments_hidden }, SERVICE_ACTOR);
  }
  return { ok: true, affected: count };
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ video_id: string, caption?: string, actor: import('./authz.js').Actor }} opts
 */
export async function updateVideoCaption(store, { video_id, caption, actor }) {
  requireAuth(actor);
  if (!video_id) fail(400, 'missing video_id');

  let video;
  try {
    video = await store.get('ZimmerVideo', video_id, SERVICE_ACTOR);
  } catch (e) {
    if (e.status === 404) fail(404, 'not found');
    throw e;
  }
  if (video.owner_id !== actor.id && actor.role !== 'admin') fail(403, 'forbidden');

  await store.update('ZimmerVideo', video_id, { caption: caption || '' }, SERVICE_ACTOR);
  return { ok: true };
}
