import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let payload = {};
    try { payload = await req.json(); } catch (e) { payload = {}; }

    const audience = payload.audience || 'owner';
    const target_user_ids = Array.isArray(payload.target_user_ids) ? payload.target_user_ids : [];
    const category = payload.category || 'עדכון';
    const title = payload.title || '';
    const msgBody = payload.body || '';

    if (!title) return Response.json({ error: 'title required' }, { status: 400 });

    const target_label = target_user_ids.length
      ? `${target_user_ids.length} נמענים`
      : (audience === 'owner' ? 'כל בעלי המתחמים' : 'כל הלקוחות');

    const action_type = payload.action_type || '';
    const action_entity_id = payload.action_entity_id || '';
    const created = await base44.asServiceRole.entities.SystemMessage.create({
      audience,
      target_user_ids,
      category,
      title,
      body: msgBody,
      target_label,
      action_type,
      action_entity_id,
    });

    return Response.json({ ok: true, id: created.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}