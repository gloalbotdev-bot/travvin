import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import StarRating from './StarRating';
import { Image } from '@/components/ui/image';

const CATS = [
  { key: 'cat_match', label: 'התאמה' },
  { key: 'cat_cleanliness', label: 'ניקיון' },
  { key: 'cat_service', label: 'שירות' },
  { key: 'cat_location', label: 'מיקום' },
  { key: 'cat_value', label: 'תמורה' },
];

const ACCENT = '#0B3838';
const MUTED = '#717171';
const LINE = '#E8E8E8';
const SURFACE = '#FAFAFA';

export default function ReviewsSection({ zimmerId, variant = 'card' }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = React.useRef(null);
  const inline = variant === 'inline';

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

  const shellClass = inline
    ? 'flex flex-col gap-4 w-full items-stretch text-right'
    : 'rounded-[16px] p-5';
  const shellStyle = inline ? undefined : { background: '#fff', border: `1px solid ${LINE}` };

  if (loading) return null;

  if (!reviews.length) {
    return (
      <div dir="rtl" className={shellClass} style={shellStyle}>
        <h3
          className="font-simpler w-full text-right"
          style={{ color: ACCENT, fontSize: inline ? 20 : 18, fontWeight: 600 }}
        >
          ביקורות אורחים
        </h3>
        <p className="font-simona text-right" style={{ color: MUTED, fontSize: 15, lineHeight: '22px' }}>
          אין עדיין חוות דעת — היה הראשון לארח ולכתוב ביקורת לאחר החופשה.
        </p>
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
    <div dir="rtl" className={shellClass} style={shellStyle}>
      <div className="flex items-center justify-between gap-3 w-full">
        <h3
          className="font-simpler flex-1 text-right"
          style={{ color: ACCENT, fontSize: inline ? 20 : 18, fontWeight: 600 }}
        >
          ביקורות אורחים
        </h3>
        <div
          className="font-simona flex items-center gap-2 shrink-0"
          style={{ background: SURFACE, borderRadius: 17, padding: '6px 12px' }}
        >
          <span className="font-simpler" style={{ color: ACCENT, fontSize: 18, fontWeight: 600 }}>{avg.toFixed(1)}</span>
          <StarRating value={Math.round(avg)} size={14} color={ACCENT} />
          <span style={{ color: MUTED, fontSize: 13 }}>({reviews.length})</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full">
        {CATS.map(c => (
          <div key={c.key} className="text-center py-2.5 px-1" style={{ background: SURFACE, borderRadius: 12 }}>
            <div className="flex justify-center"><StarRating value={Math.round(catAvg(c.key))} size={11} color={ACCENT} /></div>
            <p className="font-simona mt-1" style={{ color: MUTED, fontSize: 11 }}>{c.label}</p>
          </div>
        ))}
      </div>

      <div className="relative w-full">
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 owner-hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {reviews.map((r) => {
            const name = r.customer_name || r.guest_name || 'אנונימי';
            return (
              <div
                key={r.id}
                className="snap-center flex-shrink-0 w-[88%] sm:w-[60%] md:w-[45%] p-4 text-right"
                style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-simpler text-xs flex-shrink-0"
                    style={{ background: '#EFEFEF', color: ACCENT, fontWeight: 600 }}
                  >
                    {name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-simpler truncate" style={{ color: ACCENT, fontSize: 14, fontWeight: 600 }}>{name}</p>
                    <StarRating value={r.rating || 0} size={11} color={ACCENT} />
                  </div>
                  <span className="font-simona whitespace-nowrap" style={{ color: MUTED, fontSize: 12 }}>
                    {(r.published_at || r.review_date || '').slice(0, 10)}
                  </span>
                </div>
                {r.text && (
                  <p className="font-simona leading-relaxed line-clamp-4" style={{ color: MUTED, fontSize: 14, lineHeight: '22px' }}>
                    {r.text}
                  </p>
                )}
                {r.images && r.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    {r.images.slice(0, 6).map((url, j) => (
                      <div key={j} className="aspect-square overflow-hidden" style={{ borderRadius: 10, border: `1px solid ${LINE}` }}>
                        <Image src={url} className="w-full h-full" fittingType="fill" />
                      </div>
                    ))}
                  </div>
                )}
                {r.owner_response && (
                  <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${LINE}` }}>
                    <p className="font-simpler mb-0.5" style={{ color: ACCENT, fontSize: 12, fontWeight: 600 }}>תגובת בעל המתחם:</p>
                    <p className="font-simona leading-relaxed line-clamp-2" style={{ color: MUTED, fontSize: 13, lineHeight: '20px' }}>{r.owner_response}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {reviews.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollByCards(-1)}
              className="absolute -left-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background: '#fff', border: `1px solid ${LINE}`, color: ACCENT }}
              aria-label="ביקורות קודמות"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => scrollByCards(1)}
              className="absolute -right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background: '#fff', border: `1px solid ${LINE}`, color: ACCENT }}
              aria-label="ביקורות הבאות"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
