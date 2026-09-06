/**
 * getVideoFeed — public discover feed (Base44 port).
 */
import { SERVICE_ACTOR } from './service-role.js';

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  err.body = { status, message };
  throw err;
}

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ actor?: import('./authz.js').Actor|null }} [opts]
 */
export async function getVideoFeed(store, { actor = null } = {}) {
  const all = await store.filter('ZimmerVideo', { hidden: false }, undefined, undefined, SERVICE_ACTOR);
  const videos = (all || []).filter(
    (v) => v.proposal_status !== 'הצעה' && v.proposal_status !== 'נדחתה',
  );

  const ownerIds = [...new Set(videos.map((v) => v.owner_id).filter(Boolean))];
  const zimmerIds = [...new Set(videos.map((v) => v.zimmer_id).filter(Boolean))];

  /** @type {Map<string, object>} */
  const ownerMap = new Map();
  for (const oid of ownerIds) {
    try {
      const u = await store.get('User', oid, SERVICE_ACTOR);
      if (u) ownerMap.set(oid, u);
    } catch {
      /* ignore */
    }
  }

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

  /** @type {Map<string, { count: number, avg: number }>} */
  const reviewStats = new Map();
  try {
    const reviews = await store.filter('Review', { status: 'published' }, undefined, undefined, SERVICE_ACTOR);
    /** @type {Map<string, number[]>} */
    const byZ = new Map();
    for (const r of reviews || []) {
      if (!r.zimmer_id) continue;
      const arr = byZ.get(r.zimmer_id) || [];
      arr.push(Number(r.rating) || 0);
      byZ.set(r.zimmer_id, arr);
    }
    for (const [zid, arr] of byZ) {
      const count = arr.length;
      const avg = count ? arr.reduce((a, b) => a + b, 0) / count : 0;
      reviewStats.set(zid, { count, avg });
    }
  } catch {
    /* best-effort */
  }

  /** @type {Map<string, string>} */
  const availByText = new Map();
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 86400000;
    const weekNights = [];
    for (let i = 0; i < 7; i++) weekNights.push(toIsoDate(new Date(today.getTime() + i * dayMs)));

    const bookings = await store.filter('BookingRequest', { status: 'אושרה' }, undefined, 2000, SERVICE_ACTOR);
    /** @type {Map<string, Set<string>>} */
    const bookedByZimmer = new Map();
    for (const b of bookings || []) {
      if (!b.zimmer_id || !b.check_in || !b.check_out) continue;
      const set = bookedByZimmer.get(b.zimmer_id) || new Set();
      let cur = new Date(b.check_in);
      cur.setHours(0, 0, 0, 0);
      const out = new Date(b.check_out);
      out.setHours(0, 0, 0, 0);
      while (cur < out) {
        set.add(toIsoDate(cur));
        cur = new Date(cur.getTime() + dayMs);
      }
      bookedByZimmer.set(b.zimmer_id, set);
    }
    for (const zid of zimmerIds) {
      const booked = bookedByZimmer.get(zid) || new Set();
      const free = weekNights.filter((n) => !booked.has(n)).length;
      if (free > 0) {
        const noun = free === 1 ? 'לילה פנוי' : 'לילות פנויים';
        availByText.set(zid, `בשבוע הקרוב יש ${free} ${noun}`);
      }
    }
  } catch {
    /* best-effort */
  }

  /** @type {Set<string>} */
  let likedSet = new Set();
  if (actor?.id && actor.id !== SERVICE_ACTOR.id) {
    try {
      const likes = await store.filter('VideoLike', { user_id: actor.id }, undefined, undefined, SERVICE_ACTOR);
      likedSet = new Set((likes || []).map((l) => l.video_id));
    } catch {
      /* anonymous / ignore */
    }
  }

  const out = videos.map((v) => {
    const owner = ownerMap.get(v.owner_id);
    const zimmer = zimmerMap.get(v.zimmer_id);
    const rs = reviewStats.get(v.zimmer_id) || { count: 0, avg: 0 };
    return {
      id: v.id,
      video_url: v.video_url,
      caption: v.caption || '',
      likes_count: v.likes_count || 0,
      comments_hidden: !!v.comments_hidden,
      zimmer_id: v.zimmer_id,
      owner_id: v.owner_id,
      owner_name: owner?.full_name || v.owner_name || 'בעל צימר',
      owner_avatar_url: owner?.avatar_url || v.owner_avatar_url || '',
      zimmer_name: zimmer?.name || v.zimmer_name || '',
      zimmer_location: zimmer?.location || '',
      zimmer_images: (zimmer?.images || []).slice(0, 4),
      zimmer_price: zimmer?.price_per_night ?? null,
      reviews_count: rs.count,
      reviews_avg: Math.round(rs.avg * 10) / 10,
      available_nights_text: availByText.get(v.zimmer_id) || '',
      created_date: v.created_date,
      liked: likedSet.has(v.id),
    };
  });

  return { ok: true, videos: out };
}
