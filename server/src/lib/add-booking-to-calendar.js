/**
 * addBookingToCalendar — per-owner calendar (M8 Option B).
 * Ownership: caller must be booking.owner_id or admin.
 */
import { SERVICE_ACTOR } from './service-role.js';

/**
 * @param {object} deps
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} deps.store
 * @param {ReturnType<import('./calendar-connection-store.js').createCalendarConnectionStore>} deps.connections
 * @param {typeof fetch} [deps.fetchImpl]
 */
export async function addBookingToCalendar(
  { store, connections, fetchImpl = fetch },
  { bookingId, actor },
) {
  if (!bookingId) {
    const err = new Error('booking_id required');
    err.status = 400;
    throw err;
  }

  let booking;
  try {
    booking = await store.get('BookingRequest', bookingId, SERVICE_ACTOR);
  } catch (e) {
    if (e.status === 404) {
      const err = new Error('Booking not found');
      err.status = 404;
      throw err;
    }
    throw e;
  }

  const ownerId = booking.owner_id;
  if (!ownerId) {
    const err = new Error('Booking has no owner_id');
    err.status = 400;
    throw err;
  }

  const role = actor?.role;
  const isAdmin = role === 'admin';
  if (!isAdmin && actor?.id !== ownerId) {
    const err = new Error('Forbidden: not booking owner');
    err.status = 403;
    throw err;
  }

  // M15 #7 — idempotent: already linked to a calendar event
  if (booking.calendar_event_id) {
    return {
      success: true,
      event_id: booking.calendar_event_id,
      skipped: true,
      reason: 'already_synced',
    };
  }

  const { accessToken, calendarId } = await connections.getAccessToken(ownerId);
  const calId =
    calendarId || process.env.GOOGLE_CALENDAR_ID || null;
  if (!calId || calId === 'primary') {
    const err = new Error('Owner calendar_id missing; reconnect Google Calendar');
    err.status = 400;
    throw err;
  }

  const event = {
    summary: `הזמנה: ${booking.zimmer_name} - ${booking.guest_name}`,
    description: `אורח: ${booking.guest_name}\nטלפון: ${booking.guest_phone}\nאורחים: ${booking.num_guests || 1}\nהערות: ${booking.notes || ''}`,
    start: { date: booking.check_in, timeZone: 'Asia/Jerusalem' },
    end: { date: booking.check_out, timeZone: 'Asia/Jerusalem' },
    colorId: '2',
  };

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error?.message || 'Calendar error');
    err.status = 500;
    throw err;
  }

  await store.update(
    'BookingRequest',
    bookingId,
    { calendar_event_id: data.id },
    SERVICE_ACTOR,
  );

  return { success: true, event_id: data.id };
}
