/**
 * Owner AI assistant — landing state (before a conversation starts). Figma Desktop:
 * https://www.figma.com/design/3rRfXaZ752TAyPABkfCjSJ/?node-id=1776-18070
 */
import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Loader2 } from 'lucide-react';
import iconAddBooking from '@/assets/owner/home/icon-add-booking.svg';
import iconBlockDate from '@/assets/owner/home/icon-block-date.svg';
import iconUpdatePrice from '@/assets/owner/home/icon-update-price.svg';
import suggestionSpark from '@/assets/owner/assistant/suggestion-spark.svg';
import googleCalendarIcon from '@/assets/owner/assistant/google-calendar.png';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';
import OwnerHomeComposer from '@/components/owner/OwnerHomeComposer';
import OwnerAssistantThread from '@/components/owner/OwnerAssistantThread';
import { composerPlaceholder } from '@/hooks/useOwnerAssistantThread';

function nextFridayStr() {
  const d = new Date();
  const dow = d.getDay();
  const offset = (5 - dow + 7) % 7;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const INK = '#0B3838';

/** Figma 1776:18142 — 723×86 #F2F2F2 r23; icon right, title/body, underlined link left. */
function SuggestionRow({ icon, title, body, actionLabel, onAction }) {
  return (
    <div
      className="w-full flex items-center"
      style={{
        background: '#F2F2F2',
        borderRadius: 23,
        minHeight: 86.45,
        padding: '21px 22px 21px 25px',
        gap: 27,
      }}
    >
      <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 29.2, height: 31.4 }}>
        {icon}
      </span>
      <div className="flex-1 min-w-0 text-right">
        <p className="font-simona" style={{ color: INK, fontSize: 19, fontWeight: 500, lineHeight: 'normal' }}>{title}</p>
        {body && (
          <p className="font-simona" style={{ color: INK, fontSize: 14, fontWeight: 400, lineHeight: 'normal', marginTop: 4 }}>{body}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onAction}
        className="font-simona flex-shrink-0 whitespace-nowrap transition-opacity hover:opacity-70"
        style={{ color: INK, fontSize: 14, fontWeight: 400, textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

/** "הצעות לשיפור" (Figma 1776:18142–18154) — shown on the home landing. */
export function OwnerAssistantSuggestions({ ownerId, zimmers, onNavigate, style }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(true);
  const firedRef = useRef(false);

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
          const res = await api.assistant.chat({
            profile: 'owner_home_suggestions',
            message: 'הצעות לשיפור',
            clientState: {},
          });
          llm = res?.meta?.parsed || null;
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

  const onSuggestionAction = (s) => {
    if (s.action_type === 'add_info') onNavigate('zimmers');
    else if (s.action_type === 'create_offer') onNavigate('promotions');
  };

  return (
    <section className="w-full flex flex-col items-center" style={{ maxWidth: 723, ...style }}>
      <h2 className="font-simona" style={{ color: 'rgba(0,0,0,0.58)', fontSize: 20, fontWeight: 400, lineHeight: 'normal' }}>
        הצעות לשיפור
      </h2>
      <div className="w-full flex flex-col" style={{ gap: 17.6, marginTop: 20 }}>
        {loadingSugg ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin" style={{ color: '#9CA3AF' }} />
          </div>
        ) : (
          suggestions.map((s, i) => (
            <SuggestionRow
              key={i}
              icon={<img src={suggestionSpark} alt="" className="block" style={{ width: 25.8, height: 24.7 }} />}
              title={s.title}
              body={s.body}
              actionLabel={s.action_label}
              onAction={() => onSuggestionAction(s)}
            />
          ))
        )}
        {/* Figma 1776:18154 — Google Calendar row */}
        <SuggestionRow
          icon={<img src={googleCalendarIcon} alt="" className="block" style={{ width: 29.2, height: 31.4 }} />}
          title="לנהל את היום שלך יחד עם Google Calendar"
          body="לחיבור את Google Calendar"
          actionLabel="לחיבור"
          onAction={() => onNavigate('settings')}
        />
      </div>
    </section>
  );
}

export default function OwnerAssistantHome({ ownerId, zimmers, onQuickAction, onNavigate, onOpenForm, chat, showThread = false, waiting = false }) {
  const scrollRef = useRef(null);
  /* Figma 1776:18131 / 18134 / 18137 — sizes include the stroke padding baked into the SVG files */
  const quickActions = [
    { type: 'add_booking', label: 'הוספת הזמנה', iconSrc: iconAddBooking, iconW: 17, iconH: 18 },
    { type: 'block_date', label: 'חסום תאריך', iconSrc: iconBlockDate, iconW: 14, iconH: 17 },
    { type: 'update_price', label: 'עדכון מחיר', iconSrc: iconUpdatePrice, iconW: 17, iconH: 17 },
  ];

  if (showThread) {
    return (
      <div dir="rtl" className="relative h-full">
        <div ref={scrollRef} className="h-full overflow-y-auto owner-hide-scrollbar">
          <div className="flex flex-col items-center px-4" style={{ paddingTop: 48, paddingBottom: 240 }}>
            <OwnerAssistantThread
              messages={chat.messages}
              isTyping={chat.isTyping || waiting}
              busyActionId={chat.busyActionId}
              onConfirm={chat.confirm}
              onCancel={chat.cancel}
              onNavigate={onNavigate}
              onOpenForm={onOpenForm}
              scrollParentRef={scrollRef}
            />
          </div>
        </div>
        {/* Figma 1776:18350 — fade behind the floating composer (Today tab), tinted to this page's #FCFCFC */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{ height: 192.5, background: 'linear-gradient(to top, #FCFCFC 71.727%, rgba(252,252,252,0))' }}
          aria-hidden
        />
        <div className="absolute inset-x-0 flex justify-center px-4" style={{ bottom: 38 }}>
          <OwnerHomeComposer
            autoFocus
            onSubmit={chat.send}
            placeholder={composerPlaceholder(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="h-full overflow-y-auto owner-hide-scrollbar">
    <div className="w-full flex flex-col items-center px-4" style={{ paddingTop: 86, paddingBottom: 48 }}>
      {/* Figma 1776:18070 — orb 178 inside a 220 glow ring */}
      <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 220, height: 220 }} aria-hidden>
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0) 62%, rgba(235,235,235,0.56) 100%)',
            filter: 'blur(6px)',
          }}
        />
        <OwnerAiIcon variant="orb" size={178} asteriskTone="light" className="relative" />
      </div>

      <h1
        className="font-simpler text-center"
        style={{ color: INK, fontSize: 32, fontWeight: 400, lineHeight: 'normal', marginTop: 47.7 }}
      >
        אני כאן, מה נעשה?
      </h1>

      <div className="w-full flex justify-center" style={{ marginTop: 44.2 }}>
        <OwnerHomeComposer
          autoFocus
          onSubmit={chat.send}
          placeholder={composerPlaceholder(false)}
        />
      </div>

      <div className="flex flex-wrap justify-center" style={{ gap: 18.6, marginTop: 33.7 }}>
        {quickActions.map(({ type, label, iconSrc, iconW, iconH }) => (
          <button
            key={type}
            type="button"
            onClick={() => onQuickAction(type)}
            className="font-simona flex items-center justify-center transition-shadow hover:shadow-sm"
            style={{
              width: 132.4,
              height: 31.35,
              borderRadius: 17.4,
              background: '#FAFAFA',
              color: INK,
              fontSize: 14,
              fontWeight: 400,
              gap: 8.3,
            }}
          >
            {label}
            <img src={iconSrc} alt="" className="block flex-shrink-0" style={{ width: iconW, height: iconH }} />
          </button>
        ))}
      </div>

      <OwnerAssistantSuggestions ownerId={ownerId} zimmers={zimmers} onNavigate={onNavigate} style={{ marginTop: 72.6 }} />
    </div>
    </div>
  );
}
