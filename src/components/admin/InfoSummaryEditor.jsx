import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, CheckSquare, Square, RefreshCw, Sparkles } from 'lucide-react';
import { Calendar } from 'lucide-react';
import { zonesSignature } from '@/lib/infoSummary';

const SOURCE_COLORS = {
  'שיחת טלפון': { bg: 'rgba(59,130,246,0.08)', color: '#3B82F6' },
  'שיחת וואטסאפ': { bg: 'rgba(34,197,94,0.08)', color: '#16A34A' },
  'טקסט חופשי': { bg: '#F8F7F4', color: '#6B7280' },
};

export default function InfoSummaryEditor({ zimmer, onSave, onClose }) {
  const zones = zimmer.data_zones || [];
  const [selected, setSelected] = useState(() => new Set(zones.map((_, i) => i)));
  const [text, setText] = useState(zimmer.info_summary || '');
  const [generating, setGenerating] = useState(false);

  const sourceZones = () => {
    const ids = selected.size > 0 ? selected : new Set(zones.map((_, i) => i));
    return zones.filter((_, i) => ids.has(i));
  };

  const handleGenerateAI = async () => {
    const picked = sourceZones();
    if (picked.length === 0) return;
    setGenerating(true);
    try {
      const raw = picked.map((z, i) => {
        const label = z.source_label || z.source_type || `מקור ${i + 1}`;
        return `[${label}] ${z.content || ''}`;
      }).join('\n');
      const prompt = `אתה עוזר של בעל צימר. להלן מידע שנאסף על הצימר ממספר מקורות (שיחות, שאלות, טקסט חופשי). כתוב סיכום מידע אחד בעברית שיוצג ללקוחות בדף הצימר.

כללים:
- פסקה אחת או רשימה קצרה, ברורה ומזמינה.
- הדגש פרטים שימושיים: מתקנים, מדיניות, שעות כניסה/יציאה, אבזור, אזורים מיוחדים.
- אל תמציא מידע שלא מופיע למטה. אם חסר, פשוט דלג.
- טקסט רציף, בלי כותרות ובלי מרכאות.

המידע:
${raw}`;
      const res = await base44.integrations.Core.InvokeLLM({ prompt });
      setText(typeof res === 'string' ? res.trim() : (res?.text || res?.message || ''));
    } catch (e) { /* ignore */ }
    setGenerating(false);
  };

  const allSelected = zones.length > 0 && selected.size === zones.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(zones.map((_, i) => i)));
  const toggle = (i) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(i)) n.delete(i); else n.add(i);
    return n;
  });

  const buildFromSelected = () => {
    const parts = zones
      .map((z, i) => ({ z, i }))
      .filter(({ i }) => selected.has(i))
      .map(({ z }) => {
        const label = z.source_label || z.source_type || '';
        return label ? `• (${label}) ${z.content || ''}` : `• ${z.content || ''}`;
      });
    setText(parts.join('\n'));
  };

  const save = () => {
    onSave(text.trim(), zonesSignature(zones));
  };

  const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', borderRadius: '12px' };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.6)' }} dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()} style={{ fontFamily: 'Heebo, sans-serif' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid #F0EEE8' }}>
          <h2 className="font-black text-base" style={{ color: '#1A1A1A' }}>סיכום מידע ללקוחות</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F8F7F4', color: '#6B7280' }}><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Source zones to pick from */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#F97316' }}>בחר מאיזה אזורי מידע לקחת את הסיכום ({zones.length})</h3>
              <button type="button" onClick={toggleAll}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}>
                {allSelected ? 'בטל בחירת הכל' : 'בחר הכל'}
              </button>
            </div>

            {zones.length === 0 ? (
              <div className="text-center py-6 rounded-xl" style={{ background: '#F8F7F4', border: '1.5px dashed #E8E5E0' }}>
                <p className="text-sm" style={{ color: '#9CA3AF' }}>אין אזורי מידע עדיין. אפשר לכתוב סיכום ידנית למטה.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
                {zones.map((zone, i) => {
                  const sc = SOURCE_COLORS[zone.source_type] || SOURCE_COLORS['טקסט חופשי'];
                  const checked = selected.has(i);
                  return (
                    <button key={i} type="button" onClick={() => toggle(i)}
                      className="w-full text-right rounded-xl p-3 flex items-start gap-2.5 transition-all"
                      style={{ background: checked ? '#fff' : '#F8F7F4', border: `1.5px solid ${checked ? '#F97316' : '#E8E5E0'}` }}>
                      <span className="mt-0.5 flex-shrink-0" style={{ color: checked ? '#F97316' : '#9CA3AF' }}>
                        {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {zone.source_type && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: sc.bg, color: sc.color }}>{zone.source_type}</span>}
                          {zone.source_label && <span className="text-xs" style={{ color: '#6B7280' }}>{zone.source_label}</span>}
                          {zone.source_date && <span className="text-xs flex items-center gap-1" style={{ color: '#9CA3AF' }}><Calendar size={10} />{zone.source_date}</span>}
                        </span>
                        <span className="block text-sm leading-relaxed line-clamp-3" style={{ color: '#4B5563' }}>{zone.content || '(ריק)'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={buildFromSelected} disabled={selected.size === 0}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all disabled:opacity-50"
                style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}>
                <RefreshCw size={13} /> בנה סיכום מהמסומנים
              </button>
              <button type="button" onClick={handleGenerateAI} disabled={generating || zones.length === 0}
                className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#7C3AED' }}>
                {generating ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span> AI מסכם...</> : <><Sparkles size={13} /> סיכום אוטומטי עם AI</>}
              </button>
            </div>
          </div>

          {/* Summary text */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>סיכום מידע (יהיה זהה לבעל המתחם וללקוח)</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              placeholder="כתוב/ערוך כאן את הסיכום שיופיע ללקוח..."
              className="w-full px-4 py-3 text-sm outline-none resize-none leading-relaxed"
              style={inputStyle}
            />
            <p className="text-xs mt-1.5" style={{ color: '#9CA3AF' }}>בשמירה, חתימת אזורי המידע הנוכחית נשמרת — כך נדע להודיע לך בכניסה הבאה אם נוסף מידע חדש שלא מסונכרן.</p>
          </div>

          <div className="flex gap-3 pb-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ border: '1.5px solid #E8E5E0', color: '#6B7280', background: 'transparent' }}>
              ביטול
            </button>
            <button type="button" onClick={save}
              disabled={!text.trim()}
              className="flex-1 text-white py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: '#F97316' }}>
              שמור סיכום
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}