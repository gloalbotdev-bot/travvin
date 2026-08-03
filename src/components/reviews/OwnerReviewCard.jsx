import React from 'react';
import StarRating from './StarRating';
import { Shield, MessageSquareReply, Handshake, Trash2, CalendarClock } from 'lucide-react';
import { formatILS } from '@/lib/bookingPrice';

export const REVIEW_STATUS = {
  pending_publish: { label: 'ממתין לפרסום אוטומטי', bg: 'rgba(34,197,94,0.12)', color: '#16A34A' },
  pending_owner: { label: 'ממתין לטיפולך', bg: 'rgba(249,115,22,0.12)', color: '#EA580C' },
  compromise_offered: { label: 'הוצעה פשרה — ממתין ללקוח', bg: 'rgba(59,130,246,0.12)', color: '#2563EB' },
  published: { label: 'פורסמה', bg: 'rgba(34,197,94,0.12)', color: '#16A34A' },
  disputed: { label: 'ממתין למנהל', bg: 'rgba(239,68,68,0.12)', color: '#EF4444' },
  removed: { label: 'נמחקה', bg: 'rgba(107,114,128,0.12)', color: '#6B7280' },
};

function MiniCats({ review }) {
  const items = [
    ['התאמה', review.cat_match],
    ['ניקיון', review.cat_cleanliness],
    ['שירות', review.cat_service],
    ['מיקום', review.cat_location],
    ['תמורה', review.cat_value],
  ].filter(([, v]) => v);
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-5 gap-2 mt-3">
      {items.map(([label, v]) => (
        <div key={label} className="text-center">
          <div className="flex justify-center"><StarRating value={v} size={12} /></div>
          <p className="text-[9px] mt-0.5" style={{ color: '#9CA3AF' }}>{label}</p>
        </div>
      ))}
    </div>
  );
}

export default function OwnerReviewCard({ review, onAction, isAdmin }) {
  const st = REVIEW_STATUS[review.status] || REVIEW_STATUS.published;
  const offer = review.settlement_offer || {};
  const showOffer = offer.percentage != null && (review.status === 'compromise_offered' || offer.status === 'declined' || offer.status === 'accepted');
  const name = review.customer_name || review.guest_name || 'אנונימי';

  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
            {name[0]}
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{name}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>{review.zimmer_name}</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
      </div>

      <div className="flex items-center gap-2">
        <StarRating value={review.rating || 0} size={16} />
        <span className="text-xs" style={{ color: '#9CA3AF' }}>{review.review_date}</span>
      </div>

      <MiniCats review={review} />

      {review.text && <p className="text-sm leading-relaxed mt-3" style={{ color: '#374151' }}>{review.text}</p>}

      {showOffer && (
        <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: 'rgba(59,130,246,0.06)' }}>
          <p className="font-semibold" style={{ color: '#2563EB' }}>
            הצעת פשרה: {offer.percentage}% = {formatILS(offer.amount)}
          </p>
          {offer.owner_note && <p className="mt-1" style={{ color: '#374151' }}>{offer.owner_note}</p>}
          {offer.status === 'declined' && (
            <p className="mt-1 font-semibold" style={{ color: '#EF4444' }}>
              הלקוח סירב{offer.customer_note ? `: ${offer.customer_note}` : ''}
            </p>
          )}
          {offer.status === 'accepted' && (
            <p className="mt-1 font-semibold" style={{ color: '#16A34A' }}>הלקוח אישר — הביקורת הוסרה.</p>
          )}
        </div>
      )}

      {review.owner_response && (
        <div className="mt-3 p-3 rounded-xl" style={{ background: '#F8F7F4' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>תגובתך:</p>
          <p className="text-sm" style={{ color: '#374151' }}>{review.owner_response}</p>
        </div>
      )}

      {review.dispute_reason && (
        <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.06)' }}>
          <p className="font-semibold" style={{ color: '#EF4444' }}>סיבת הערעור:</p>
          <p className="mt-1" style={{ color: '#374151' }}>{review.dispute_reason}</p>
        </div>
      )}

      {review.booking_id && (
        <div className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
          <CalendarClock size={12} style={{ color: '#9CA3AF' }} />
          <span>{review.check_in} → {review.check_out}</span>
          {review.guest_name && <span>· {review.guest_name}</span>}
          <button onClick={() => onAction('view_booking')} className="mr-auto font-semibold hover:underline" style={{ color: '#F97316' }}>פרטי ההזמנה ←</button>
        </div>
      )}

      {isAdmin && (
        <button onClick={() => onAction('delete')}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.06)', color: '#EF4444' }}>
          <Trash2 size={12} /> מחיקת ביקורת
        </button>
      )}

      {(review.status === 'pending_publish' || review.status === 'pending_owner') && (
        <div className="mt-4 pt-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid #F0EEE8' }}>
          {review.status === 'pending_publish' && (
            <button onClick={() => onAction('dispute')}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.06)', color: '#EF4444' }}>
              <Shield size={13} /> ערער למנהל
            </button>
          )}
          {review.status === 'pending_owner' && (
            <>
              <button onClick={() => onAction('respond')}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg text-white"
                style={{ background: '#16A34A' }}>
                <MessageSquareReply size={13} /> פרסם עם תגובה
              </button>
              <button onClick={() => onAction('compromise')}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
                style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
                <Handshake size={13} /> הצע פשרה
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}