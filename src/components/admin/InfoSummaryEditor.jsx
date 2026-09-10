import React, { useState } from 'react';
import { api } from '@/api/client';
import { X, CheckSquare, Square, RefreshCw, Sparkles, Calendar } from 'lucide-react';
import { zonesSignature } from '@/lib/infoSummary';

const ACCENT = '#0B3838';
const MUTED = '#717171';
const LINE = '#E8E8E8';
const SURFACE = '#FAFAFA';

const SOURCE_COLORS = {
  'שיחת טלפון': { bg: '#EFEFEF', color: ACCENT },
  'שיחת וואטסאפ': { bg: '#EFEFEF', color: ACCENT },
  'טקסט חופשי': { bg: SURFACE, color: MUTED },
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
      const zoneIndices = [...selected];
      const response = await api.assistant.chat({
        profile: 'generate_info_summary',
        message: 'צור סיכום מידע ללקוחות',
        clientState: {
          zimmerId: zimmer.id,
          zoneIndices: zoneIndices.length > 0 ? zoneIndices : zones.map((_, i) => i),
        },
      });
      setText((response?.message?.content || '').trim());
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4" style={{ background: 'rgba(11,56,56,0.45)' }} dir="rtl" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-[23px] sm:rounded-[23px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white/95 backdrop-blur" style={{ borderBottom: `1px solid ${LINE}` }}>
          <h2 className="font-simpler" style={{ color: ACCENT, fontSize: 18, fontWeight: 600 }}>סיכום מידע ללקוחות</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: SURFACE, color: MUTED }}
            aria-label="סגור"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="font-simpler text-right" style={{ color: ACCENT, fontSize: 15, fontWeight: 600 }}>
                בחר מאיזה אזורי מידע לקחת את הסיכום ({zones.length})
              </h3>
              <button
                type="button"
                onClick={toggleAll}
                className="font-simona shrink-0 transition-opacity hover:opacity-80"
                style={{ background: SURFACE, color: ACCENT, borderRadius: 17, padding: '6px 12px', fontSize: 12, fontWeight: 500 }}
              >
                {allSelected ? 'בטל בחירת הכל' : 'בחר הכל'}
              </button>
            </div>

            {zones.length === 0 ? (
              <div className="text-center py-6" style={{ background: SURFACE, borderRadius: 16, border: `1px dashed ${LINE}` }}>
                <p className="font-simona text-sm" style={{ color: MUTED }}>אין אזורי מידע עדיין. אפשר לכתוב סיכום ידנית למטה.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
                {zones.map((zone, i) => {
                  const sc = SOURCE_COLORS[zone.source_type] || SOURCE_COLORS['טקסט חופשי'];
                  const checked = selected.has(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggle(i)}
                      className="w-full text-right p-3 flex items-start gap-2.5 transition-opacity hover:opacity-90"
                      style={{
                        background: checked ? '#fff' : SURFACE,
                        borderRadius: 16,
                        border: `1.5px solid ${checked ? ACCENT : LINE}`,
                      }}
                    >
                      <span className="mt-0.5 flex-shrink-0" style={{ color: checked ? ACCENT : '#9CA3AF' }}>
                        {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {zone.source_type && (
                            <span className="font-simona text-xs px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color, fontWeight: 500 }}>
                              {zone.source_type}
                            </span>
                          )}
                          {zone.source_label && <span className="font-simona text-xs" style={{ color: MUTED }}>{zone.source_label}</span>}
                          {zone.source_date && (
                            <span className="font-simona text-xs flex items-center gap-1" style={{ color: MUTED }}>
                              <Calendar size={10} />{zone.source_date}
                            </span>
                          )}
                        </span>
                        <span className="font-simona block text-sm leading-relaxed line-clamp-3" style={{ color: MUTED }}>
                          {zone.content || '(ריק)'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={buildFromSelected}
                disabled={selected.size === 0}
                className="font-simona flex items-center gap-2 transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: SURFACE, color: ACCENT, borderRadius: 17, padding: '8px 14px', fontSize: 13, fontWeight: 500 }}
              >
                <RefreshCw size={13} /> בנה סיכום מהמסומנים
              </button>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={generating || zones.length === 0}
                className="font-simpler flex items-center gap-2 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: ACCENT, borderRadius: 123, padding: '8px 16px', fontSize: 13, fontWeight: 600 }}
              >
                {generating
                  ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> AI מסכם...</>
                  : <><Sparkles size={13} /> סיכום אוטומטי עם AI</>}
              </button>
            </div>
          </div>

          <div>
            <label className="font-simpler block mb-1.5 text-right" style={{ color: ACCENT, fontSize: 14, fontWeight: 600 }}>
              סיכום מידע (יהיה זהה לבעל המתחם וללקוח)
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              placeholder="כתוב/ערוך כאן את הסיכום שיופיע ללקוח..."
              className="font-simona w-full px-4 py-3 outline-none resize-none"
              style={{
                background: SURFACE,
                border: `1.5px solid ${LINE}`,
                borderRadius: 16,
                color: ACCENT,
                fontSize: 15,
                lineHeight: '24px',
              }}
            />
            <p className="font-simona mt-1.5 text-right" style={{ color: MUTED, fontSize: 12 }}>
              בשמירה, חתימת אזורי המידע הנוכחית נשמרת — כך נדע להודיע לך בכניסה הבאה אם נוסף מידע חדש שלא מסונכרן.
            </p>
          </div>

          <div className="flex gap-3 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="font-simona flex-1 py-3 transition-opacity hover:opacity-80"
              style={{ border: `1.5px solid ${LINE}`, color: MUTED, background: 'transparent', borderRadius: 123, fontSize: 14, fontWeight: 500 }}
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!text.trim()}
              className="font-simpler flex-1 text-white py-3 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: ACCENT, borderRadius: 123, fontSize: 14, fontWeight: 600 }}
            >
              שמור סיכום
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
