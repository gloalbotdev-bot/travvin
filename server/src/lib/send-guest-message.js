/**
 * Unified guest message dispatcher. Persists GuestMessage; optional bell + WhatsApp.
 */
import { SERVICE_ACTOR } from './service-role.js';
import { pushInAppNotification } from './push-in-app-notification.js';
import { assertSafeHttpsUrl } from './safe-webhook-url.js';

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {object} payload
 */
export async function sendGuestMessage(store, payload = {}) {
  const customerId = payload.customer_id;
  const title = String(payload.title || '').trim();
  const body = String(payload.body || '').trim();
  if (!customerId || !title) {
    const err = new Error('customer_id and title are required');
    err.status = 400;
    throw err;
  }

  const channels = Array.isArray(payload.channels) && payload.channels.length
    ? payload.channels
    : ['app'];

  let customerName = payload.customer_name || '';
  let zimmerName = payload.zimmer_name || '';
  let ownerId = payload.owner_id || '';
  let bookingId = payload.booking_id || '';
  let zimmerId = payload.zimmer_id || '';
  let customerPhone = '';

  try {
    const u = await store.get('User', customerId, SERVICE_ACTOR);
    if (u) customerName = customerName || u.full_name || u.email || '';
  } catch {
    /* ignore */
  }

  if (bookingId && (!ownerId || !zimmerId || !zimmerName)) {
    try {
      const b = await store.get('BookingRequest', bookingId, SERVICE_ACTOR);
      if (b) {
        ownerId = ownerId || b.owner_id || '';
        zimmerId = zimmerId || b.zimmer_id || '';
        zimmerName = zimmerName || b.zimmer_name || '';
        customerName = customerName || b.guest_name || '';
        customerPhone = customerPhone || b.guest_phone || '';
      }
    } catch {
      /* ignore */
    }
  }

  if (zimmerId && !zimmerName) {
    try {
      const z = await store.get('Zimmer', zimmerId, SERVICE_ACTOR);
      if (z) zimmerName = z.name || '';
    } catch {
      /* ignore */
    }
  }

  const guestMsg = await store.create(
    'GuestMessage',
    {
      customer_id: customerId,
      customer_name: customerName,
      booking_id: bookingId,
      zimmer_id: zimmerId,
      zimmer_name: zimmerName,
      owner_id: ownerId,
      category: payload.category || 'custom',
      title,
      body,
      metadata: payload.metadata || {},
      channels,
      delivery_status: {},
    },
    { actor: SERVICE_ACTOR, createdById: SERVICE_ACTOR.id, createdBy: SERVICE_ACTOR.email },
  );

  const delivery = {};

  if (channels.includes('app')) {
    if (payload.skip_bell !== true) {
      try {
        await pushInAppNotification(store, {
          audience: 'customer',
          target_user_ids: [customerId],
          target_label: customerName || customerId,
          category: 'עדכון',
          title,
          body,
          action_type: bookingId ? 'open_booking' : '',
          action_entity_id: bookingId || '',
        });
        delivery.app = 'sent';
      } catch (e) {
        delivery.app = 'failed';
        delivery.app_error = e instanceof Error ? e.message : String(e);
      }
    } else {
      delivery.app = 'sent';
    }
  }

  if (channels.includes('whatsapp')) {
    const wa = await postWhatsApp(store, {
      to: customerPhone,
      customer_id: customerId,
      customer_name: customerName,
      zimmer_name: zimmerName,
      title,
      body,
      metadata: payload.metadata || {},
      ref_message_id: guestMsg.id,
    });
    Object.assign(delivery, wa);
  }

  await store.update(
    'GuestMessage',
    guestMsg.id,
    { delivery_status: delivery, channels },
    SERVICE_ACTOR,
  );

  return { ok: true, id: guestMsg.id, delivery };
}

async function loadWhatsAppSettings(store) {
  const settings = await store.filter('AppSetting', {}, undefined, undefined, SERVICE_ACTOR);
  let webhookUrl = '';
  let apiToken = '';
  for (const s of settings || []) {
    if (s.key === 'whatsapp_webhook_url') webhookUrl = s.value || '';
    if (s.key === 'whatsapp_api_token') apiToken = s.value || '';
  }
  return { webhookUrl, apiToken };
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {object} body
 */
export async function postWhatsApp(store, body) {
  const delivery = {};
  const { webhookUrl, apiToken } = await loadWhatsAppSettings(store);
  if (!webhookUrl) {
    delivery.whatsapp = 'not_configured';
    return delivery;
  }
  let safeUrl;
  try {
    safeUrl = assertSafeHttpsUrl(webhookUrl);
  } catch (e) {
    delivery.whatsapp = 'failed';
    delivery.whatsapp_error = e instanceof Error ? e.message : String(e);
    return delivery;
  }
  try {
    const waRes = await fetch(safeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    delivery.whatsapp = waRes.ok ? 'sent' : 'failed';
    if (!waRes.ok) delivery.whatsapp_error = `HTTP ${waRes.status}`;
  } catch (e) {
    delivery.whatsapp = 'failed';
    delivery.whatsapp_error = e instanceof Error ? e.message : String(e);
  }
  return delivery;
}
