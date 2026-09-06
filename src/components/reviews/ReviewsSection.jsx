import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import StarRating from './StarRating';
import { Image } from '@/components/ui/image';

const CATS = [
  { key: 'cat_match', label: 'התאמה' },
  { key: 'cat_cleanliness', label: 'ניקיון' },
  { key: 'cat_service', label: 'שירות' },
  { key: 'cat_location', label: 'מיקום' },
  { key: 'cat_value', label: 'תמורה' },
];

export default function ReviewsSection({ zimmerId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const scrollRef = React.useRef(null);

  useEffect(() => {
    if (!zimmerId) return;
    (async () => {
      try {
        const data = await api.entities.Review.filter({ zimmer_id: zimmerId, status: 'published' }, '-published_at', 50);
        setReviews(data || []);
      } catch { setReviews([]); }
      setLoading(false);
    })();
  }, [zimmerId]);

  if (loading) return null;
  if (!reviews.length) {
    return (
      <div dir="rtl" className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <div className="flex items-center gap-2 mb-1">
          <Star size={18} style={{ color: '#F0EEE8' }} />
          <h3 className="font-black text-sm" style={{ color: '#1A1A1A' }}>ביקורות אורחים</h3>
        </div>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>אין עדיין חוות דעת — היה הראשון לארח ולכתוב ביקורת לאחר החופשה.</p>
      </div>
    );
  }

  const avg = (reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length) || 0;
  const catAvg = (key) => {
    const vals = reviews.map(r => r[key]).filter(v => v != null);
    return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
  };

  const scrollByCards = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.85), behavior: 'smooth' });
  };

  return (
    <div dir="rtl" className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Star size={18} fill="#F97316" style={{ color: '#F97316' }} />
          <h3 className="font-black text-sm" style={{ color: '#1A1A1A' }}>ביקורות אורחים</h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(249,115,22,0.08)' }}>
          <span className="font-black text-lg" style={{ color: '#F97316' }}>{avg.toFixed(1)}</span>
          <StarRating value={Math.round(avg)} size={14} />
          <span className="text-xs" style={{ color: '#9CA3AF' }}>({reviews.length})</span>
        </div>
      </div>

      {/* Category averages */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {CATS.map(c => (
          <div key={c.key} className="text-center rounded-xl py-2 px-1" style={{ background: '#F8F7F4' }}>
            <div className="flex justify-center"><StarRating value={Math.round(catAvg(c.key))} size={11} /></div>
            <p className="text-[9px] mt-0.5" style={{ color: '#9CA3AF' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Carousel */}
      <div className="relative">
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2" style={{ scrollbarWidth: 'thin' }}>
          {reviews.map((r, i) => {
            const name = r.customer_name || r.guest_name || 'אנונימי';
            return (
              <div key={r.id} className="snap-center flex-shrink-0 w-[88%] sm:w-[60%] md:w-[45%] rounded-xl p-4" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>{name[0]}</div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate" style={{ color: '#1A1A1A' }}>{name}</p>
                    <StarRating value={r.rating || 0} size={11} />
                  </div>
                  <span className="text-[10px] mr-auto whitespace-nowrap" style={{ color: '#9CA3AF' }}>{(r.published_at || r.review_date || '').slice(0, 10)}</span>
                </div>
                {r.text && <p className="text-xs leading-relaxed line-clamp-4" style={{ color: '#374151' }}>{r.text}</p>}
                {r.images && r.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    {r.images.slice(0, 6).map((url, j) => (
                      <div key={j} className="aspect-square rounded-lg overflow-hidden" style={{ border: '1px solid #F0EEE8' }}>
                        <Image src={url} className="w-full h-full" fittingType="fill" />
                      </div>
                    ))}
                  </div>
                )}
                {r.owner_response && (
                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid #F0EEE8' }}>
                    <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#6B7280' }}>תגובת בעל המתחם:</p>
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#4B5563' }}>{r.owner_response}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {reviews.length > 1 && (
          <>
            <button onClick={() => scrollByCards(-1)} className="absolute -left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:scale-105 transition" style={{ background: '#fff', border: '1.5px solid #F0EEE8', color: '#6B7280' }}>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => scrollByCards(1)} className="absolute -right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:scale-105 transition" style={{ background: '#fff', border: '1.5px solid #F0EEE8', color: '#6B7280' }}>
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}