import React, { useState } from 'react';
import { api } from '@/api/client';
import { Sparkles, Loader2, ArrowLeft, Wand2 } from 'lucide-react';

const TYPE_META = {
  price_update: { label: 'עדכון מחיר', color: '#1D4ED8' },
  open_availability: { label: 'פתיחת זמינות', color: '#16A34A' },
  discount: { label: 'הנחה', color: '#EA580C' },
  review_period: { label: 'בדיקת תקופה', color: '#7C3AED' },
};

export default function CalendarAiSuggestions({ ownerId, zimmers, bookings, onApply }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  const analyze = async () => {
    setLoading(true); setError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const occupancy = bookings.filter(b => b.status === 'אושרה' && b.check_in >= today && b.check_in <= in30).length;
      const pending = bookings.filter(b => b.status === 'ממתינה').length;
      const zimmerList = zimmers.map(z => `${z.name} (מחיר ${z.price_per_night || '?'}/לילה)`).join(', ');
      const prompt = `אתה עוזר ניהול לבעל צימרים. נתח את היומן ותן 3-4 הצעות פעולה קצרות לשיפור הכנסה ותפוסה.\nנכסים: ${zimmerList}\nהזמנות ב-30 הימים הקרובים: ${occupancy}\nהזמנות ממתינות: ${pending}\nתאריך נוכחי: ${today}\nהחזר JSON בלבד.`;
      const res = await api.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['price_update', 'open_availability', 'discount', 'review_period'] },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  zimmer_name: { type: 'string' },
                  start_date: { type: 'string' },
                  end_date: { type: 'string' },
                  value: { type: 'number' },
                },
                required: ['type', 'title', 'description'],
              },
            },
          },
        },
      });
      setItems(res?.suggestions || []);
    } catch (e) { setError('שגיאה בניתוח. נסה שוב.'); }
    setLoading(false);
  };

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