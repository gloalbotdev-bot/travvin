/**
 * Admin video proposals + owner responses (Base44 port).
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
 * @param {{ zimmer_id: string, video_url: string, caption?: string, note?: string, actor: import('./authz.js').Actor }} opts
 */
export async function createVideoProposal(store, { zimmer_id, video_url, caption, note, actor }) {
  requireAuth(actor);
  if (actor.role !== 'admin') fail(403, 'forbidden — admin only');
  if (!zimmer_id || !video_url) fail(400, 'missing zimmer_id or video_url');

  let zimmer;
  try {
    zimmer = await store.get('Zimmer', zimmer_id, SERVICE_ACTOR);
  } catch (e) {
    if (e.status === 404) fail(404, 'zimmer not found');
    throw e;
  }
  if (!zimmer.owner_id) fail(400, 'zimmer has no owner');

  const ownerName = zimmer.owner_name || 'בעל הצימר';

  const rec = await store.create(
    'ZimmerVideo',
    {
      video_url,
      owner_id: zimmer.owner_id,
      zimmer_id,
      zimmer_name: zimmer.name || '',
      owner_name: ownerName,
      owner_avatar_url: '',
      caption: caption || '',
      likes_count: 0,
      hidden: false,
      comments_hidden: false,
      proposal_status: 'הצעה',
      proposed_by_id: actor.id,
      proposed_by_name: actor.full_name || 'אדמין',
      proposal_note: note || '',
    },
    { actor: SERVICE_ACTOR, createdById: actor.id, createdBy: actor.email },
  );

  try {
    await store.create(
      'SystemMessage',
      {
        audience: 'owner',
        category: 'הודעה',
        title: 'הצעת סרטון חדשה מהאדמין',
        body: `התקבלה הצעת סרטון חדשה לצימר "${zimmer.name}". עבור לטאב וידאו כדי לאשר או לדחות.${note ? `\nהערה: ${note}` : ''}`,
        target_user_ids: [zimmer.owner_id],
        target_label: '1 נמענים',
        action_type: 'open_chat',
        action_entity_id: rec.id,
      },
      { actor: SERVICE_ACTOR, createdById: SERVICE_ACTOR.id, createdBy: SERVICE_ACTOR.email },
    );
  } catch {
    /* best-effort */
  }

  return { ok: true, video: rec };
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ video_id: string, decision: string, actor: import('./authz.js').Actor }} opts
 */
export async function respondVideoProposal(store, { video_id, decision, actor }) {
  requireAuth(actor);
  if (!video_id || !decision) fail(400, 'missing video_id or decision');
  if (decision !== 'approve' && decision !== 'reject') {
    fail(400, 'decision must be approve or reject');
  }

  const videos = await store.filter('ZimmerVideo', { id: video_id }, undefined, undefined, SERVICE_ACTOR);
  const video = (videos || [])[0];
  if (!video) fail(404, 'video not found');
  if (video.owner_id !== actor.id) fail(403, 'forbidden — not your video');
  if (video.proposal_status !== 'הצעה') fail(400, 'video is not a pending proposal');

  const newStatus = decision === 'approve' ? 'פעיל' : 'נדחתה';
  await store.update(
    'ZimmerVideo',
    video_id,
    {
      proposal_status: newStatus,
      proposal_decided_at: new Date().toISOString(),
    },
    SERVICE_ACTOR,
  );

  try {
    const allUsers = await store.list('User', undefined, undefined, SERVICE_ACTOR);
    const admins = (allUsers || []).filter((u) => u.role === 'admin');
    const verb = decision === 'approve' ? 'אושרה' : 'נדחתה';
    for (const a of admins || []) {
      await store.create(
        'SystemMessage',
        {
          audience: 'owner',
          category: 'הודעה',
          title: `הצעת סרטון ${verb}`,
          body: `בעל הצימר ${verb} את הצעת הסרטון לצימר "${video.zimmer_name || ''}".`,
          target_user_ids: [a.id],
          target_label: '1 נמענים',
          action_type: 'open_chat',
          action_entity_id: video_id,
        },
        { actor: SERVICE_ACTOR, createdById: SERVICE_ACTOR.id, createdBy: SERVICE_ACTOR.email },
      );
    }
  } catch {
    /* best-effort */
  }

  return { ok: true, status: newStatus };
}
