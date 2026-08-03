import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { booking_id } = body;

    const booking = await base44.asServiceRole.entities.BookingRequest.get(booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    const event = {
      summary: `הזמנה: ${booking.zimmer_name} - ${booking.guest_name}`,
      description: `אורח: ${booking.guest_name}\nטלפון: ${booking.guest_phone}\nאורחים: ${booking.num_guests || 1}\nהערות: ${booking.notes || ''}`,
      start: {
        date: booking.check_in,
        timeZone: 'Asia/Jerusalem'
      },
      end: {
        date: booking.check_out,
        timeZone: 'Asia/Jerusalem'
      },
      colorId: '2'
    };

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    const data = await response.json();
    if (!response.ok) return Response.json({ error: data.error?.message || 'Calendar error' }, { status: 500 });

    // Save calendar event id to booking
    await base44.asServiceRole.entities.BookingRequest.update(booking_id, {
      calendar_event_id: data.id
    });

    return Response.json({ success: true, event_id: data.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});