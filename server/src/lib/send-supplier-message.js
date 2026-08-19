/**
 * B2B supplier WhatsApp dispatcher.
 */
import { SERVICE_ACTOR } from './service-role.js';
import { postWhatsApp } from './send-guest-message.js';

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {object} payload
 * @param {import('./authz.js').Actor} [actor]
 */
export async function sendSupplierMessage(store, payload = {}, actor = null) {
  const title = String(payload.title || '').trim();
  const body = String(payload.body || '').trim();
  if (!title) {
    const err = new Error('title required');
    err.status = 400;
    throw err;
  }

  let contactId = payload.contact_id || '';
  let contactName = payload.contact_name || '';
  let contactPhone = payload.contact_phone || '';
  let ownerId = payload.owner_id || '';

  if (actor?.role !== 'admin') {
    ownerId = actor?.id || ownerId;
  } else if (!ownerId) {
    ownerId = actor?.id || '';
  }

  if (contactId) {
    try {
      const c = await store.get('Contact', contactId, SERVICE_ACTOR);
      if (c) {
        if (actor?.role !== 'admin' && c.owner_id && actor?.id && c.owner_id !== actor.id) {
          const err = new Error('Forbidden');
          err.status = 403;
          throw err;
        }
        contactName = contactName || c.name || '';
        contactPhone = contactPhone || c.phone || '';
        ownerId = ownerId || c.owner_id || '';
      }
    } catch (e) {
      if (e.status === 403) throw e;
    }
  }

  if (!contactPhone) {
    const err = new Error('contact_phone required');
    err.status = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const record = await store.create(
    'SupplierMessage',
    {
      owner_id: ownerId,
      contact_id: contactId,
      contact_name: contactName,
      contact_phone: contactPhone,
      category: payload.category || 'custom',
      title,
      body,
      sent_at: nowIso,
      delivery_status: {},
    },
    { actor: SERVICE_ACTOR, createdById: SERVICE_ACTOR.id, createdBy: SERVICE_ACTOR.email },
  );

  const delivery = await postWhatsApp(store, {
    to: contactPhone,
    contact_id: contactId,
    contact_name: contactName,
    title,
    body,
    ref_message_id: record.id,
  });

  await store.update('SupplierMessage', record.id, { delivery_status: delivery }, SERVICE_ACTOR);
  return { ok: true, id: record.id, delivery };
}
