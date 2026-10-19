import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Loader2 } from 'lucide-react';

const INK = '#0B3838';

/** Date-specific AI price advice: { summary, recommendations[{ zimmer_name, recommended_price, reason }] }. */
export function useDayPriceAdvice(iso, zimmers) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (!iso || !zimmers.length) return;
    setLoading(true); setError(''); setData(null);
    try {
      // The server loads zimmers + bookings for the day itself.
      const res = await api.assistant.chat({
        profile: 'owner_calendar_day_advice',
        message: `סיכום מחירים ל-${iso}`,
        clientState: { date: iso },
      });
      setData(res?.meta?.parsed || null);
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
