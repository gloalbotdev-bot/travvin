import React, { useState } from 'react';
import { api } from '@/api/client';
import { Loader2, ArrowLeft, Wand2 } from 'lucide-react';
import iconTag from '@/assets/owner/calendar/pill-price.svg';
import iconChevron from '@/assets/owner/bookings/sidebar-chevron.svg';

const TYPE_META = {
  price_update: { label: 'עדכון מחיר', color: '#1D4ED8' },
  open_availability: { label: 'פתיחת זמינות', color: '#16A34A' },
  discount: { label: 'הנחה', color: '#EA580C' },
  review_period: { label: 'בדיקת תקופה', color: '#7C3AED' },
};

export default function CalendarAiSuggestions({ onApply, variant, expanded = false, stat = null }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  const analyze = async () => {
    setLoading(true); setError('');
    try {
      // The server loads zimmers + bookings itself.
      const res = await api.assistant.chat({
        profile: 'owner_calendar_suggestions',
        message: 'נתח את היומן',
        clientState: {},
      });
      setItems(res?.meta?.parsed?.suggestions || []);
    } catch (e) { setError('שגיאה בניתוח. נסה שוב.'); }
    setLoading(false);
  };

  if (variant === 'card') {
    const shown = expanded ? items : items.slice(0, 1);
    return (
      <div dir="rtl" className="flex flex-col" style={{ gap: 16 }}>
        {items.length === 0 && (
          <SuggestionCard
            title="הצעות לשיפור היומן"
            body={error || 'לחצי על "נתח את היומן" כדי לקבל הצעות חכמות.'}
            cta={loading ? 'מנתח את היומן…' : 'נתח את היומן'}
            busy={loading}
            onCta={analyze}
            stat={stat}
          />
        )}
        {shown.map((s, i) => {
          const meta = TYPE_META[s.type] || TYPE_META.review_period;
          return <SuggestionCard key={i} title={s.title} body={s.description} cta={meta.label} onCta={() => onApply?.(s)} stat={i === 0 ? stat : null} />;
        })}
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-3">
      <button onClick={analyze} disabled={loading} type="button"
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
        style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C', border: '1.5px solid rgba(249,115,22,0.25)' }}>
        {loading ? <><Loader2 size={15} className="animate-spin" /> מנתח את היומן…</> : <><Wand2 size={15} /> נתח את היומן</>}
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((s, i) => {
            const meta = TYPE_META[s.type] || TYPE_META.review_period;
            return (
              <div key={i} className="rounded-xl p-3" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5" style={{ background: `${meta.color}15`, color: meta.color }}>{meta.label}</span>
                <p className="text-sm font-semibold leading-snug" style={{ color: '#1A1A1A' }}>{s.title}</p>
                <p className="text-xs mt-1 leading-snug" style={{ color: '#6B7280' }}>{s.description}</p>
                <button onClick={() => onApply?.(s)} type="button"
                  className="mt-2 flex items-center gap-1 text-xs font-bold transition-all hover:opacity-70" style={{ color: '#0B1B2A' }}>
                  בצע <ArrowLeft size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {items.length === 0 && !loading && !error && (
        <p className="text-xs text-center py-3" style={{ color: '#9CA3AF' }}>לחץ על "נתח את היומן" כדי לקבל הצעות חכמות.</p>
      )}
    </div>
  );
}

/* Figma 1776:18971 — suggestion card */
function SuggestionCard({ title, body, cta, onCta, busy, stat }) {
  return (
    <div className="w-full flex flex-col items-center" style={{ background: '#FAFAFA', borderRadius: 23, padding: '32px 18px 22px', gap: 24 }}>
      <div className="flex flex-col text-right" style={{ width: '100%', maxWidth: 266, gap: 7, color: '#0B3838' }}>
        <p className="font-simpler" style={{ fontSize: 22, fontWeight: 600, lineHeight: 'normal' }}>{title}</p>
        <p className="font-simona" style={{ fontSize: 15, lineHeight: 'normal' }}>{body}</p>
      </div>
      {stat && (
        /* Figma 1776:18757 — monthly occupancy box */
        <div className="flex flex-col items-center justify-center text-center" style={{ width: '100%', maxWidth: 243, minHeight: 153, background: '#FFFF00', borderRadius: 19, padding: '16px 12px', color: '#0B3838' }}>
          <span className="font-simona" style={{ fontSize: 18, fontWeight: 500, opacity: 0.8, lineHeight: 'normal' }}>{stat.label}</span>
          <span className="font-simona" style={{ fontSize: 38.5, fontWeight: 500, lineHeight: 'normal' }}>{stat.value}</span>
          {stat.sub && <span className="font-simona" style={{ fontSize: 16, lineHeight: 'normal' }}>{stat.sub}</span>}
        </div>
      )}
      <div className="w-full flex flex-col items-center" style={{ gap: 12, paddingTop: 6 }}>
        <div className="w-full" style={{ height: 1, background: 'rgba(0,0,0,0.17)' }} />
        <button
          type="button"
          onClick={onCta}
          disabled={busy}
          className="w-full flex items-center justify-between transition-opacity hover:opacity-80 disabled:opacity-60"
          style={{ maxWidth: 308 }}
        >
          <span className="flex items-center" style={{ gap: 12 }}>
            <span className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 29, background: '#fff', borderRadius: 7 }}>
              {busy ? <Loader2 size={14} className="animate-spin" style={{ color: '#0B3838' }} /> : <img src={iconTag} alt="" width={15} height={15} className="block" />}
            </span>
            <span className="font-simona" style={{ color: '#0B3838', fontSize: 18, fontWeight: 500 }}>{cta}</span>
          </span>
          <img src={iconChevron} alt="" width={8} height={14} className="block flex-shrink-0" />
        </button>
      </div>
    </div>
  );
}