import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/api/client';
import { MessageCircle, Phone, Home, CalendarCheck, Plus, CheckCircle2, Calendar, Moon, Users, Wallet, LogOut, LogIn } from 'lucide-react';

const waPhone = (p) => {
  const d = (p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) return '972' + d.slice(1);
  return d;
};

const fmtRange = (ci, co) => {
  if (!ci || !co) return '';
  const d1 = new Date(ci), d2 = new Date(co);
  const opts = { day: 'numeric', month: 'long' };
  return `${d2.toLocaleDateString('he-IL', opts)}-${d1.toLocaleDateString('he-IL', opts)}`;
};
const nightsBetween = (ci, co) => {
  if (!ci || !co) return 0;
  return Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
};

// Left panel: booking details card (when a booking is linked) or a contact card.
export default function MessagesContactPanel({ contact, zimmers = {}, onAddBooking }) {
  const [booking, setBooking] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(false);

  // Pick the first linked booking id from the contact's threads (direct chats),
  // or fall back to matching a booking by guest name + zimmer (for questions).
  const bookingId = useMemo(() => {
    const fromThreads = (contact?.threads || []).find(t => t.booking_id)?.booking_id;
    if (fromThreads) return { id: fromThreads, via: 'thread' };
    // Questions have no booking link — resolve by matching customer name + a zimmer they asked about.
    const q = (contact?.questions || [])[0];
    if (q && contact?.name && q.zimmer_id) return { via: 'search', zimmerId: q.zimmer_id, guestName: contact.name };
    return null;
  }, [contact?.key]);

  useEffect(() => {
    let alive = true;
    if (!bookingId) { setBooking(null); return; }
    setLoadingBooking(true);
    const fetcher = bookingId.via === 'thread'
      ? api.entities.BookingRequest.get(bookingId.id)
      : api.entities.BookingRequest.filter({
          zimmer_id: bookingId.zimmerId,
          guest_name: bookingId.guestName,
          is_block: false,
        }, '-created_date', 5).then(list => (list || [])[0] || null);
    fetcher
      .then(b => { if (alive) setBooking(b); })
      .catch(() => { if (alive) setBooking(null); })
      .finally(() => { if (alive) setLoadingBooking(false); });
    return () => { alive = false; };
  }, [bookingId]);

  // Resolve the zimmer context (image, name, checkin/checkout times).
  const zimmer = useMemo(() => {
    const zid = booking?.zimmer_id
      || (contact?.threads || []).find(t => t.zimmer_id)?.zimmer_id
      || (contact?.questions || []).find(q => q.zimmer_id)?.zimmer_id;
    return zid ? zimmers[zid] : null;
  }, [booking, zimmers, contact?.key]);

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center" dir="rtl">
        <div>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#F8F7F4' }}><MessageCircle size={26} style={{ color: '#D1D5DB' }} /></div>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>פרטים נוספים יופיעו כאן</p>
        </div>
      </div>
    );
  }

  // Booking present → render the detailed booking card.
  if (booking && zimmer) {
    const wa = waPhone(contact.phone || booking.guest_phone);
    const nights = nightsBetween(booking.check_in, booking.check_out);
    const img = zimmer.images?.[0];
    const statusBadge = booking.is_block
      ? { text: 'תאריך חסום', bg: '#FEF3C7', color: '#92400E' }
      : booking.status === 'אושרה'
        ? { text: 'הזמנה מאושרת', bg: '#dcfce7', color: '#166534' }
        : booking.status === 'נדחית'
          ? { text: 'נדחתה', bg: '#FEE2E2', color: '#991B1B' }
          : { text: 'ממתינה לאישור', bg: '#FEF3C7', color: '#92400E' };
    const stay = zimmer.stay_settings || {};
    const checkinTime = stay.checkin_time || '15:00';
    const checkoutTime = stay.checkout_time || '11:00';

    return (
      <div className="h-full overflow-y-auto p-5" dir="rtl" style={{ background: '#fff', borderLeft: '1px solid #f3f4f6' }}>
        <h3 className="font-bold text-base mb-4" style={{ color: '#111827' }}>פרטי ההזמנה</h3>

        {img && (
          <div className="rounded-xl overflow-hidden mb-3 aspect-[4/3]" style={{ background: '#F8F7F4' }}>
            <img src={img} alt={zimmer.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-black" style={{ color: '#111827' }}>{zimmer.name}</h2>
        </div>
        <div className="mb-4">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: statusBadge.bg, color: statusBadge.color }}>
            <CheckCircle2 size={13} /> {statusBadge.text}
          </span>
        </div>

        <button className="w-full py-3 rounded-xl font-bold text-sm text-white mb-2" style={{ background: '#000000' }}>
          צפייה בהזמנה
        </button>
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"
            className="w-full mb-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#374151' }}>
            <MessageCircle size={16} style={{ color: '#25D366' }} /> פתיחה ב-WhatsApp
          </a>
        )}

        <div className="space-y-3 mb-4">
          <DetailRow icon={<Calendar size={15} />} label="תאריכים" value={fmtRange(booking.check_in, booking.check_out)} />
          <DetailRow icon={<Moon size={15} />} label="משך שהות" value={`${nights} לילות`} />
          <DetailRow icon={<Users size={15} />} label="אורחים" value={`${booking.num_guests || 1} אורחים`} />
          {booking.total_price != null && <DetailRow icon={<Wallet size={15} />} label={'סה"כ לתשלום'} value={`₪${booking.total_price.toLocaleString('he-IL')}`} />}
        </div>

        <div className="pt-4 border-t grid grid-cols-2 gap-2" style={{ borderColor: '#f3f4f6' }}>
          <div className="pl-2">
            <div className="flex items-center gap-1 text-xs mb-0.5" style={{ color: '#6b7280' }}><LogIn size={13} /> צ'ק-אין</div>
            <div className="text-base font-bold" style={{ color: '#111827' }}>{checkinTime}</div>
          </div>
          <div className="pr-2 border-r" style={{ borderColor: '#f3f4f6' }}>
            <div className="flex items-center gap-1 text-xs mb-0.5" style={{ color: '#6b7280' }}><LogOut size={13} /> צ'ק-אאוט</div>
            <div className="text-base font-bold" style={{ color: '#111827' }}>{checkoutTime}</div>
          </div>
        </div>
      </div>
    );
  }

  // No booking linked → contact card with "create booking" CTA.
  const wa = waPhone(contact.phone);
  const zimmerNames = Array.from(new Set(
    (contact.threads || []).map(t => t.zimmer_name).filter(Boolean)
      .concat((contact.questions || []).map(q => q.zimmer_name).filter(Boolean))
  ));

  return (
    <div className="h-full overflow-y-auto p-5" dir="rtl" style={{ background: '#fff', borderLeft: '1px solid #f3f4f6' }}>
      <h3 className="font-bold text-base mb-4" style={{ color: '#111827' }}>פרטי לקוח</h3>

      <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-xl font-bold" style={{ background: '#075E54' }}>
        {(contact.name || 'ל').slice(0, 1)}
      </div>
      <h3 className="font-bold text-sm text-center mb-1" style={{ color: '#111827' }}>{contact.name || 'לקוח'}</h3>
      {contact.phone && (
        <div className="flex items-center justify-center gap-1.5 text-xs mb-2" style={{ color: '#6b7280' }}>
          <Phone size={12} /> <span dir="ltr">{contact.phone}</span>
        </div>
      )}
      {contact.staysCount > 0 && (
        <div className="flex items-center justify-center gap-1.5 text-xs mb-4" style={{ color: '#6b7280' }}>
          <CalendarCheck size={12} /> {contact.staysCount} שהיות קודמות
        </div>
      )}

      <button onClick={onAddBooking} className="w-full mb-2 py-3 rounded-xl text-sm font-bold text-white" style={{ background: '#000000' }}>
        צור הזמנה
      </button>
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"
          className="w-full mb-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#374151' }}>
          <MessageCircle size={16} style={{ color: '#25D366' }} /> פתיחה ב-WhatsApp
        </a>
      )}

      {loadingBooking && <div className="text-center text-xs mb-3" style={{ color: '#9CA3AF' }}>טוען הזמנה…</div>}

      <div className="pt-3 border-t" style={{ borderColor: '#f3f4f6' }}>
        <p className="text-[11px] font-bold mb-2" style={{ color: '#9CA3AF' }}>פנה לגבי הצימרים</p>
        <div className="space-y-1.5">
          {zimmerNames.length === 0
            ? <p className="text-xs" style={{ color: '#9CA3AF' }}>—</p>
            : zimmerNames.map(n => (
              <div key={n} className="flex items-center gap-2 text-xs" style={{ color: '#374151' }}>
                <Home size={12} style={{ color: '#9CA3AF' }} /> {n}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6b7280' }}>{icon} {label}</span>
      <span className="text-sm font-semibold" style={{ color: '#111827' }}>{value}</span>
    </div>
  );
}