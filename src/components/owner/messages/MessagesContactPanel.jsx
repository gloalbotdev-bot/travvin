import React, { useMemo } from 'react';
import { MessageCircle, Phone, Home, CalendarCheck } from 'lucide-react';
import ContactAvatar from './ContactAvatar';
import iconPin from '@/assets/owner/messages/icon-pin.svg';
import iconWhatsapp from '@/assets/owner/messages/icon-whatsapp.svg';

const waPhone = (p) => {
  const d = (p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) return '972' + d.slice(1);
  return d;
};

const nightsBetween = (ci, co) => {
  if (!ci || !co) return 0;
  return Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
};

// "יום ו׳ 28 באוגוסט"
const fmtStayDay = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return '';
  const weekday = date.toLocaleDateString('he-IL', { weekday: 'short' });
  const month = date.toLocaleDateString('he-IL', { month: 'long' });
  return `${weekday} ${date.getDate()} ב${month}`;
};

const isOccupiedNow = (b) => {
  if (!b?.check_in || !b?.check_out || b.is_block || b.status === 'נדחית') return false;
  const n = new Date();
  const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  return String(b.check_in).slice(0, 10) <= today && today < String(b.check_out).slice(0, 10);
};

const statusText = (b) => {
  if (isOccupiedNow(b)) return 'תפוס כרגע';
  if (b.is_block) return 'תאריך חסום';
  if (b.status === 'אושרה') return 'הזמנה מאושרת';
  if (b.status === 'נדחית') return 'נדחתה';
  return 'ממתינה לאישור';
};

const PANEL = 'font-simona h-full overflow-y-auto owner-hide-scrollbar flex flex-col gap-[25px] px-[32px] pt-[43px] pb-[37px] bg-white';

// Left panel: booking details card (when a booking is linked) or a contact card.
// The booking is resolved by the parent (useContactBooking) so the chat header shares it.
export default function MessagesContactPanel({ contact, zimmers = {}, booking = null, loadingBooking = false, onAddBooking }) {
  const zimmer = useMemo(() => {
    const zid = booking?.zimmer_id
      || (contact?.threads || []).find(t => t.zimmer_id)?.zimmer_id
      || (contact?.questions || []).find(q => q.zimmer_id)?.zimmer_id;
    return zid ? zimmers[zid] : null;
  }, [booking, zimmers, contact?.key]);

  if (!contact) {
    return (
      <div className="font-simona h-full flex items-center justify-center p-6 text-center bg-white" dir="rtl">
        <div>
          <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#FAFAFA' }}><MessageCircle size={26} style={{ color: '#9CA3AF' }} /></div>
          <p className="text-[15px]" style={{ color: '#6B7280' }}>פרטים נוספים יופיעו כאן</p>
        </div>
      </div>
    );
  }

  if (booking && zimmer) {
    const wa = waPhone(contact.phone || booking.guest_phone);
    const nights = nightsBetween(booking.check_in, booking.check_out);
    const img = zimmer.images?.[0];
    const stay = zimmer.stay_settings || {};
    const checkinTime = stay.checkin_time || '15:00';
    const checkoutTime = stay.checkout_time || '11:00';

    return (
      <div className={PANEL} dir="rtl">
        <div className="flex items-start justify-between">
          <h3 className="font-simpler text-[24px] leading-normal" style={{ color: '#0B3838', fontWeight: 600 }}>פרטי ההזמנה</h3>
          <span className="min-w-[82px] inline-flex items-center justify-center px-[8px] py-[3px] rounded-full text-[13px] leading-normal"
            style={{ background: '#FFFF00', color: '#0B3838', fontWeight: 500 }}>
            {statusText(booking)}
          </span>
        </div>

        {img && (
          <div className="h-[218px] w-full rounded-[16px] overflow-hidden flex-shrink-0" style={{ background: '#FAFAFA' }}>
            <img src={img} alt={zimmer.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex flex-col gap-[4px]">
          <h2 className="text-[35px] leading-normal" style={{ color: '#0B3838', fontWeight: 700 }}>{zimmer.name}</h2>
          {zimmer.location && (
            <div className="flex items-center gap-[10px]">
              <img src={iconPin} alt="" width={13} height={15} className="flex-shrink-0" />
              <span className="text-[15px] leading-normal underline" style={{ color: '#717171' }}>{zimmer.location}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-[12px]">
          <button type="button" className="font-simpler w-full p-[12px] rounded-[35px] text-[16px] leading-normal text-white hover:opacity-90" style={{ background: '#0B3838' }}>
            צפייה בהזמנה
          </button>
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"
              className="w-full h-[41px] p-[12px] rounded-[35px] flex items-center justify-center gap-[12px] text-[14px] leading-normal hover:bg-[#FAFAFA]"
              style={{ border: '1px solid rgba(11,56,56,0.21)', color: '#0B3838', fontWeight: 500 }}>
              <img src={iconWhatsapp} alt="" width={16} height={16} className="flex-shrink-0" /> פתיחה ב-WhatsApp
            </a>
          )}
        </div>

        <div className="h-px w-full flex-shrink-0" style={{ background: '#E5E5E5' }} />

        <div className="h-[119px] rounded-[23px] flex items-center justify-center flex-shrink-0" style={{ background: '#FAFAFA' }}>
          <div className="w-full max-w-[346px] flex items-start justify-between py-[4px]">
            <StayCol label="צ׳ק-אין" day={fmtStayDay(booking.check_in)} time={checkinTime} />
            <div className="w-px h-[68px] self-center flex-shrink-0" style={{ background: '#E5E5E5' }} />
            <StayCol label="צ׳ק-אאוט" day={fmtStayDay(booking.check_out)} time={checkoutTime} />
          </div>
        </div>

        <div className="flex flex-col gap-[16px]">
          <DetailRow label="משך שהות" value={`${nights} לילות`} />
          <DetailRow label="אורחים" value={`${booking.num_guests || 1} אורחים`} />
          {booking.total_price != null && <DetailRow label={'סה״כ לתשלום'} value={`₪${booking.total_price.toLocaleString('he-IL')}`} strong />}
        </div>

        <div className="h-px w-full flex-shrink-0" style={{ background: '#E5E5E5' }} />
      </div>
    );
  }

  const wa = waPhone(contact.phone);
  const zimmerNames = Array.from(new Set(
    (contact.threads || []).map(t => t.zimmer_name).filter(Boolean)
      .concat((contact.questions || []).map(q => q.zimmer_name).filter(Boolean))
  ));

  return (
    <div className={PANEL} dir="rtl">
      <h3 className="font-simpler text-[24px] leading-normal" style={{ color: '#0B3838', fontWeight: 600 }}>פרטי לקוח</h3>

      <div className="flex flex-col items-center gap-[4px]">
        <ContactAvatar name={contact.name} />
        <h2 className="text-[24px] leading-normal mt-2" style={{ color: '#0B3838', fontWeight: 700 }}>{contact.name || 'לקוח'}</h2>
        {contact.phone && (
          <div className="flex items-center gap-1.5 text-[15px]" style={{ color: '#717171' }}>
            <Phone size={13} /> <span dir="ltr">{contact.phone}</span>
          </div>
        )}
        {contact.staysCount > 0 && (
          <div className="flex items-center gap-1.5 text-[15px]" style={{ color: '#717171' }}>
            <CalendarCheck size={13} /> {contact.staysCount} שהיות קודמות
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[12px]">
        <button type="button" onClick={onAddBooking} className="font-simpler w-full p-[12px] rounded-[35px] text-[16px] leading-normal text-white hover:opacity-90" style={{ background: '#0B3838' }}>
          צור הזמנה
        </button>
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"
            className="w-full h-[41px] p-[12px] rounded-[35px] flex items-center justify-center gap-[12px] text-[14px] leading-normal hover:bg-[#FAFAFA]"
            style={{ border: '1px solid rgba(11,56,56,0.21)', color: '#0B3838', fontWeight: 500 }}>
            <img src={iconWhatsapp} alt="" width={16} height={16} className="flex-shrink-0" /> פתיחה ב-WhatsApp
          </a>
        )}
      </div>

      {loadingBooking && <div className="text-center text-[13px]" style={{ color: '#6B7280' }}>טוען הזמנה…</div>}

      <div className="h-px w-full flex-shrink-0" style={{ background: '#E5E5E5' }} />

      <div className="flex flex-col gap-[12px]">
        <p className="text-[16px] leading-normal" style={{ color: '#6B7280', fontWeight: 500 }}>פנה לגבי הצימרים</p>
        {zimmerNames.length === 0
          ? <p className="text-[15px]" style={{ color: '#6B7280' }}>—</p>
          : zimmerNames.map(n => (
            <div key={n} className="flex items-center gap-2 text-[15px] leading-[1.5]" style={{ color: '#0B3838' }}>
              <Home size={14} style={{ color: '#6B7280' }} /> {n}
            </div>
          ))}
      </div>
    </div>
  );
}

function StayCol({ label, day, time }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-[4px] whitespace-nowrap">
      <span className="text-[12px] leading-normal" style={{ color: '#6B7280' }}>{label}</span>
      <span className="text-[15px] leading-[1.5]" style={{ color: '#0B3838' }}>{day}</span>
      <span className="text-[16px] leading-normal" style={{ color: '#0B3838', fontWeight: 500 }}>{time}</span>
    </div>
  );
}

function DetailRow({ label, value, strong = false }) {
  return (
    <div className="flex items-start justify-between whitespace-nowrap">
      <span className="text-[16px] leading-normal" style={{ color: '#6B7280', fontWeight: 500 }}>{label}</span>
      <span className={strong ? 'text-[16px] leading-normal' : 'text-[15px] leading-[1.5]'} style={{ color: '#0B3838', fontWeight: strong ? 500 : 400 }}>{value}</span>
    </div>
  );
}
