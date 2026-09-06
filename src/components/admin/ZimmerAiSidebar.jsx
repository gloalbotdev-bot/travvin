import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Sparkles, CalendarPlus, Lock, Tag, Send, Mic, Bell, Info, ChevronUp, ChevronDown, ChevronLeft, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import ZimmerInlineChat from '@/components/admin/ZimmerInlineChat';

const nextFridayStr = () => {
  const d = new Date();
  const dow = d.getDay();
  const offset = (5 - dow + 7) % 7;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const overlap = (aIn, aOut, bIn, bOut) => new Date(aIn) < new Date(bOut) && new Date(aOut) > new Date(bIn);

function buildItems(z) {
  const imgs = z.images || [];
  const amens = z.amenities || [];
  const hasParking = amens.some(a => /חני/.test(a));
  const desc = z.description || '';
  return [
    { label: 'פרטי הנכס הבסיסיים', done: !!(z.name && z.location && z.price_per_night) },
    { label: "שעות צ'ק-אין וצ'ק-אאוט", done: !!(z.stay_settings?.checkin_time && z.stay_settings?.checkout_time), status: 'חסר מידע' },
    { label: 'תמונות הנכס', done: imgs.length >= 3, status: `מומלץ להוסיף ${Math.max(0, 3 - imgs.length)} תמונות` },
    { label: 'כתובת ומיקום', done: !!(z.stay_settings?.lat != null && z.stay_settings?.lng != null), status: 'חסר מיקום במפה' },
    { label: 'מתקנים ושירותים', done: amens.length >= 3, status: 'חסר מידע' },
    { label: 'מידע על חניה', done: hasParking, status: 'חסר' },
    { label: 'תיאור הנכס', done: desc.length > 60, status: !desc ? 'חסר' : 'ניתן לשפר', ai: !desc || desc.length <= 60 },
  ];
}

export default function ZimmerAiSidebar({ zimmer, onAddBooking, onBlockDate, onUpdatePrice, onOpenCheckin, onFillMissing }) {
  const [draft, setDraft] = useState('');
  const [showMissing, setShowMissing] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(true);

  const items = buildItems(zimmer);
  const done = items.filter(c => c.done).length;
  const pct = Math.round((done / items.length) * 100);
  const missing = items.filter(c => !c.done);
  const autoOn = (zimmer.stay_settings?.customer_triggers || []).some(t => t.enabled);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [questions, bookings] = await Promise.all([
          api.entities.UnansweredQuestion.filter({ zimmer_id: zimmer.id, status: 'ממתינה' }),
          api.entities.BookingRequest.filter({ zimmer_id: zimmer.id, status: 'אושרה' }),
        ]);
        const fri = nextFridayStr();
        const freeWeekend = !bookings.some(b => overlap(b.check_in, b.check_out, fri, fri));
        const list = [];
        if (questions.length > 0) {
          list.push({
            title: 'לקוחות שואלים על הנכס',
            body: 'שאלה חוזרת: ' + (questions[0].question || '').slice(0, 70),
          });
        } else if (missing.length > 0) {
          list.push({ title: 'מידע חסר בנכס', body: `כדאי להוסיף פרטים על ${missing[0].label.toLowerCase()} ועוד ${missing.length - 1} פריטים.` });
        } else {
          list.push({ title: 'הנכס מלא במידע', body: 'כל הפריטים החיוניים מולאו. כדאי לרענן תמונות מדי פעם.' });
        }
        if (freeWeekend) {
          list.push({ title: 'הסופ"ש הקרוב פנוי', body: 'יש לילות פנויות בסוף השבוע — כדאי להציע הנחה קטנה כדי להגדיל סיכוי לסגירה.' });
        } else {
          list.push({ title: 'תפוסה גבוהה', body: 'הסופ"ש הקרוב תפוס. כדאי לבדוק תאריכים פנויים אחרים למבצע.' });
        }
        if (!cancelled) setSuggestions(list.slice(0, 2));
      } catch {
        if (!cancelled) setSuggestions([]);
      }
      if (!cancelled) setLoadingSugg(false);
    })();
    return () => { cancelled = true; };
  }, [zimmer.id]);

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setChatPrompt(t);
    setChatOpen(true);
    setDraft('');
  };

  const quickActions = [
    { label: 'הוספת הזמנה', icon: CalendarPlus, onClick: onAddBooking },
    { label: 'חסימת תאריך', icon: Lock, onClick: onBlockDate },
    { label: 'עדכון מחיר', icon: Tag, onClick: onUpdatePrice },
  ];

  return (
    <div className="space-y-4" dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      {/* AI suggestions header */}
      <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.12)' }}>
            <Sparkles size={16} style={{ color: '#A855F7' }} />
          </div>
          <h3 className="font-black text-sm" style={{ color: '#1A1A1A' }}>הצעות AI</h3>
        </div>

        {/* Progress — expandable completion list */}
        <div className="rounded-xl p-3 mb-4" style={{ background: '#F9FAFB', border: '1.5px solid #F0EEE8' }}>
          <button type="button" onClick={() => setShowMissing(s => !s)} className="w-full flex items-center justify-between">
            <div className="text-right">
              <div className="text-sm font-bold" style={{ color: '#111827' }}>{pct}% מהמידע הושלם</div>
              <div className="text-xs" style={{ color: '#6B7280' }}>{missing.length} פריטים חשובים עדיין חסרים</div>
            </div>
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#fff', border: '1.5px solid #E5E7EB' }}>
              {showMissing ? <ChevronUp size={13} style={{ color: '#6B7280' }} /> : <ChevronDown size={13} style={{ color: '#6B7280' }} />}
            </div>
          </button>
          <div className="h-2 rounded-full overflow-hidden mt-2.5" style={{ background: '#E5E7EB' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#10B981' }} />
          </div>
          {showMissing && (
            <div className="mt-3 space-y-1">
              {items.map((it, i) => (
                <div key={i}
                  className={`flex items-center gap-2.5 py-1.5 px-1 rounded-lg transition-colors ${it.done ? '' : 'cursor-pointer hover:bg-white'}`}
                  onClick={it.done ? undefined : () => onFillMissing?.(i)}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                    style={it.done
                      ? { background: 'rgba(16,185,129,0.12)', color: '#10B981' }
                      : { background: '#fff', border: '1.5px solid #E5E7EB', color: '#6B7280' }}>
                    {it.done ? <Check size={13} /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium" style={{ color: '#111827' }}>{it.label}</div>
                    {!it.done && it.status && <div className="text-[11px] mt-0.5" style={{ color: '#6B7280' }}>{it.status}</div>}
                  </div>
                  {!it.done && (
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {it.ai && (
                        <button type="button"
                          onClick={() => { setChatPrompt(`שפר את "${it.label}" של הצימר`); setChatOpen(true); }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: '#3B82F6', color: '#fff' }}>שפר עם AI</button>
                      )}
                      <ChevronLeft size={14} style={{ color: '#9CA3AF' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {quickActions.map(a => (
            <button key={a.label} onClick={a.onClick}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all hover:opacity-80"
              style={{ background: '#F9FAFB', border: '1.5px solid #F0EEE8' }}>
              <a.icon size={16} style={{ color: '#1E293B' }} />
              <span className="text-[11px] font-semibold text-center" style={{ color: '#1A1A1A' }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Toggles */}
        <div className="space-y-2.5 mb-4">
          <div className="flex items-center justify-between rounded-xl p-2.5" style={{ background: '#F9FAFB' }}>
            <div className="flex items-center gap-2">
              <Bell size={14} style={{ color: '#6B7280' }} />
              <span className="text-xs font-medium" style={{ color: '#1A1A1A' }}>הודעות אוטומטיות לאורחים</span>
            </div>
            <Switch checked={autoOn} onCheckedChange={() => onOpenCheckin?.()} />
          </div>
          <div className="flex items-center justify-between rounded-xl p-2.5" style={{ background: '#F9FAFB' }}>
            <div className="flex items-center gap-2">
              <Info size={14} style={{ color: '#6B7280' }} />
              <span className="text-xs font-medium" style={{ color: '#1A1A1A' }}>בדיקת מידע חסר</span>
            </div>
            <Switch checked={showMissing} onCheckedChange={setShowMissing} />
          </div>
        </div>

        {/* AI input / inline chat */}
        {chatOpen ? (
          <ZimmerInlineChat zimmer={zimmer} initialPrompt={chatPrompt}
            onClose={() => { setChatOpen(false); setChatPrompt(''); }} />
        ) : (
          <div className="rounded-xl p-2 flex items-center gap-2" style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB' }}>
            <input value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="מה תרצי לשנות או לבדוק בצימר?"
              className="flex-1 bg-transparent outline-none text-xs" style={{ color: '#1A1A1A' }} />
            <Mic size={15} style={{ color: '#9CA3AF' }} />
            <button onClick={submit} disabled={!draft.trim()}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
              style={{ background: '#1E293B', color: '#fff' }}>
              <Send size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Improvement suggestions */}
      <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <h3 className="font-black text-sm mb-3" style={{ color: '#1A1A1A' }}>הצעות לשיפור</h3>
        {loadingSugg ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-xs" style={{ color: '#9CA3AF' }}>אין הצעות כרגע.</p>
        ) : (
          <div className="space-y-2.5">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #F0EEE8' }}>
                <div className="flex items-start gap-2">
                  <Sparkles size={13} style={{ color: '#A855F7', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p className="text-xs font-bold" style={{ color: '#1A1A1A' }}>{s.title}</p>
                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: '#6B7280' }}>{s.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}