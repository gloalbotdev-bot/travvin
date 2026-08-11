/**
 * pushInAppNotification — faithful restore of base44/functions/pushInAppNotification/entry.ts
 * Internal only (entity hooks). HTTP route returns 403 (M15 #4 #24).
 */

import { SERVICE_ACTOR } from './service-role.js';

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {object} payload
 */
export async function pushInAppNotification(store, payload = {}) {
  const audience = payload.audience || 'owner';
  const target_user_ids = Array.isArray(payload.target_user_ids)
    ? payload.target_user_ids
    : [];
  const category = payload.category || 'עדכון';
  const title = payload.title || '';
  const msgBody = payload.body || '';

  if (!title) {
    const err = new Error('title required');
    err.status = 400;
    throw err;
  }

  const target_label = target_user_ids.length
    ? `${target_user_ids.length} נמענים`
    : audience === 'owner'
      ? 'כל בעלי המתחמים'
      : 'כל הלקוחות';

  const action_type = payload.action_type || '';
  const action_entity_id = payload.action_entity_id || '';

  const created = await store.create(
    'SystemMessage',
    {
      audience,
      target_user_ids,
      category,
      title,
      body: msgBody,
      target_label,
      action_type,
      action_entity_id,
    },
    { actor: SERVICE_ACTOR, createdById: SERVICE_ACTOR.id, createdBy: SERVICE_ACTOR.email },
  );

  return { ok: true, id: created.id };
}
