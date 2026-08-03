import React, { useState } from 'react';
import { X, CalendarClock, Users, Phone, User } from 'lucide-react';
import { formatILS } from '@/lib/bookingPrice';

const MODES = {
  respond: { title: 'פרסום הביקורת עם תגובה', btn: 'פרסם עם תגובה', color: '#16A34A' },
  compromise: { title: 'הצעת פשרה ללקוח', btn: 'שלח הצעה', color: '#F97316' },
  dispute: { title: 'ערעור ופניה למנהלים', btn: 'שלח ערעור', color: '#EF4444' },
  view_booking: { title: 'פרטי ההזמנה', btn: 'סגור', color: '#6B7280' },
};

function BookingDetails({ review, booking }) {
  if (!booking) {
    return (
      <div className="p-3 rounded-xl text-xs mb-3" style={{ background: '#F8F7F4', color: '#9CA3AF' }}>
        <p>אין הזמנה מקושרת לביקורת זו.</p>
        {review.check_in && <p className="mt-1" style={{ color: '#6B7280' }}>תאריכים: {review.check_in} → {review.check_out}</p>}
      </div>
    );
  }
  return (
    <div className="p-3 rounded-xl mb-3 text-xs" style={{ background: '#F8F7F4' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <CalendarClock size={13} style={{ color: '#F97316' }} />
        <span className="font-bold" style={{ color: '#1A1A1A' }}>{review.zimmer_name}</span>
        <span className="mr-auto" style={{ color: '#9CA3AF' }}>{booking.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-2" style={{ color: '#4B5563' }}>
        <div className="flex items-center gap-1"><CalendarClock size={11} style={{ color: '#9CA3AF' }} /> {booking.check_in} → {booking.check_out}</div>
        <div className="flex items-center gap-1"><User size={11} style={{ color: '#9CA3AF' }} /> {booking.guest_name || review.guest_name}</div>
        {booking.guest_phone && <div className="flex items-center gap-1"><Phone size={11} style={{ color: '#9CA3AF' }} /> {booking.guest_phone}</div>}
        {booking.num_guests != null && booking.num_guests > 0 && <div className="flex items-center gap-1"><Users size={11} style={{ color: '#9CA3AF' }} /> {booking.num_guests} אורחים</div>}
      </div>
      {booking.total_price != null && (
        <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid #F0EEE8' }}>
          <span style={{ color: '#6B7280' }}>סה"כ הזמנה</span>
          <span className="font-black text-sm" style={{ color: '#F97316' }}>{formatILS(booking.total_price)}</span>
        </div>
      )}
    </div>
  );
}

export default function ReviewActionModal({ mode, review, booking, bookingTotal, onSubmit, onCancel, saving }) {
  const cfg = MODES[mode];
  const [response, setResponse] = useState(review?.owner_response || '');
  const [percent, setPercent] = useState(10);
  const [ownerNote, setOwnerNote] = useState('');
  const [reason, setReason] = useState('');

  const amount = Math.round((bookingTotal || 0) * percent / 100);
  const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', borderRadius: '12px', outline: 'none', color: '#1A1A1A' };

  const submit = (e) => {
    e.preventDefault();
    if (mode === 'view_booking') { onCancel(); return; }
    if (mode === 'respond') onSubmit({ owner_response: response });
    else if (mode === 'compromise') onSubmit({ percentage: percent, amount, owner_note: ownerNote });
    else if (mode === 'dispute') onSubmit({ dispute_reason: reason });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} dir="rtl">
      <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: '#fff' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-lg" style={{ color: '#1A1A1A' }}>{cfg.title}</h2>
          <button onClick={onCancel} type="button"><X size={18} style={{ color: '#9CA3AF' }} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode !== 'dispute' && (review.booking_id || booking) && <BookingDetails review={review} booking={booking} />}

          {mode === 'view_booking' && (
            <div className="text-center pb-2">
              <p className="text-xs" style={{ color: '#9CA3AF' }}>סקירת פרטי ההזמנה שעליה נכתבה הביקורת.</p>
            </div>
          )}

          {mode === 'respond' && (
            <div>
              <p className="text-xs mb-2" style={{ color: '#6B7280' }}>הביקורת תפורסם, ותגובתך תופיע מתחתיה.</p>
              <textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                rows={5}
                required
                placeholder="כתוב את תגובתך..."
                className="w-full px-4 py-3 text-sm resize-none"
                style={inputStyle}
              />
            </div>
          )}

          {mode === 'compromise' && (
            <>
              <div className="p-3 rounded-xl" style={{ background: '#F8F7F4' }}>
                <p className="text-xs" style={{ color: '#6B7280' }}>סכום ההזמנה: <b>{formatILS(bookingTotal || 0)}</b></p>
                <p className="text-lg font-black mt-1" style={{ color: '#F97316' }}>החזר: {formatILS(amount)} ({percent}%)</p>
              </div>
              <div>
                <input type="range" min={10} max={50} step={5} value={percent}
                  onChange={e => setPercent(Number(e.target.value))}
                  className="w-full accent-orange-500" />
                <div className="flex justify-between text-xs" style={{ color: '#9CA3AF' }}>
                  <span>10%</span><span>50%</span>
                </div>
              </div>
              <textarea
                value={ownerNote}
                onChange={e => setOwnerNote(e.target.value)}
                rows={3}
                placeholder="הערה מנומקת ללקוח (אופציונלי)"
                className="w-full px-4 py-3 text-sm resize-none"
                style={inputStyle}
              />
              <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
                אם הלקוח יסכים — הביקורת תוסר. אם יסרב — הביקורת תחזור אליך לפרסום עם תגובה.
              </p>
            </>
          )}

          {mode === 'dispute' && (
            <div>
              <p className="text-xs mb-2" style={{ color: '#EF4444' }}>
                אופציה זו מיועדת למקרים נדירים בלבד. המנהלים יבחנו את הערעור ויוכלו למנוע פרסום.
              </p>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={5}
                required
                placeholder="סיבה מפורטת למה לא לפרסם את הביקורת..."
                className="w-full px-4 py-3 text-sm resize-none"
                style={inputStyle}
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
              ביטול
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: cfg.color }}>
              {saving ? 'שולח...' : cfg.btn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}