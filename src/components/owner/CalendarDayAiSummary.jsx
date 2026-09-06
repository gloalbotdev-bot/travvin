import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Loader2, TrendingUp, Sparkles } from 'lucide-react';

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * Concise, date-specific AI price summary shown inline when the "הצעות AI"
 * block in the calendar Quick Actions menu is expanded. Does NOT open the
 * personal assistant — that's the footer "פתח עם AI".
 */
export default function CalendarDayAiSummary({ iso, zimmers, bookings }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (!iso || !zimmers.length) return;
    setLoading(true); setError('');
    try {
      const dayBookings = (bookings || []).filter(
        (b) => b.check_in <= iso && b.check_out > iso && b.status !== 'נדחית' && !b.is_block
      );
      const occupiedIds = new Set(dayBookings.map((b) => b.zimmer_id));
      const zimmerInfo = zimmers.map((z) => ({
        name: z.name,
        base_price: z.price_per_night,
        weekday_price: z.weekday_price,
        weekend_price: z.weekend_price,
        occupied: occupiedIds.has(z.id),
        seasonal: (z.seasonal_pricing || []).filter((r) => r.start_date <= iso && r.end_date >= iso),
      }));
      const date = new Date(iso + 'T00:00:00');
      const dayName = HEB_DAYS[date.getDay()];
      const res = await api.integrations.Core.InvokeLLM({
        prompt: `אתה יועץ תמחור לבעל צימרים. תן סיכום מתומצת (עד 3 משפטים) והמלצת מחיר לכל נכס לתאריך ${iso} (יום ${dayName}), בהתחשב בתפוסה, יום בשבוע, עונתיות ושוק.\nנכסים: ${JSON.stringify(zimmerInfo)}.\nהחזר JSON בלבד.`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  zimmer_name: { type: 'string' },
                  recommended_price: { type: 'number' },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
      });
      setData(res);
    } catch (e) {
      setError('שגיאה. נסה שוב.');
    }
    setLoading(false);
  };

  useEffect(() => { run(); /* eslint-disable-next-line */ }, [iso]);

  return (
    <div dir="rtl" className="px-3.5 py-3" style={{ fontFamily: 'Heebo, sans-serif' }}>
      {loading && (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
          <Loader2 size={14} className="animate-spin" style={{ color: '#F97316' }} />
          מנתח מחירים לתאריך…
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!loading && !error && data && (
        <div className="space-y-2.5 max-h-52 overflow-y-auto pr-0.5">
          {data.summary && (
            <p className="text-xs leading-relaxed" style={{ color: '#062319' }}>{data.summary}</p>
          )}
          {(data.recommendations || []).map((r, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl p-2.5" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.1)' }}>
                <TrendingUp size={13} style={{ color: '#EA580C' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold" style={{ color: '#062319' }}>{r.zimmer_name}</p>
                <p className="text-sm font-black mt-0.5" style={{ color: '#EA580C' }}>₪{r.recommended_price}<span className="text-[10px] font-medium" style={{ color: '#9CA3AF' }}> /לילה</span></p>
                {r.reason && <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#6B7280' }}>{r.reason}</p>}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1 text-[10px]" style={{ color: '#9CA3AF' }}>
            <Sparkles size={10} /> סיכום מתומצת · לניתוח מלא פתח עם AI
          </div>
        </div>
      )}
    </div>
  );
}