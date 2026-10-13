import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Loader2 } from 'lucide-react';

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const INK = '#0B3838';

/** Date-specific AI price advice: { summary, recommendations[{ zimmer_name, recommended_price, reason }] }. */
export function useDayPriceAdvice(iso, zimmers, bookings) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (!iso || !zimmers.length) return;
    setLoading(true); setError(''); setData(null);
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

  useEffect(() => { run(); }, [iso, zimmers.length]);

  return { loading, data, error, retry: run };
}

/** Concise date-specific price summary shown inline in the calendar day popup. */
export default function CalendarDayAiSummary({ iso, zimmers, bookings }) {
  const { loading, data, error } = useDayPriceAdvice(iso, zimmers, bookings);

  return (
    <div dir="rtl" className="font-simona" style={{ padding: '4px 12px 8px', color: INK }}>
      {loading && (
        <div className="flex items-center gap-2" style={{ fontSize: 14, opacity: 0.7 }}>
          <Loader2 size={14} className="animate-spin" />
          מנתח מחירים לתאריך…
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!loading && !error && data && (
        <div className="flex flex-col max-h-52 overflow-y-auto" style={{ gap: 10 }}>
          {data.summary && <p style={{ fontSize: 14, lineHeight: 1.4 }}>{data.summary}</p>}
          {(data.recommendations || []).map((r, i) => (
            <div key={i} className="flex flex-col" style={{ background: '#FAFAFA', borderRadius: 12, padding: '10px 12px', gap: 2 }}>
              <p style={{ fontSize: 14, fontWeight: 500 }}>{r.zimmer_name}</p>
              <p className="font-simpler" style={{ fontSize: 18, fontWeight: 600 }}>₪{r.recommended_price}<span className="font-simona" style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}> /לילה</span></p>
              {r.reason && <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.35 }}>{r.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
