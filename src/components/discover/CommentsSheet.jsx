import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { X, Star } from 'lucide-react';

// Bottom sheet showing the published reviews of the zimmer (the "comments").
// Glassmorphism dark, no write field. If the video had comments_hidden by an
// admin, the list is replaced with a notice.
export default function CommentsSheet({ video, onClose }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.entities.Review.filter({ zimmer_id: video.zimmer_id, status: 'published' }, '-published_at', 50)
      .then((r) => { if (active) { setReviews(r || []); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [video.zimmer_id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }} dir="rtl" onClick={onClose}>
      <div className="w-full rounded-t-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: '85dvh', background: 'rgba(20,20,22,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}>
        {/* grip + header */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }} />
        </div>
        <div className="px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-base">תגובות · {video.zimmer_name}</h3>
            <p className="text-white/50 text-xs">{reviews.length} ביקורות</p>
          </div>
          <button onClick={onClose} className="rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)', width: 40, height: 40, minHeight: 40 }}>
            <X size={18} className="text-white" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : video.comments_hidden ? (
            <div className="text-center py-10">
              <p className="text-white/70 text-sm">תגובות הוסתרו על ידי מנהל המערכת.</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white/60 text-sm">אין עדיין ביקורות פורסמו לצימר הזה.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-white font-semibold text-sm">{r.customer_name || r.guest_name || 'אורח'}</p>
                    <Stars value={r.rating} />
                  </div>
                  {r.text && <p className="text-white/80 text-sm leading-relaxed">{r.text}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stars({ value }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} fill={n <= Math.round(value || 0) ? '#FBBF24' : 'transparent'} color={n <= Math.round(value || 0) ? '#FBBF24' : 'rgba(255,255,255,0.3)'} />
      ))}
    </div>
  );
}