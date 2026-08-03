import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Star, PenLine, Check, X, Handshake } from 'lucide-react';
import ReviewForm from '@/components/reviews/ReviewForm';
import StarRating from '@/components/reviews/StarRating';
import { Image } from '@/components/ui/image';
import { formatILS } from '@/lib/bookingPrice';

const STATUS = {
  pending_publish: { label: 'ממתין לפרסום', bg: 'rgba(34,197,94,0.12)', color: '#16A34A' },
  pending_owner: { label: 'ממתין לטיפול בעל המתחם', bg: 'rgba(249,115,22,0.12)', color: '#EA580C' },
  compromise_offered: { label: 'הוצעה פשרה — ממתין לתגובתך', bg: 'rgba(59,130,246,0.12)', color: '#2563EB' },
  published: { label: 'פורסמה', bg: 'rgba(34,197,94,0.12)', color: '#16A34A' },
  disputed: { label: 'בעררור אצל מנהלים', bg: 'rgba(239,68,68,0.12)', color: '#EF4444' },
  removed: { label: 'נמחקה', bg: 'rgba(107,114,128,0.12)', color: '#6B7280' },
};

const daysSince = (dateStr) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);

export default function CustomerReviewsTab({ user, focusReviewId }) {
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [zimmers, setZimmers] = useState({});
  const [loading, setLoading] = useState(true);
  const [writingBooking, setWritingBooking] = useState(null);
  const [saving, setSaving] = useState(false);
  const [declineFor, setDeclineFor] = useState(null);
  const [declineNote, setDeclineNote] = useState('');

  const load = async () => {
    if (!user?.id) return;
    const [bs, rs] = await Promise.all([
      base44.entities.BookingRequest.filter({ created_by_id: user.id }, '-created_date', 500),
      base44.entities.Review.filter({ customer_id: user.id }, '-created_date', 200),
    ]);
    setBookings(bs);
    setReviews(rs);
    const zids = [...new Set(bs.map(b => b.zimmer_id).filter(Boolean))];
    const zm = {};
    await Promise.all(zids.map(async id => { try { zm[id] = await base44.entities.Zimmer.get(id); } catch {} }));
    setZimmers(zm);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const reviewedBookingIds = new Set(reviews.map(r => r.booking_id).filter(Boolean));
  const eligible = bookings.filter(b =>
    b.status === 'אושרה' &&
    b.check_out &&
    (() => { const d = daysSince(b.check_out); return d >= 0 && d <= 7; })() &&
    !reviewedBookingIds.has(b.id)
  );

  const submitReview = async (booking, data) => {
    setSaving(true);
    let ownerId = booking.owner_id || zimmers[booking.zimmer_id]?.owner_id;
    if (!ownerId) {
      try { const z = await base44.entities.Zimmer.get(booking.zimmer_id); ownerId = z?.owner_id; } catch {}
    }
    const now = new Date();
    const autoMs = now.getTime() + (data.general >= 4 ? 12 : 48) * 3600000;
    const reviewableUntil = new Date(new Date(booking.check_out).getTime() + 7 * 86400000).toISOString();
    const status = data.general >= 4 ? 'pending_publish' : 'pending_owner';
    try {
      const created = await base44.entities.Review.create({
        zimmer_id: booking.zimmer_id,
        zimmer_name: booking.zimmer_name,
        owner_id: ownerId,
        booking_id: booking.id,
        customer_id: user.id,
        customer_name: user.full_name,
        guest_name: user.full_name,
        check_in: booking.check_in,
        check_out: booking.check_out,
        rating: data.general,
        cat_match: data.cats.match,
        cat_cleanliness: data.cats.cleanliness,
        cat_service: data.cats.service,
        cat_location: data.cats.location,
        cat_value: data.cats.value,
        text: data.text,
        images: data.images || [],
        status,
        source: 'ידני',
        review_date: now.toISOString().split('T')[0],
        auto_publish_at: new Date(autoMs).toISOString(),
        reviewable_until: reviewableUntil,
      });
      if (ownerId) {
        await base44.functions.invoke('pushInAppNotification', {
          audience: 'owner',
          target_user_ids: [ownerId],
          category: 'הודעה',
          title: 'ביקורת חדשה התקבלה',
          body: `${data.general}/5 דירוג על ${booking.zimmer_name}.`,
          action_type: 'open_review',
          action_entity_id: created.id,
        });
      }
      await load();
    } catch (e) {
      alert('שגיאה: ' + e.message);
    }
    setSaving(false);
    setWritingBooking(null);
  };

  const acceptCompromise = async (review) => {
    await base44.entities.Review.update(review.id, {
      status: 'removed',
      settlement_offer: { ...review.settlement_offer, status: 'accepted', resolved_at: new Date().toISOString() },
    });
    await base44.functions.invoke('pushInAppNotification', {
      audience: 'owner',
      target_user_ids: [review.owner_id],
      category: 'הודעה',
      title: 'הלקוח אישר את הפשרה',
      body: `הביקורת על ${review.zimmer_name} הוסרה.`,
      action_type: 'open_review',
      action_entity_id: review.id,
    });
    load();
  };

  const declineCompromise = async (review) => {
    if (!declineNote.trim()) { alert('נא למלא תגובה מנומקת לבעל הצימר.'); return; }
    await base44.entities.Review.update(review.id, {
      status: 'pending_owner',
      settlement_offer: { ...review.settlement_offer, status: 'declined', customer_note: declineNote.trim(), resolved_at: new Date().toISOString() },
    });
    await base44.functions.invoke('pushInAppNotification', {
      audience: 'owner',
      target_user_ids: [review.owner_id],
      category: 'הודעה',
      title: 'הלקוח סירב לפשרה',
      body: `הלקוח סירב להצעת הפשרה. ניתן לפרסם את הביקורת עם תגובה.`,
      action_type: 'open_review',
      action_entity_id: review.id,
    });
    setDeclineFor(null);
    setDeclineNote('');
    load();
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div dir="rtl">
      <h1 className="text-2xl font-black mb-1" style={{ color: '#1A1A1A' }}>הביקורות שלי</h1>
      <p className="text-sm mb-6" style={{ color: '#9CA3AF' }}>
        ניתן לבקר צימר רק בשבוע הראשון לאחר הצ\'ק-אאוט.
      </p>

      {/* Eligible to review */}
      {eligible.length > 0 && (
        <section className="mb-8">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#EA580C' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#EA580C' }}></span>
            ממתין לביקורת שלך ({eligible.length})
          </h2>
          <div className="space-y-3">
            {eligible.map(b => {
              const z = zimmers[b.zimmer_id];
              return (
                <div key={b.id} className="rounded-2xl p-4 flex items-center justify-between" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{b.zimmer_name}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{b.check_in} → {b.check_out}{z?.location ? ` · ${z.location}` : ''}</p>
                  </div>
                  <button onClick={() => setWritingBooking(b)}
                    className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-lg"
                    style={{ background: '#F97316' }}>
                    <PenLine size={13} /> כתוב ביקורת
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* My reviews */}
      <section>
        <h2 className="font-bold text-sm mb-3" style={{ color: '#6B7280' }}>הביקורות שלי ({reviews.length})</h2>
        {reviews.length === 0 && !eligible.length ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <Star size={40} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>אין ביקורות עדיין</p>
            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>לאחר שתשהייה בצימר תסתיים, תוכל/י לכתוב ביקורת כאן.</p>
          </div>
        ) : reviews.length === 0 ? null : (
          <div className="space-y-3">
            {reviews.map(r => {
              const st = STATUS[r.status] || STATUS.published;
              const offer = r.settlement_offer || {};
              const showOffer = r.status === 'compromise_offered' && offer.percentage != null;
              return (
                <div key={r.id} className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{r.zimmer_name}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>{r.review_date}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <StarRating value={r.rating || 0} size={18} />
                  </div>
                  {r.text && <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{r.text}</p>}
                  {r.images && r.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {r.images.slice(0, 6).map((url, i) => (
                        <div key={i} className="aspect-square rounded-xl overflow-hidden" style={{ border: '1.5px solid #F0EEE8' }}>
                          <Image src={url} className="w-full h-full" fittingType="fill" />
                        </div>
                      ))}
                    </div>
                  )}

                  {showOffer && (
                    <div className="mt-3 p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Handshake size={15} style={{ color: '#2563EB' }} />
                        <p className="font-bold text-sm" style={{ color: '#2563EB' }}>
                          הצעת פשרה: החזר {offer.percentage}% = {formatILS(offer.amount)}
                        </p>
                      </div>
                      {offer.owner_note && <p className="text-xs mb-3" style={{ color: '#374151' }}>{offer.owner_note}</p>}

                      {declineFor === r.id ? (
                        <div className="mt-2">
                          <textarea value={declineNote} onChange={e => setDeclineNote(e.target.value)}
                            rows={3} placeholder="תגובה מנומקת לבעל הצימר..."
                            className="w-full px-3 py-2 text-sm resize-none mb-2" style={{ background: '#fff', border: '1.5px solid #E8E5E0', borderRadius: '10px', outline: 'none' }} />
                          <div className="flex gap-2">
                            <button onClick={() => declineCompromise(r)}
                              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white py-2.5 rounded-lg"
                              style={{ background: '#EF4444' }}>
                              <X size={13} /> שלח סירוב
                            </button>
                            <button onClick={() => { setDeclineFor(null); setDeclineNote(''); }}
                              className="px-3 py-2.5 rounded-lg text-xs font-semibold"
                              style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
                              ביטול
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => acceptCompromise(r)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white py-2.5 rounded-lg"
                            style={{ background: '#16A34A' }}>
                            <Check size={13} /> אני מסכים/ה — הסרת הביקורת
                          </button>
                          <button onClick={() => setDeclineFor(r.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
                            <X size={13} /> סרב ותן תגובה
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {offer.status === 'accepted' && r.status === 'removed' && (
                    <p className="text-xs mt-2" style={{ color: '#16A34A' }}>הסכמת לפשרה — הביקורת הוסרה.</p>
                  )}

                  {r.owner_response && r.status === 'published' && (
                    <div className="mt-3 p-3 rounded-xl" style={{ background: '#F8F7F4' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>תגובת בעל המתחם:</p>
                      <p className="text-sm" style={{ color: '#374151' }}>{r.owner_response}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {writingBooking && (
        <ReviewForm
          booking={writingBooking}
          zimmer={zimmers[writingBooking.zimmer_id]}
          saving={saving}
          onSubmit={(data) => submitReview(writingBooking, data)}
          onCancel={() => setWritingBooking(null)}
        />
      )}
    </div>
  );
}