import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Star } from 'lucide-react';
import OwnerReviewCard, { REVIEW_STATUS } from '@/components/reviews/OwnerReviewCard';
import ReviewActionModal from '@/components/reviews/ReviewActionModal';
import { getBookingTotal } from '@/lib/bookingPrice';

export default function ReviewsPanel({ ownerId, focusReviewId }) {
  const [reviews, setReviews] = useState([]);
  const [zimmers, setZimmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { mode, review, booking, bookingTotal }
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!ownerId) return;
    const [revs, zims] = await Promise.all([
      api.entities.Review.filter({ owner_id: ownerId }, '-created_date', 200),
      api.entities.Zimmer.filter({ owner_id: ownerId }),
    ]);
    setReviews(revs);
    setZimmers(zims);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ownerId]);

  const openAction = async (review, mode) => {
    let booking = null;
    let bookingTotal = 0;
    if (review.booking_id) {
      try {
        booking = await api.entities.BookingRequest.get(review.booking_id);
        const z = zimmers.find(zz => zz.id === review.zimmer_id);
        bookingTotal = getBookingTotal(booking, z);
      } catch {}
    }
    setModal({ mode, review, booking, bookingTotal });
  };

  const runAction = async (data) => {
    setSaving(true);
    const r = modal.review;
    const now = new Date().toISOString();
    try {
      if (modal.mode === 'respond') {
        await api.entities.Review.update(r.id, {
          status: 'published',
          owner_response: data.owner_response,
          owner_response_at: now,
          published_at: now,
        });
      } else if (modal.mode === 'compromise') {
        await api.entities.Review.update(r.id, {
          status: 'compromise_offered',
          settlement_offer: {
            percentage: data.percentage,
            amount: data.amount,
            owner_note: data.owner_note,
            status: 'pending',
            offered_at: now,
          },
        });
      } else if (modal.mode === 'dispute') {
        await api.entities.Review.update(r.id, {
          status: 'disputed',
          dispute_reason: data.dispute_reason,
          disputed_at: now,
        });
      }
      await load();
    } catch (e) {
      alert('שגיאה: ' + e.message);
    }
    setSaving(false);
    setModal(null);
  };

  const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A', borderRadius: '12px', outline: 'none' };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  const needsAction = reviews.filter(r => ['pending_owner', 'compromise_offered', 'disputed'].includes(r.status));
  const pendingPublish = reviews.filter(r => r.status === 'pending_publish');
  const published = reviews.filter(r => r.status === 'published' || r.status === 'removed');
  const publishedOnly = reviews.filter(r => r.status === 'published');
  const avgRating = publishedOnly.length
    ? (publishedOnly.reduce((a, r) => a + (r.rating || 0), 0) / publishedOnly.length).toFixed(1)
    : null;

  const scrollTop = (id) => {
    setTimeout(() => {
      const el = document.getElementById('rev-' + id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>ביקורות</h1>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>{reviews.length} ביקורות · {needsAction.length} ממתינות לטיפול</p>
        </div>
        {avgRating && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <Star size={16} fill="#F97316" style={{ color: '#F97316' }} />
            <span className="font-black text-lg" style={{ color: '#1A1A1A' }}>{avgRating}</span>
            <span className="text-xs" style={{ color: '#9CA3AF' }}>({publishedOnly.length})</span>
          </div>
        )}
      </div>

      {/* Needs action */}
      {needsAction.length > 0 && (
        <section className="mb-8">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#EA580C' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#EA580C' }}></span>
            דרוש טיפול ({needsAction.length})
          </h2>
          <div className="space-y-3">
            {needsAction.map(r => (
              <div key={r.id} id={'rev-' + r.id}>
                <OwnerReviewCard review={r} onAction={(mode) => openAction(r, mode)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending auto-publish */}
      {pendingPublish.length > 0 && (
        <section className="mb-8">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#16A34A' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#16A34A' }}></span>
            ממתינות לפרסום אוטומטי ({pendingPublish.length})
          </h2>
          <div className="space-y-3">
            {pendingPublish.map(r => (
              <div key={r.id} id={'rev-' + r.id}>
                <OwnerReviewCard review={r} onAction={(mode) => openAction(r, mode)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Published */}
      <section>
        <h2 className="font-bold text-sm mb-3" style={{ color: '#6B7280' }}>פורסמו ({published.length})</h2>
        {published.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <Star size={40} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>אין ביקורות פורסמו עדיין</p>
          </div>
        ) : (
          <div className="space-y-3">
            {published.map(r => (
              <div key={r.id} id={'rev-' + r.id}>
                <OwnerReviewCard review={r} onAction={(mode) => openAction(r, mode)} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Action modal */}
      {modal && (
        <ReviewActionModal
          mode={modal.mode}
          review={modal.review}
          booking={modal.booking}
          bookingTotal={modal.bookingTotal}
          onSubmit={runAction}
          onCancel={() => setModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}