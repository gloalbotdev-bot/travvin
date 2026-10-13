import React, { useState, useEffect, useRef } from 'react';
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
import CustomScrollThumb from '@/components/common/CustomScrollThumb';
import iconAlert from '@/assets/owner/today/alert.svg';
import iconCtaChevron from '@/assets/owner/bookings/sidebar-chevron.svg';
import iconChecklistDown from '@/assets/owner/properties/checklist-down.svg';
import iconSendYellow from '@/assets/owner/calendar/send-yellow.svg';
import iconExpand from '@/assets/owner/calendar/expand.svg';
import iconChecklistDone from '@/assets/owner/properties/checklist-done.svg';
import iconChecklistItemChevron from '@/assets/owner/properties/checklist-item-chevron.svg';
import iconChecklistFootChevron from '@/assets/owner/properties/checklist-foot-chevron.svg';
import { motion, AnimatePresence } from 'framer-motion';

const INK = '#0B3838';

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

/** Property suggestions (questions / missing info / next weekend). `kind` lets the Figma card route its CTA. */
function useZimmerSuggestions(zimmer, missing, onEmpty) {
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(true);

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
            kind: 'chat',
            title: 'לקוחות שואלים על הנכס',
            body: 'שאלה חוזרת: ' + (questions[0].question || '').slice(0, 70),
            cta: 'לנסח תשובה עם Travvin',
          });
        } else if (missing.length > 0 && /חני/.test(missing.map(m => m.label).join(' '))) {
          list.push({
            kind: 'parking',
            title: 'הרבה לקוחות שואלים על חניה — כדאי להוסיף מידע לנכס?',
            body: 'כדאי להוסיף מידע לנכס על חניה מקורה / חניה פרטית.',
            cta: 'להוסיף מידע על חניה',
          });
        } else if (missing.length > 0) {
          list.push({
            kind: 'missing',
            title: 'מידע חסר בנכס',
            body: `כדאי להוסיף פרטים על ${missing[0].label.toLowerCase()} ועוד ${Math.max(0, missing.length - 1)} פריטים.`,
            cta: 'להשלים את המידע',
          });
        } else {
          list.push({ kind: 'chat', title: 'הנכס מלא במידע', body: 'כל הפריטים החיוניים מולאו. כדאי לרענן תמונות מדי פעם.', cta: 'לשאול את Travvin' });
        }
        if (freeWeekend) {
          list.push({
            kind: 'price',
            title: 'הסופ״ש הקרוב פנוי',
            body: 'אפשר להציע הנחה קטנה כדי להגדיל סיכוי לסגירה.',
            cta: 'לעדכן מחיר לסופ״ש',
          });
        } else {
          list.push({ kind: 'chat', title: 'תפוסה גבוהה', body: 'הסופ"ש הקרוב תפוס. כדאי לבדוק תאריכים פנויים אחרים למבצע.', cta: 'לבדוק תאריכים פנויים' });
        }
        if (!cancelled) setSuggestions(list.slice(0, 2));
      } catch {
        if (!cancelled) { setSuggestions([]); onEmpty?.(); }
      }
      if (!cancelled) setLoadingSugg(false);
    })();
    return () => { cancelled = true; };
  }, [zimmer.id]);

  return { suggestions, loadingSugg };
}

/* Figma 1776:19049 (Frame 112) — owner property sidebar: orb, checklist, Travvin suggestions, input bar. */
function ZimmerAiSidebarFigma({ zimmer, onAddBooking, onUpdatePrice, onFillMissing, onEmpty }) {
  const [draft, setDraft] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const scrollRef = useRef(null);

  const items = buildItems(zimmer);
  const done = items.filter(c => c.done).length;
  const pct = Math.round((done / items.length) * 100);
  const missing = items.filter(c => !c.done);
  const { suggestions, loadingSugg } = useZimmerSuggestions(zimmer, missing, onEmpty);
  const shown = expanded ? suggestions : suggestions.slice(0, 1);

  const openChat = (prompt) => {
    setChatPrompt(prompt);
    setChatOpen(true);
  };

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    openChat(t);
    setDraft('');
  };

  const runSuggestion = (s) => {
    if (s.kind === 'parking') onFillMissing?.(items.findIndex(it => /חני/.test(it.label)));
    else if (s.kind === 'missing') onFillMissing?.(items.findIndex(it => !it.done));
    else if (s.kind === 'price') onUpdatePrice?.();
    else openChat(s.title);
  };

  return (
    <div dir="rtl" className="relative flex flex-col h-full min-h-0 bg-white">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto owner-hide-scrollbar" style={{ padding: '20px clamp(16px, 8.2%, 42px) 24px' }}>
        <div className="flex justify-center">
          <OwnerAiIcon variant="orb" size={76.7} />
        </div>

        <div className="flex items-center justify-center" style={{ gap: 9, marginTop: 23 }}>
          <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: INK, opacity: 0.6 }} />
          <p className="font-simpler" style={{ color: INK, fontSize: 16, fontWeight: 400, lineHeight: 'normal' }}>הצעות של Travvin</p>
          <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: INK, opacity: 0.6 }} />
        </div>

        {/* Checklist card — Figma 956:585 (collapsed, default) / 956:583 (expanded), smart animate 0.3s ease-out */}
        <div className="w-full flex flex-col" style={{ marginTop: 15, minHeight: 151, background: '#FAFAFA', borderRadius: 23, padding: `42px clamp(20px, 1.93vw, 37px) ${showMissing ? 25 : 24}px`, gap: 14 }}>
          <button
            type="button"
            onClick={() => setShowMissing(v => !v)}
            aria-expanded={showMissing}
            className="w-full flex items-center justify-between text-right"
            style={{ gap: 12 }}
          >
            <span className="flex flex-col min-w-0" style={{ gap: showMissing ? 4 : 2 }}>
              <span className="font-simpler" style={{ color: INK, fontSize: 18, fontWeight: 600, lineHeight: 'normal' }}>{pct}% מהמידע הושלם</span>
              <span className="font-simona transition-colors duration-300 ease-out" style={{ color: showMissing ? '#717171' : INK, fontSize: showMissing ? 14 : 15, lineHeight: 'normal' }}>
                {missing.length === 0 ? 'כל הפריטים החשובים הושלמו' : missing.length === 1 ? 'פריט חשוב אחד עדיין חסר' : `${missing.length} פריטים חשובים עדיין חסרים`}
              </span>
            </span>
            <img
              src={iconChecklistDown}
              alt=""
              width={16}
              height={16}
              className="block flex-shrink-0 transition-transform duration-300 ease-out"
              style={{ transform: showMissing ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          <div className="w-full flex flex-col" style={{ gap: 6 }}>
            <span className="font-simona self-end" style={{ color: INK, fontSize: 12, fontWeight: 700 }}>{pct}%</span>
            <div className="w-full overflow-hidden" style={{ height: 5, borderRadius: 999, background: '#E4E7E5' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: INK }} />
            </div>
          </div>
          <AnimatePresence initial={false}>
            {showMissing && (
              <motion.div
                key="checklist"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="w-full overflow-hidden"
              >
                <div className="w-full flex flex-col" style={{ gap: 12, marginTop: -2 }}>
                  <div className="w-full" style={{ height: 1, background: '#E4E7E5' }} />
                  <ul className="w-full flex flex-col" style={{ gap: 8 }}>
                    {items.map((it, i) => (
                      <li key={it.label}>
                        <button
                          type="button"
                          disabled={it.done}
                          onClick={() => onFillMissing?.(i)}
                          className="w-full flex items-center text-right enabled:cursor-pointer"
                          style={{ minHeight: 64, padding: '8px clamp(10px, 0.83vw, 16px)', gap: 'clamp(8px, 0.63vw, 12px)', background: '#FAFAFA', border: '1px solid #EFEFEF' }}
                        >
                          {it.done ? (
                            <img src={iconChecklistDone} alt="הושלם" width={27.5} height={25.3} className="block flex-shrink-0" style={{ width: 27.5, height: 25.3, marginInlineEnd: 0.5 }} />
                          ) : (
                            <span className="flex-shrink-0 rounded-full flex items-center justify-center font-simpler" style={{ width: 28, height: 28, background: '#EFEFEF', color: INK, fontSize: 12, fontWeight: 700 }}>
                              {i + 1}
                            </span>
                          )}
                          <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
                            <span className="font-simpler block" style={{ color: INK, fontSize: 16, fontWeight: it.done ? 400 : 600, opacity: it.done ? 0.72 : 1, lineHeight: 'normal' }}>{it.label}</span>
                            {!it.done && it.status && <span className="font-simona block" style={{ color: '#71807D', fontSize: 12, lineHeight: 'normal' }}>{it.status}</span>}
                          </span>
                          {it.done
                            ? <span className="flex-shrink-0" style={{ width: 16 }} aria-hidden />
                            : <img src={iconChecklistItemChevron} alt="" width={16} height={16} className="block flex-shrink-0" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {missing.length > 0 && (
                    <div className="w-full flex flex-col" style={{ paddingTop: 6, gap: 12 }}>
                      <div className="w-full" style={{ height: 1, background: 'rgba(0,0,0,0.17)' }} />
                      <button
                        type="button"
                        onClick={() => onFillMissing?.(items.findIndex(it => !it.done))}
                        className="flex items-center justify-between transition-opacity hover:opacity-80"
                        style={{ height: 22, paddingInline: 19.5 }}
                      >
                        <span className="font-simona" style={{ color: INK, fontSize: 18, fontWeight: 500, lineHeight: 'normal' }}>השלם הכל</span>
                        <img src={iconChecklistFootChevron} alt="" width={8} height={14} className="block flex-shrink-0" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Suggestion cards */}
        <div className="w-full flex flex-col" style={{ gap: 20, marginTop: 20 }}>
          {loadingSugg ? (
            <div className="flex items-center justify-center py-6 w-full">
              <div className="w-5 h-5 border-2 border-[#E4E7E5] border-t-[#0B3838] rounded-full animate-spin" />
            </div>
          ) : (
            shown.map((s, i) => (
              <div key={i} className="w-full flex flex-col items-center" style={{ background: '#FAFAFA', borderRadius: 23, padding: '32px 37px 22px', gap: 24 }}>
                <div className="w-full flex flex-col text-right" style={{ gap: 7, color: INK }}>
                  <span className="flex items-center" style={{ gap: 5 }}>
                    <img src={iconAlert} alt="" width={14} height={14} className="block flex-shrink-0" style={{ width: 13.9, height: 13.9 }} />
                    <span className="font-simona" style={{ fontSize: 17, lineHeight: 'normal' }}>שמתי לב למשהו</span>
                  </span>
                  <p className="font-simpler" style={{ fontSize: 22, fontWeight: 600, lineHeight: 'normal' }}>{s.title}</p>
                  <p className="font-simona" style={{ fontSize: 16, lineHeight: 'normal' }}>{s.body}</p>
                </div>
                <div className="w-full flex flex-col" style={{ gap: 12 }}>
                  <div className="w-full" style={{ height: 1, background: 'rgba(0,0,0,0.2)' }} />
                  <button
                    type="button"
                    onClick={() => runSuggestion(s)}
                    className="w-full flex items-center justify-between transition-opacity hover:opacity-80"
                  >
                    <span className="font-simona" style={{ color: INK, fontSize: 18, fontWeight: 500 }}>{s.cta}</span>
                    <img src={iconCtaChevron} alt="" width={8} height={14} className="block flex-shrink-0" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {!loadingSugg && suggestions.length > 1 && (
          <div className="flex justify-center" style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              aria-expanded={expanded}
              className="relative transition-opacity hover:opacity-80"
              style={{ width: 85.2, height: 28.9 }}
            >
              <img src={iconExpand} alt="" width={86} height={29} className="absolute inset-0 block" />
              <span className="absolute font-simona" style={{ right: 7.3, top: 6, color: INK, fontSize: 13, lineHeight: 'normal' }} dir="ltr">Expand</span>
            </button>
          </div>
        )}

        {chatOpen && (
          <div className="w-full" style={{ marginTop: 20 }}>
            <ZimmerInlineChat
              zimmer={zimmer}
              initialPrompt={chatPrompt}
              onClose={() => { setChatOpen(false); setChatPrompt(''); }}
            />
          </div>
        )}
      </div>

      <CustomScrollThumb
        targetRef={scrollRef}
        className="hidden lg:block"
        width={10.1}
        height={34.4}
        radius={30}
        style={{ right: 16, top: 20, bottom: 150 }}
      />

      {!chatOpen && (
        <div className="relative flex-shrink-0" style={{ padding: '16px clamp(16px, 8.2%, 42px) 24px' }}>
          <div
            className="absolute inset-x-0 pointer-events-none"
            style={{ bottom: '100%', height: 48, background: 'linear-gradient(to top, #FFFFFF, rgba(255,255,255,0))' }}
            aria-hidden
          />
          <div
            className="flex flex-col justify-center bg-white"
            style={{ minHeight: 86, gap: 14, padding: '12px 16px', border: '1px solid #E5E5E5', borderRadius: 23, filter: 'drop-shadow(0px 4px 10.55px rgba(0,0,0,0.07))' }}
          >
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
              placeholder="מה תרצי לדעת או לשנות בנכס?"
              aria-label="מה תרצי לדעת או לשנות בנכס?"
              className="font-simona w-full bg-transparent outline-none text-right placeholder:text-[#0B3838]"
              style={{ color: INK, fontSize: 17 }}
            />
            <div className="flex items-center justify-between" dir="ltr">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!draft.trim()}
                  className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: INK }}
                  title="שלח"
                  aria-label="שלח"
                >
                  <img src={iconSendYellow} alt="" width={29} height={29} className="block" />
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
                aria-label="הוספת הזמנה"
                className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105"
                style={{ background: '#E9E9E9' }}
              >
                <img src={iconPlus} alt="" width={12} height={12} className="block" style={{ width: 12, height: 12 }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ZimmerAiSidebar(props) {
  return props.variant === 'figma' ? <ZimmerAiSidebarFigma {...props} /> : <ZimmerAiSidebarLegacy {...props} />;
}

function ZimmerAiSidebarLegacy({ zimmer, onAddBooking, onBlockDate, onUpdatePrice, onOpenCheckin, onFillMissing, onEmpty }) {
  const [draft, setDraft] = useState('');
  const [showMissing, setShowMissing] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');

  const items = buildItems(zimmer);
  const done = items.filter(c => c.done).length;
  const pct = Math.round((done / items.length) * 100);
  const missing = items.filter(c => !c.done);
  const autoOn = (zimmer.stay_settings?.customer_triggers || []).some(t => t.enabled);
  const { suggestions, loadingSugg } = useZimmerSuggestions(zimmer, missing, onEmpty);

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
