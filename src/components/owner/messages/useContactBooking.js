import { useState, useEffect, useMemo } from 'react';
import { api } from '@/api/client';

// Resolves the booking linked to a contact: the first thread with a booking_id,
// or (for questions, which have no booking link) a booking matched by guest name + zimmer.
export function useContactBooking(contact) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  const ref = useMemo(() => {
    const fromThreads = (contact?.threads || []).find(t => t.booking_id)?.booking_id;
    if (fromThreads) return { id: fromThreads, via: 'thread' };
    const q = (contact?.questions || [])[0];
    if (q && contact?.name && q.zimmer_id) return { via: 'search', zimmerId: q.zimmer_id, guestName: contact.name };
    return null;
  }, [contact?.key]);

  useEffect(() => {
    let alive = true;
    if (!ref) { setBooking(null); return; }
    setLoading(true);
    const fetcher = ref.via === 'thread'
      ? api.entities.BookingRequest.get(ref.id)
      : api.entities.BookingRequest.filter({
          zimmer_id: ref.zimmerId,
          guest_name: ref.guestName,
          is_block: false,
        }, '-created_date', 5).then(list => (list || [])[0] || null);
    fetcher
      .then(b => { if (alive) setBooking(b); })
      .catch(() => { if (alive) setBooking(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ref]);

  return { booking, loading };
}

// "28–30 באוגוסט", or "30 באוגוסט – 2 בספטמבר" across months.
export function fmtStayRange(ci, co) {
  if (!ci || !co) return '';
  const d1 = new Date(ci), d2 = new Date(co);
  if (isNaN(d1) || isNaN(d2)) return '';
  const month = (d) => d.toLocaleDateString('he-IL', { month: 'long' });
  if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
    return `${d1.getDate()}–${d2.getDate()} ב${month(d2)}`;
  }
  return `${d1.getDate()} ב${month(d1)} – ${d2.getDate()} ב${month(d2)}`;
}
