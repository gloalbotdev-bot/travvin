/**
 * Owner home (assistant) — Figma Desktop:
 * https://www.figma.com/design/3rRfXaZ752TAyPABkfCjSJ/?node-id=1011-59
 */
import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Loader2 } from 'lucide-react';
import MicButton from '@/components/chat/MicButton';
import heroImg from '@/assets/owner/home/hero.svg';
import checkV from '@/assets/owner/home/check-v.svg';
import iconAddBooking from '@/assets/owner/home/icon-add-booking.svg';
import iconBlockDate from '@/assets/owner/home/icon-block-date.svg';
import iconUpdatePrice from '@/assets/owner/home/icon-update-price.svg';
import iconPlus from '@/assets/owner/home/icon-plus.svg';
import iconSend from '@/assets/owner/home/icon-send.svg';
import iconMic from '@/assets/owner/home/icon-mic.svg';
import checkedBubbleOval from '@/assets/owner/home/checked-bubble-oval.svg';
import dividerWavy from '@/assets/owner/home/divider-wavy.svg';
import chevronSuggestions from '@/assets/owner/home/chevron-suggestions.svg';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';

function nextFridayStr() {
  const d = new Date();
  const dow = d.getDay();
  const offset = (5 - dow + 7) % 7;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function OwnerAssistantHome({ ownerId, zimmers, loading, onChat, onQuickAction, onNavigate, onAddBooking }) {
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(true);
  const [showSugg, setShowSugg] = useState(true);
  const firedRef = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (firedRef.current || !ownerId) return;
    firedRef.current = true;
    (async () => {
      try {
        const [bookings, questions] = await Promise.all([
          api.entities.BookingRequest.filter({ owner_id: ownerId }),
          api.entities.UnansweredQuestion.filter({ owner_id: ownerId, status: 'ממתינה' }),
        ]);
        const fri = nextFridayStr();
        const freeWeekend = bookings.filter(b => b.status === 'אושרה' && b.check_in <= fri && b.check_out > fri).length < Math.max(1, zimmers.length);

        let llm = null;
        try {
          llm = await api.integrations.Core.InvokeLLM({
            prompt: `אתה יועץ לבעל צימרים בישראל. נתונים: ${questions.length} שאלות לקוחות ממתינות${questions[0] ? `, למשל: "${(questions[0].question || '').slice(0, 80)}"` : ''}. ${zimmers.length} צימרים בבעלות. ${freeWeekend ? 'יש לילות פנויות בסוף השבוע הקרוב' : 'אין לילות פנויות בסוף השבוע הקרוב'}.
החזר בדיוק 2 הצעות לשיפור בעברית, כל אחת עם: title (כותרת קצרה), body (משפט אחד), action_label (טקסט כפתור), action_type ("add_info" להוספת מידע לנכס או "create_offer" ליצירת מבצע). JSON בלבד.`,
            response_json_schema: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      body: { type: 'string' },
                      action_label: { type: 'string' },
                      action_type: { type: 'string', enum: ['add_info', 'create_offer'] },
                    },
                  },
                },
              },
            },
          });
        } catch { /* fallback below */ }

        const list = (llm && Array.isArray(llm.suggestions) && llm.suggestions.length) ? llm.suggestions : fallbackSuggestions(questions, zimmers, freeWeekend);
        setSuggestions(list.slice(0, 2));
      } catch {
        setSuggestions(fallbackSuggestions([], zimmers, false));
      }
      setLoadingSugg(false);
    })();
  }, [ownerId, zimmers]);

  const fallbackSuggestions = (questions, zimmersList, freeWeekend) => {
    const s = [];
    if (questions.length > 0) {
      s.push({
        title: `הרבה לקוחות שואלים על ${questions[0].zimmer_name || 'הנכס'} — כדאי להוסיף מידע לנכס?`,
        body: 'כדאי להוסיף מידע לנכס על חניה מקורה / חניה פרטית.',
        action_label: 'הוסף מידע',
        action_type: 'add_info',
      });
    } else {
      s.push({
        title: 'הרבה לקוחות שואלים על חניה — כדאי להוסיף מידע לנכס?',
        body: 'כדאי להוסיף מידע לנכס על חניה מקורה / חניה פרטית.',
        action_label: 'הוסף מידע',
        action_type: 'add_info',
      });
    }
    s.push({
      title: 'הסופ״ש הקרוב פנוי',
      body: 'אפשר להציע הנחה קטנה כדי להגדיל סיכוי לסגירה.',
      action_label: 'צור הצעה',
      action_type: 'create_offer',
    });
    return s;
  };

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    onChat(t);
    setDraft('');
  };

  const onSuggestionAction = (s) => {
    if (s.action_type === 'add_info') onNavigate('zimmers');
    else if (s.action_type === 'create_offer') onNavigate('promotions');
  };

  const quickActions = [
    { type: 'add_booking', label: 'הוספת הזמנה', iconSrc: iconAddBooking, iconW: 17, iconH: 18 },
    { type: 'block_date', label: 'חסום תאריך', iconSrc: iconBlockDate, iconW: 14, iconH: 17 },
    { type: 'update_price', label: 'עדכון מחיר', iconSrc: iconUpdatePrice, iconW: 17, iconH: 17 },
  ];

  return (
    <div dir="rtl" className="max-w-3xl mx-auto w-full">
      <div className="flex justify-center pt-2 pb-2">
        <div className="relative" style={{ width: 270, height: 270, maxWidth: '100%' }}>
          <img src={heroImg} alt="" width={270} height={270} className="block w-full h-full object-contain" />
          {/* Figma 1011:954 over hero 1011:251 — oval @ (0,84) 117×85 within 270×270 */}
          <div
            className="absolute pointer-events-none"
            style={{ left: 0, top: 84, width: 117, height: 85 }}
            aria-hidden
          >
            <img
              src={checkedBubbleOval}
              alt=""
              width={117}
              height={85}
              className="absolute inset-0 block w-full h-full"
              draggable={false}
            />
            <span
              dir="ltr"
              style={{
                position: 'absolute',
                /* Figma 1011:955 — unrotated origin relative to oval AABB (0,84) */
                left: 16.39,
                top: 32.09,
                width: 72,
                height: 34,
                color: '#0B3838',
                fontFamily: 'Caveat, cursive',
                fontSize: 27.741,
                fontWeight: 400,
                lineHeight: 1.23,
                letterSpacing: '-0.832px',
                textTransform: 'lowercase',
                transform: 'rotate(-13.64deg)',
                transformOrigin: 'top left',
                whiteSpace: 'nowrap',
              }}
            >
              checked.
            </span>
          </div>
        </div>
      </div>

      {/* Title: V between נסמן and על — Figma 1011:248 */}
      <div className="text-center mb-3">
        <h1
          className="font-simpler inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 leading-none"
          style={{ color: '#0F4D4D', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 600 }}
        >
          <span>בואו נסמן</span>
          <span className="inline-block overflow-hidden shrink-0 self-center" style={{ width: 56, height: 52 }}>
            <img src={checkV} alt="" width={56} height={52} className="block w-full h-full" />
          </span>
          <span>על היום</span>
        </h1>
        <p
          className="font-simona mx-auto mt-3"
          style={{ color: '#0B3838', fontSize: 17, fontWeight: 400, lineHeight: 'normal', textAlign: 'center', maxWidth: 330 }}
        >
          היי, אני כאן כדי לעזור לך לנהל את הנכסים שלך.
          <br />
          שאל אותי כל דבר שקשור.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mb-5">
        {quickActions.map(({ type, label, iconSrc, iconW, iconH }) => (
          <button
            key={type}
            type="button"
            onClick={() => onQuickAction(type)}
            className="font-simona flex items-center gap-2 h-8 px-7 rounded-full transition-all hover:shadow-sm"
            style={{ background: '#FAFAFA', color: '#0B3838', fontSize: 14, fontWeight: 400 }}
          >
            <span className="shrink-0 overflow-visible flex items-center justify-center" style={{ width: iconW, height: iconH }}>
              <img src={iconSrc} alt="" width={iconW} height={iconH} className="block" style={{ width: iconW, height: iconH }} />
            </span>
            {label}
          </button>
        ))}
      </div>

      {/* Chat: label row ABOVE icons row — Figma 1011:210/211 */}
      <div className="mb-10 mx-auto w-full" style={{ maxWidth: 720 }}>
        <div
          className="rounded-xl bg-white flex flex-col justify-between px-4 pt-3.5 pb-3"
          style={{
            minHeight: 85,
            border: '1.5px solid #E5E5E5',
            boxShadow: '0px 0px 3.9px 0px rgba(0,0,0,0.14)',
          }}
        >
          <p className="font-simona text-right" style={{ color: '#535353', fontSize: 14, fontWeight: 400 }}>
            אפשר לשאול הכל
          </p>
          <div className="flex items-center gap-2.5 mt-2">
            <button
              type="button"
              onClick={onAddBooking}
              title="הוספת הזמנה"
              className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105"
              style={{ background: '#E9E9E9' }}
            >
              <span className="overflow-hidden" style={{ width: 12, height: 12 }}>
                <img src={iconPlus} alt="" width={12} height={12} className="block w-full h-full" />
              </span>
            </button>
            <div className="relative flex-1 min-w-0">
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                placeholder=""
                className="font-simona w-full bg-transparent outline-none min-w-0"
                style={{ color: '#0B3838', fontSize: 14 }}
                aria-label="שאל את העוזר"
              />
            </div>
            <MicButton
              tone="ghost"
              compact
              size={14}
              iconWidth={14}
              iconHeight={19}
              iconSrc={iconMic}
              onText={t => setDraft(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:cursor-default"
              style={{ background: '#0B3838' }}
              title="שלח"
            >
              <img src={iconSend} alt="" width={8} height={12} className="block" style={{ width: 8, height: 12 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Suggestions — Figma chevron + wavy divider */}
      <div className="max-w-xl mx-auto">
        <button
          type="button"
          onClick={() => setShowSugg(s => !s)}
          className="flex flex-col items-center w-full mb-5"
        >
          <span
            className="mb-2 flex items-center justify-center"
            style={{
              width: 32,
              height: 8,
              transform: showSugg ? 'none' : 'rotate(180deg)',
              transition: 'transform 0.2s',
            }}
          >
            <img
              src={chevronSuggestions}
              alt=""
              width={32}
              height={8}
              className="block w-full h-full"
            />
          </span>
          <span className="font-simpler" style={{ color: '#0B3838', fontSize: 20, fontWeight: 400 }}>
            הצעות לשיפור
          </span>
        </button>

        {showSugg && (
          <div>
            {loadingSugg ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={18} className="animate-spin" style={{ color: '#9CA3AF' }} />
              </div>
            ) : suggestions.length === 0 ? (
              <p className="font-simona text-sm text-center py-4" style={{ color: '#9CA3AF' }}>אין הצעות כרגע.</p>
            ) : (
              suggestions.map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <div className="flex justify-center py-4">
                      <img
                        src={dividerWavy}
                        alt=""
                        width={134}
                        height={3}
                        className="block"
                        style={{ width: 134, height: 3 }}
                      />
                    </div>
                  )}
                  <div
                    className="rounded-[10px] px-5 py-4 flex items-center gap-3"
                    style={{ background: '#F5F5F5', minHeight: 86 }}
                  >
                    <OwnerAiIcon size={40} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-right">
                      <p className="font-simona mb-0.5 leading-snug" style={{ color: '#0B3838', fontSize: 19, fontWeight: 400 }}>{s.title}</p>
                      <p className="font-simona leading-relaxed" style={{ color: '#0B3838', fontSize: 14, fontWeight: 400 }}>{s.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSuggestionAction(s)}
                      className="font-simona flex-shrink-0 transition-all hover:opacity-70 whitespace-nowrap"
                      style={{ color: '#0B3838', fontSize: 14, fontWeight: 400, textDecoration: 'underline', textUnderlineOffset: 3 }}
                    >
                      {s.action_label}
                    </button>
                  </div>
                </React.Fragment>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
