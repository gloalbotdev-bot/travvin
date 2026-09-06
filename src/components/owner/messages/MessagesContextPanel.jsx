import React from 'react';
import { CalendarDays, Users, Wallet, Clock, Eye, MessageCircle, Plus, MapPin } from 'lucide-react';

const waPhone = (p) => {
  const d = (p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) return '972' + d.slice(1);
  return d;
};
const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }); } catch { return d; } };

export default function MessagesContextPanel({ category, thread, booking, zimmer, question, onAction, onAddBooking }) {
  // CHATS with a linked booking → reservation details card
  if (category === 'chats' && thread && booking) {
    const img = zimmer?.images?.[0];
    const ci = zimmer?.stay_settings?.checkin_time || '15:00';
    const co = zimmer?.stay_settings?.checkout_time || '11:00';
    const wa = waPhone(booking.guest_phone);
    return (
      <div className="h-full overflow-y-auto p-4" dir="rtl">
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <div className="h-40 relative" style={{ background: '#F8F7F4' }}>
            {img
              ? <img src={img} alt={zimmer?.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#EAD5FF 0%,#FFD4C2 100%)' }}><MapPin size={32} style={{ color: '#9CA3AF' }} /></div>}
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-bold text-sm flex-1 truncate" style={{ color: '#1A1A1A' }}>{zimmer?.name || thread.zimmer_name}</h3>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: '#16A34A' }}>הזמנה מאושרת</span>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={() => onAction?.('open_booking', booking.id)} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: '#1A1A1A' }}>
                <Eye size={14} /> צפייה בהזמנה
              </button>
              {wa
                ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="flex-1 py-2.5 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5" style={{ border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}>
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                : <span className="flex-1 py-2.5 rounded-xl text-xs font-bold text-center opacity-50" style={{ border: '1.5px solid #F0EEE8', color: '#9CA3AF' }}>אין טלפון</span>}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Detail icon={CalendarDays} label="תאריכים" value={`${fmtDate(booking.check_in)} - ${fmtDate(booking.check_out)}`} />
              <Detail icon={Clock} label="משך שהייה" value={`${nightsBetween(booking.check_in, booking.check_out)} לילות`} />
              <Detail icon={Users} label="אורחים" value={`${booking.num_guests || '-'} אורחים`} />
              <Detail icon={Wallet} label="סה״כ לתשלום" value={booking.total_price ? `₪${booking.total_price}` : '-'} />
            </div>
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#F0EEE8' }}>
              <div className="flex items-center gap-1.5 text-xs"><Clock size={13} style={{ color: '#9CA3AF' }} /><span style={{ color: '#9CA3AF' }}>צ'ק-אין</span><span className="font-bold" style={{ color: '#1A1A1A' }}>{ci}</span></div>
              <div className="w-px h-6" style={{ background: '#F0EEE8' }} />
              <div className="flex items-center gap-1.5 text-xs"><Clock size={13} style={{ color: '#9CA3AF' }} /><span style={{ color: '#9CA3AF' }}>צ'ק-אאוט</span><span className="font-bold" style={{ color: '#1A1A1A' }}>{co}</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CHATS without a booking → compact customer card + create booking
  if (category === 'chats' && thread) {
    return (
      <div className="h-full overflow-y-auto p-4" dir="rtl">
        <div className="rounded-2xl p-5 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-xl font-bold" style={{ background: '#075E54' }}>{(thread.customer_name || 'ל').slice(0, 1)}</div>
          <h3 className="font-bold text-sm mb-1" style={{ color: '#1A1A1A' }}>{thread.customer_name || 'לקוח'}</h3>
          <p className="text-xs mb-4" style={{ color: '#9CA3AF' }}>פנה לגבי: {thread.zimmer_name}</p>
          <button onClick={onAddBooking} className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2" style={{ background: '#1A1A1A' }}>
            <Plus size={15} /> צור הזמנה
          </button>
        </div>
      </div>
    );
  }

  // QUESTIONS → zimmer context + search context
  if (category === 'questions' && question) {
    const img = zimmer?.images?.[0];
    return (
      <div className="h-full overflow-y-auto p-4" dir="rtl">
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <div className="h-32 relative" style={{ background: '#F8F7F4' }}>
            {img
              ? <img src={img} alt={question.zimmer_name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#EAD5FF 0%,#FFD4C2 100%)' }}><MapPin size={28} style={{ color: '#9CA3AF' }} /></div>}
          </div>
          <div className="p-4">
            <h3 className="font-bold text-sm mb-2" style={{ color: '#1A1A1A' }}>{question.zimmer_name}</h3>
            {question.customer_search_summary && (
              <div className="rounded-xl p-3 text-xs mb-3" style={{ background: '#F8F7F4', color: '#6B7280' }}>
                <span className="font-bold">הקשר החיפוש:</span> {question.customer_search_summary}
              </div>
            )}
            <div className="text-xs" style={{ color: '#9CA3AF' }}>הלקוח: {question.customer_name || 'אנונימי'}</div>
          </div>
        </div>
      </div>
    );
  }

  // SYSTEM / empty
  return (
    <div className="h-full flex items-center justify-center p-6 text-center" dir="rtl">
      <div>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#F8F7F4' }}><MessageCircle size={26} style={{ color: '#D1D5DB' }} /></div>
        <p className="text-sm" style={{ color: '#9CA3AF' }}>פרטים נוספים יופיעו כאן</p>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#F8F7F4' }}>
      <div className="flex items-center gap-1.5 mb-1"><Icon size={12} style={{ color: '#9CA3AF' }} /><span className="text-[11px]" style={{ color: '#9CA3AF' }}>{label}</span></div>
      <p className="text-sm font-bold" style={{ color: '#1A1A1A' }}>{value}</p>
    </div>
  );
}