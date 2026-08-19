/**
 * Checkout — session role decides `by`; never trust client payload.by.
 */
import { SERVICE_ACTOR } from './service-role.js';
import { sendGuestMessage } from './send-guest-message.js';
import { sendSupplierMessage } from './send-supplier-message.js';

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {object} payload
 * @param {import('./authz.js').Actor} actor
 */
export async function performCheckout(store, payload = {}, actor) {
  const bookingId = payload.booking_id;
  if (!bookingId) {
    const err = new Error('booking_id required');
    err.status = 400;
    throw err;
  }
  if (!actor?.id) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  const by =
    actor.role === 'admin' ? 'admin' : actor.role === 'owner' ? 'owner' : 'customer';

  const b = await store.get('BookingRequest', bookingId, SERVICE_ACTOR);
  if (by === 'customer' && b.created_by_id !== actor.id) {
    const err = new Error('forbidden');
    err.status = 403;
    throw err;
  }
  if (by === 'owner' && b.owner_id !== actor.id) {
    const err = new Error('forbidden');
    err.status = 403;
    throw err;
  }

  if (b.checked_out) {
    return { ok: true, already: true, message: "כבר בוצע צ'ק-אאוט" };
  }

  const photos = Array.isArray(payload.photos) ? payload.photos.filter(Boolean) : [];
  const notes = (payload.notes || '').toString();
  const rating = typeof payload.rating === 'number' ? payload.rating : null;
  const report = (payload.report || '').toString();
  const nowIso = new Date().toISOString();
  const results = {};

  await store.update(
    'BookingRequest',
    bookingId,
    {
      checked_out: true,
      checked_out_at: nowIso,
      checkout_by: by,
      checkout_photos: photos,
      checkout_notes: notes,
      checkout_rating: rating,
      checkout_report: report,
    },
    SERVICE_ACTOR,
  );
  results.booking_closed = true;

  let zimmer = null;
  try {
    if (b.zimmer_id) zimmer = await store.get('Zimmer', b.zimmer_id, SERVICE_ACTOR);
  } catch {
    /* ignore */
  }
  const stayNotes = zimmer?.stay_settings || {};
  const checkoutTime = stayNotes.checkout_time || '11:00';

  let cleanerNotified = false;
  try {
    const autos = await store.filter(
      'SupplierAutomation',
      { owner_id: b.owner_id, message_type: 'checkout_notify', enabled: true },
      undefined,
      undefined,
      SERVICE_ACTOR,
    );
    const matched =
      (autos || []).find(
        (a) => Array.isArray(a.zimmer_ids) && a.zimmer_ids.includes(b.zimmer_id),
      ) ||
      (autos || []).find((a) => !Array.isArray(a.zimmer_ids) || a.zimmer_ids.length === 0);
    if (matched) {
      let contact = null;
      try {
        contact = await store.get('Contact', matched.contact_id, SERVICE_ACTOR);
      } catch {
        /* ignore */
      }
      if (contact && contact.phone) {
        try {
          await sendSupplierMessage(
            store,
            {
              contact_id: contact.id,
              contact_name: contact.name,
              contact_phone: contact.phone,
              owner_id: b.owner_id,
              category: 'reminder',
              title: `ניקיון — ${b.zimmer_name || 'צימר'}`,
              body: `יציאת אורח. שעת יציאה: ${checkoutTime}. נא להכין את היחידה לאורח הבא.${notes ? `\nהערות: ${notes}` : ''}${report ? `\nדיווח מהאורח: ${report}` : ''}`,
            },
            SERVICE_ACTOR,
          );
          cleanerNotified = true;
        } catch (e) {
          results.cleaner_error = e instanceof Error ? e.message : String(e);
        }
      }
    }
  } catch {
    /* ignore */
  }
  results.cleaner_notified = cleanerNotified;

  let reviewText =
    'מקווים שנהניתם! נשמח אם תשאירו ביקורת קצרה על השהות — זה עוזר לאורחים הבאים ולבעל המתחם. ניתן לדרג ולכתוב דרך האזור האישי.';
  const customReview = zimmer?.stay_settings?.review_request_message;
  if (customReview && String(customReview).trim()) reviewText = String(customReview).trim();

  try {
    await sendGuestMessage(store, {
      customer_id: b.created_by_id,
      booking_id: bookingId,
      zimmer_id: b.zimmer_id || undefined,
      owner_id: b.owner_id || undefined,
      category: 'review_reminder',
      title: `איך היתה החופשה? נשמח לביקורת 🌟`,
      body: reviewText,
      channels: ['app', 'whatsapp'],
    });
    results.review_sent = true;
  } catch (e) {
    results.review_error = e instanceof Error ? e.message : String(e);
  }

  return { ok: true, results };
}
