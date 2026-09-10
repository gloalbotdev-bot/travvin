import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Check } from 'lucide-react';
import ZimmerInlineChat from '@/components/admin/ZimmerInlineChat';
import MicButton from '@/components/chat/MicButton';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';

/* Figma PNGs from user Downloads (Frame 101 / Group 48099121) */
import iconFigmaBooking from '@/assets/owner/properties/icon-action-booking.png';
import iconFigmaBlock from '@/assets/owner/properties/icon-action-block.png';
import iconFigmaPrice from '@/assets/owner/properties/icon-action-price.png';
import iconBell from '@/assets/owner/home/icon-bell-figma.svg';
import iconInfo from '@/assets/owner/properties/icon-info-safe.svg';
import iconChevronLeft from '@/assets/owner/calendar/chevron-action.svg';
import iconChevronDown from '@/assets/owner/properties/checklist-chevron.svg';
import iconMic from '@/assets/owner/home/icon-mic.svg';
import iconSend from '@/assets/owner/home/icon-send.svg';
import iconPlus from '@/assets/owner/home/icon-plus.svg';
import iconSparkles from '@/assets/owner/home/btn-ai-sparkles.svg';

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

function FigmaSwitch({ checked, onCheckedChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className="relative shrink-0 transition-colors"
      style={{
        width: 40,
        height: 21,
        borderRadius: 22,
        background: checked ? '#0B3838' : '#EFEFEF',
      }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all"
        style={{
          width: 15.5,
          height: 15.5,
          background: checked ? '#EFEFEF' : '#0B3838',
          left: checked ? 21 : 4,
        }}
      />
    </button>
  );
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
        } else if (missing.length > 0 && /חני/.test(missing.map(m => m.label).join(' '))) {
          list.push({
            title: 'הרבה לקוחות שואלים על חניה — כדאי להוסיף מידע לנכס?',
            body: 'כדאי להוסיף מידע לנכס על חניה מקורה / חניה פרטית.',
          });
        } else if (missing.length > 0) {
          list.push({
            title: 'מידע חסר בנכס',
            body: `כדאי להוסיף פרטים על ${missing[0].label.toLowerCase()} ועוד ${Math.max(0, missing.length - 1)} פריטים.`,
          });
        } else {
          list.push({ title: 'הנכס מלא במידע', body: 'כל הפריטים החיוניים מולאו. כדאי לרענן תמונות מדי פעם.' });
        }
        if (freeWeekend) {
          list.push({
            title: 'הסופ״ש הקרוב פנוי',
            body: 'אפשר להציע הנחה קטנה כדי להגדיל סיכוי לסגירה.',
          });
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
    { label: 'הוספת הזמנה', icon: iconFigmaBooking, onClick: onAddBooking, iconW: 54, iconH: 50 },
    { label: 'חסום תאריך', icon: iconFigmaBlock, onClick: onBlockDate, iconW: 54, iconH: 52 },
    { label: 'עדכון מחיר', icon: iconFigmaPrice, onClick: onUpdatePrice, iconW: 48, iconH: 54 },
  ];

  return (
    <div className="flex flex-col gap-5 w-full max-w-[428px] mx-auto lg:mr-0 lg:ml-auto" dir="rtl">
      {/* Title RIGHT, sparkle FAR LEFT — Figma 1011:1363/1364/1365 */}
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center justify-between w-full gap-3">
          <h2
            className="font-simpler text-right"
            style={{ color: '#0B3838', fontSize: 26, fontWeight: 600, lineHeight: 'normal', unicodeBidi: 'plaintext' }}
          >
            הצעות AI
          </h2>
          <span
            className="overflow-hidden shrink-0 flex items-center justify-center"
            style={{ width: 22, height: 20, marginLeft: 15 }}
            aria-hidden
          >
            <img src={iconSparkles} alt="" width={18} height={17} className="block" style={{ width: 18, height: 17 }} />
          </span>
        </div>
        <p
          className="font-simona text-right"
          style={{ color: '#6B7280', fontSize: 12, fontWeight: 400, unicodeBidi: 'plaintext' }}
        >
          AI שיעזור לך לשפר ולנהל את הנכס
        </p>
      </div>

      {/* Progress — Figma 1011:1367: chevron LEFT↓, text RIGHT, fill from RIGHT, % on LEFT */}
      <div
        className="bg-white w-full flex flex-col gap-3 overflow-hidden pt-3.5 px-6 sm:px-9 text-right"
        style={{ borderRadius: 9, minHeight: showMissing ? undefined : 151 }}
      >
        <div className="flex flex-col gap-3 w-full">
          <button type="button" onClick={() => setShowMissing(s => !s)} className="flex items-center justify-between w-full gap-3">
            <div className="flex flex-col items-end gap-1 flex-1 text-right min-w-0">
              <span className="font-simpler w-full" style={{ color: '#0B3838', fontSize: 18, fontWeight: 600 }}>
                {pct}% מהמידע הושלם
              </span>
              <span className="font-simona w-full" style={{ color: '#717171', fontSize: 15, fontWeight: 400 }}>
                {missing.length} פריטים חשובים עדיין חסרים
              </span>
            </div>
            <span
              className="overflow-hidden shrink-0 flex items-center justify-center"
              style={{
                width: 16,
                height: 16,
                /* Figma: chevron-left rotated -90° = points down when collapsed open state */
                transform: showMissing ? 'rotate(-90deg)' : 'rotate(90deg)',
              }}
            >
              <img src={iconChevronDown} alt="" width={16} height={16} className="block w-full h-full" />
            </span>
          </button>

          <div className="flex flex-col gap-2 w-full" dir="ltr">
            {/* % on the far left of the bar — Figma 1011:1367 */}
            <div className="flex justify-start w-full">
              <span style={{ color: '#0B3838', fontSize: 12, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div className="w-full overflow-hidden flex justify-end" style={{ height: 5, borderRadius: 999, background: '#E4E7E5' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#0B3838' }} />
            </div>
          </div>

          {showMissing && (
            <div className="mt-1 space-y-1 w-full text-right">
              {items.map((it, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 py-1.5 px-1 rounded-lg ${it.done ? '' : 'cursor-pointer hover:bg-[#FAFAFA]'}`}
                  onClick={() => { if (!it.done) onFillMissing?.(i); }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                    style={it.done
                      ? { background: 'rgba(11,56,56,0.12)', color: '#0B3838' }
                      : { background: '#fff', border: '1.5px solid #E5E7EB', color: '#6B7280' }}
                  >
                    {it.done ? <Check size={13} /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="font-simona text-xs" style={{ color: '#0B3838', fontWeight: 400 }}>{it.label}</div>
                    {!it.done && it.status && (
                      <div className="font-simona text-[11px] mt-0.5" style={{ color: '#717171' }}>{it.status}</div>
                    )}
                  </div>
                  {!it.done && (
                    <span className="overflow-hidden shrink-0" style={{ width: 12, height: 16 }}>
                      <img src={iconChevronLeft} alt="" width={12} height={16} className="block w-full h-full" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions + toggles + AI input */}
      <div className="bg-white w-full flex flex-col gap-3 items-stretch pt-3.5 px-4 sm:px-6 pb-4" style={{ borderRadius: 9 }}>
        <div className="grid grid-cols-3 gap-2.5 w-full">
          {quickActions.map(a => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="flex flex-col items-center justify-center gap-[7px] py-2 px-1 transition-opacity hover:opacity-80"
              style={{ background: '#FAFAFA', borderRadius: 20, minHeight: 111 }}
            >
              <span className="flex items-center justify-center overflow-hidden" style={{ width: 54, height: 54 }}>
                <img
                  src={a.icon}
                  alt=""
                  width={a.iconW}
                  height={a.iconH}
                  className="block object-contain"
                  style={{ width: a.iconW, height: a.iconH, maxWidth: '100%', maxHeight: '100%' }}
                />
              </span>
              <span className="font-simona text-center leading-tight" style={{ color: '#0B3838', fontSize: 14, fontWeight: 400 }}>
                {a.label}
              </span>
            </button>
          ))}
        </div>

        {/* Toggles — icon RIGHT, label, switch LEFT */}
        <div className="flex flex-col gap-3 w-full py-2">
          <div className="flex items-center gap-3 w-full">
            <span
              className="shrink-0 flex items-center justify-center"
              style={{ width: 37, height: 37, borderRadius: 25, background: '#EFEFEF' }}
            >
              <img src={iconBell} alt="" width={18} height={20} className="block" style={{ width: 18, height: 20 }} />
            </span>
            <span className="font-simona flex-1 text-right" style={{ color: '#0B3838', fontSize: 16, fontWeight: 400 }}>
              הודעות אוטומטיות לאורחים
            </span>
            <FigmaSwitch checked={autoOn} onCheckedChange={() => onOpenCheckin?.()} />
          </div>
          <div className="flex items-center gap-3 w-full">
            <span
              className="shrink-0 flex items-center justify-center"
              style={{ width: 37, height: 37, borderRadius: 25, background: '#EFEFEF' }}
            >
              <img src={iconInfo} alt="" width={20} height={20} className="block" style={{ width: 20, height: 20 }} />
            </span>
            <span className="font-simona flex-1 text-right" style={{ color: '#0B3838', fontSize: 16, fontWeight: 400 }}>
              בדיקת מידע חסר
            </span>
            <FigmaSwitch checked={showMissing} onCheckedChange={setShowMissing} />
          </div>
        </div>

        {chatOpen ? (
          <div className="w-full">
            <ZimmerInlineChat
              zimmer={zimmer}
              initialPrompt={chatPrompt}
              onClose={() => { setChatOpen(false); setChatPrompt(''); }}
            />
          </div>
        ) : (
          <div
            className="w-full flex flex-col gap-3.5 justify-center px-4 py-3 bg-white"
            style={{ borderRadius: 12, border: '2px solid #var(--Custom, #000)', minHeight: 86 }}
          >
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="מה תרצי לשנות או לבדוק בצימר?"
              className="font-simona w-full bg-transparent outline-none text-right"
              style={{ color: '#0B3838', fontSize: 17, fontWeight: 400 }}
              aria-label="שאל את העוזר על הצימר"
              dir="rtl"
            />
            {/* Figma 1011:1435 — LTR row: [Send][Mic] … [Plus] */}
            <div className="flex items-center justify-between w-full" dir="ltr">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!draft.trim()}
                  className="w-[29px] h-[29px] rounded-full flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: '#0B3838' }}
                  title="שלח"
                >
                  <img src={iconSend} alt="" width={8} height={12} className="block" style={{ width: 8, height: 12 }} />
                </button>
                <MicButton
                  tone="ghost"
                  compact
                  size={14}
                  iconWidth={14}
                  iconHeight={19}
                  iconSrc={iconMic}
                  onText={t => setDraft(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))}
                />
              </div>
              <button
                type="button"
                onClick={onAddBooking}
                title="הוספת הזמנה"
                className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105"
                style={{ background: '#E9E9E9' }}
              >
                <img src={iconPlus} alt="" width={12} height={12} className="block" style={{ width: 12, height: 12 }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="flex flex-col gap-8 w-full text-right">
        <h3 className="font-simpler w-full" style={{ color: '#0B3838', fontSize: 20, fontWeight: 400 }}>
          הצעות לשיפור
        </h3>
        {loadingSugg ? (
          <div className="flex items-center justify-center py-6 w-full">
            <div className="w-5 h-5 border-2 border-[#E4E7E5] border-t-[#0B3838] rounded-full animate-spin" />
          </div>
        ) : suggestions.length === 0 ? (
          <p className="font-simona text-sm w-full" style={{ color: '#9CA3AF' }}>אין הצעות כרגע.</p>
        ) : (
          <div className="flex flex-col gap-[17px] w-full">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setChatPrompt(s.title);
                  setChatOpen(true);
                }}
                className="relative w-full text-right transition-opacity hover:opacity-90"
                style={{ background: '#EFEFEF', borderRadius: 7, minHeight: 92, padding: '20px 16px 16px' }}
              >
                <div className="flex items-start gap-3">
                  <OwnerAiIcon size={40} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-right">
                    <p className="font-simona mb-1 leading-snug" style={{ color: '#0B3838', fontSize: 19, fontWeight: 400 }}>
                      {s.title}
                    </p>
                    <p className="font-simona leading-relaxed" style={{ color: '#0B3838', fontSize: 14, fontWeight: 400 }}>
                      {s.body}
                    </p>
                  </div>
                  <span className="overflow-hidden shrink-0 mt-0.5" style={{ width: 12, height: 16 }}>
                    <img src={iconChevronLeft} alt="" width={12} height={16} className="block w-full h-full" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
