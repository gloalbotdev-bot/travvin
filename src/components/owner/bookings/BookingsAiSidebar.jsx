import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';
import ConfirmActionCard from '@/components/owner/ConfirmActionCard';
import useOwnerAssistantThread, { confirmCardStatus } from '@/hooks/useOwnerAssistantThread';
import MicButton from '@/components/chat/MicButton';
import { needsAttention, nightsBetween, nightsLabel, formatRangeLong, isNextWeekendFree } from './bookingStatus';
import iconChat from '@/assets/owner/bookings/sidebar-chat.svg';
import iconChevron from '@/assets/owner/bookings/sidebar-chevron.svg';
import iconExpand from '@/assets/owner/bookings/icon-expand.svg';
import iconHouse from '@/assets/owner/bookings/icon-house.svg';
import iconUserRound from '@/assets/owner/bookings/icon-user-round.svg';
import btnSend from '@/assets/owner/bookings/btn-send.svg';
import iconPlus from '@/assets/owner/home/icon-plus.svg';
import iconMic from '@/assets/owner/home/icon-mic.svg';

const TEXT = '#0B3838';

export function PropertyThumb({ src }) {
  const box = { width: 91.19, height: 91.19, borderRadius: 13.68 };
  return src ? (
    <img src={src} alt="" className="block object-cover flex-shrink-0" style={{ ...box, border: '1.14px solid #E5E7EB' }} />
  ) : (
    <div className="flex items-center justify-center flex-shrink-0" style={{ ...box, background: '#FFFFFF', border: '1.14px solid #E5E7EB' }}>
      <img src={iconHouse} alt="" width={27} height={27} className="block" style={{ width: 27, height: 27 }} />
    </div>
  );
}

export function GuestCircle({ size, border }) {
  return (
    <div className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0" style={{ width: size, height: size, background: '#EFEFEF', border }}>
      <img src={iconUserRound} alt="" width={23} height={23} className="block" style={{ width: 23, height: 23 }} />
    </div>
  );
}

function CardImages({ card }) {
  if (card.kind === 'weekend') {
    const [a, b] = card.images;
    const circle = (src, size, extra) => (
      <div className="relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, background: '#FFFFFF', border: '2px solid #FFFFFF', ...extra }}>
        {src
          ? <img src={src} alt="" className="w-full h-full object-cover" />
          : <img src={iconHouse} alt="" width={27} height={27} className="block" style={{ width: 27, height: 27 }} />}
      </div>
    );
    return (
      <div className="flex items-start flex-shrink-0" dir="ltr">
        {circle(a, 91.2, { zIndex: 1 })}
        {circle(b, 88.6, { marginLeft: -49 })}
      </div>
    );
  }
  return (
    <div className="relative flex-shrink-0" style={{ width: 104.6, height: 91.19 }}>
      <div className="absolute" style={{ right: 0, top: 0 }}><PropertyThumb src={card.image} /></div>
      <div className="absolute" style={{ left: 0, top: 33.6 }}><GuestCircle size={49.4} border="2px solid #FAFAFA" /></div>
    </div>
  );
}

// Figma has two card layouts: circles (1776:20286) and thumbnail (1776:20308).
const LAYOUTS = {
  weekend: { top: 28, timeGap: 35, rowHeight: 114, imgTop: 11.4, imgGap: 20, bodySize: 17, divider: 32, actionTop: 38, actionWidth: 368, iconGap: 13.3, bottom: 44 },
  thumb: { top: 25.6, timeGap: 31, rowHeight: null, imgTop: 0, imgGap: 12, bodySize: 20, divider: 40, actionTop: 18.8, actionWidth: 411, iconGap: 19, bottom: 25.5 },
};

function AttentionCard({ card }) {
  const L = card.kind === 'weekend' ? LAYOUTS.weekend : LAYOUTS.thumb;
  return (
    <div className="flex flex-col items-center w-full" style={{ background: '#FAFAFA', borderRadius: 23, paddingTop: L.top, paddingBottom: L.bottom }}>
      <p className="font-simona text-center" style={{ color: TEXT, fontSize: 17, fontWeight: 400, lineHeight: 'normal' }}>{card.time}</p>
      <div
        className={`flex justify-center ${L.rowHeight ? 'items-start' : 'items-center'}`}
        style={{ marginTop: L.timeGap, gap: L.imgGap, minHeight: L.rowHeight || undefined }}
      >
        <div style={{ marginTop: L.imgTop }}><CardImages card={card} /></div>
        <div className="text-right" style={{ width: 234 }}>
          <p className="font-simpler" style={{ color: TEXT, fontSize: 22, fontWeight: 600, lineHeight: 'normal' }}>{card.title}</p>
          <p className="font-simona" style={{ color: TEXT, fontSize: L.bodySize, fontWeight: 400, lineHeight: 1.379, marginTop: 3 }} dir="auto">{card.body}</p>
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: 427, height: 1, background: 'rgba(0,0,0,0.17)', marginTop: L.divider }} aria-hidden />
      <button
        type="button"
        onClick={card.onAction}
        className="flex items-center justify-between text-right transition-opacity hover:opacity-80"
        style={{ width: L.actionWidth, maxWidth: 'calc(100% - 24px)', marginTop: L.actionTop, gap: 12 }}
      >
        <span className="flex items-center" style={{ gap: L.iconGap }}>
          <img src={iconChat} alt="" width={28} height={29} className="block flex-shrink-0" style={{ width: 28, height: 29 }} />
          <span className="flex flex-col items-start">
            <span className="font-simona" style={{ color: TEXT, fontSize: 18, fontWeight: 500, lineHeight: 'normal' }}>{card.action}</span>
            {card.actionSub && (
              <span className="font-simona" style={{ color: TEXT, fontSize: 14, fontWeight: 400, lineHeight: 'normal', marginTop: 2 }}>{card.actionSub}</span>
            )}
          </span>
        </span>
        <img src={iconChevron} alt="" width={8} height={14} className="block flex-shrink-0" style={{ width: 8, height: 14 }} />
      </button>
    </div>
  );
}

// Desktop bookings sidebar: "דברים שכדאי לטפל בהם" + AI input (Figma 1776:20280).
const OPEN_FORM_ACTIONS = { block: 'block_date', price: 'update_price', booking: 'add_booking' };

export default function BookingsAiSidebar({ ownerId, focusZimmerId, bookings, zimmers, onQuickAction, onApproveQuick, onOpenBooking, onCreatePromo, onMutated }) {
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef(null);
  const zMap = Object.fromEntries(zimmers.map(z => [z.id, z]));
  const openForm = (effect) => {
    const action = OPEN_FORM_ACTIONS[effect?.form];
    if (action) onQuickAction(action);
  };
  const chat = useOwnerAssistantThread({
    ownerId,
    surface: 'bookings',
    focus: focusZimmerId ? { zimmerId: focusZimmerId } : null,
    onMutated,
    onOpenForm: openForm,
  });
  const { messages, isTyping: busy } = chat;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  const cards = [];
  bookings.filter(needsAttention).slice(0, 2).forEach(b => {
    const z = zMap[b.zimmer_id];
    const name = b.zimmer_name || z?.name || '';
    const guest = b.guest_name || 'אורחים';
    if (b.cancel_request_reason) {
      cards.push({
        id: b.id, kind: 'cancel', time: formatRangeLong(b.check_in, b.check_out), image: z?.images?.[0],
        title: 'התקבלה בקשת ביטול',
        body: `${guest} ביקשו לבטל את ההזמנה ב${name}.`,
        action: 'לטפל בבקשה', actionSub: 'פתחי את ההזמנה ואשרי או דחי את הביטול.',
        onAction: () => onOpenBooking(b),
      });
    } else {
      cards.push({
        id: b.id, kind: 'pending', time: formatRangeLong(b.check_in, b.check_out), image: z?.images?.[0],
        title: 'יש לך הזמנה חדשה',
        body: `${guest} הזמינו ${nightsLabel(nightsBetween(b.check_in, b.check_out))} ב${name}.`,
        action: 'לאשר את ההזמנה', actionSub: 'פתחי את ההזמנה ואשרי או דחי אותה.',
        onAction: () => onApproveQuick(b),
      });
    }
  });
  if (isNextWeekendFree(bookings)) {
    cards.push({
      id: 'weekend', kind: 'weekend', time: 'בקרוב',
      images: [zimmers[0]?.images?.[0], zimmers[1]?.images?.[0] || zimmers[0]?.images?.[1]],
      title: 'הסופ״ש הקרוב פנוי',
      body: 'אפשר להציע הנחה קטנה כדי להגדיל סיכוי לסגירה.',
      action: 'צור הצעה',
      onAction: onCreatePromo,
    });
  }

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    chat.send(text);
  };

  return (
    <aside className="relative flex flex-col flex-shrink-0 h-full bg-white" style={{ width: 'clamp(440px, 26.72vw, 513px)', borderRight: '1px solid #E3E3E3' }} dir="rtl">
      <div className="flex-1 min-h-0 overflow-y-auto owner-sidebar-scroll" style={{ paddingLeft: 32, paddingRight: 'clamp(24px, 2.71vw, 52px)' }}>
        <div className="flex flex-col items-center" style={{ width: '100%', maxWidth: 428, paddingTop: 30, paddingBottom: 24 }}>
          <OwnerAiIcon size={77} />
          <div className="flex items-center" style={{ gap: 9, marginTop: 22.4 }}>
            <span className="rounded-full" style={{ width: 8, height: 8, background: TEXT, opacity: 0.6 }} aria-hidden />
            <h2 className="font-simpler" style={{ color: TEXT, fontSize: 16, fontWeight: 400, lineHeight: 'normal' }}>דברים שכדאי לטפל בהם</h2>
            <span className="rounded-full" style={{ width: 8, height: 8, background: TEXT, opacity: 0.6 }} aria-hidden />
          </div>
          <div className="flex flex-col w-full" style={{ gap: 20, marginTop: 18 }}>
            {cards.length === 0 ? (
              <div className="font-simona text-center" style={{ background: '#FAFAFA', borderRadius: 23, padding: '28px 24px', color: TEXT, fontSize: 17 }}>
                אין כרגע משהו שדורש טיפול
              </div>
            ) : cards.map(c => <AttentionCard key={c.id} card={c} />)}
          </div>
        </div>
      </div>

      {/* Chat + composer stay in normal flow so they never cover the cards above */}
      <div className="flex-shrink-0" style={{ paddingLeft: 32, paddingRight: 'clamp(24px, 2.71vw, 52px)', paddingBottom: 32, maxWidth: 428 + 32 + 52 }}>
        <div className="relative" style={{ maxWidth: 428 }}>
          {(messages.length > 0 || busy) && (
            <>
              <div
                ref={scrollRef}
                className="overflow-y-auto owner-sidebar-scroll bg-white flex flex-col"
                style={{ maxHeight: expanded ? '40vh' : 160, gap: 8, marginBottom: 8, padding: 8, borderRadius: 16 }}
              >
                {messages.map((m) => (
                  <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-start' : 'items-end'}`}>
                    <div
                      className="font-simona max-w-[85%] whitespace-pre-wrap"
                      style={{ fontSize: 14, padding: '8px 12px', borderRadius: 14, ...(m.role === 'user' ? { background: '#FAFAFA', color: TEXT } : { background: TEXT, color: '#FFFFFF' }) }}
                    >
                      {m.content}
                    </div>
                    {m.role === 'bot' && m.openForm && OPEN_FORM_ACTIONS[m.openForm] && (
                      <button
                        type="button"
                        onClick={() => openForm({ form: m.openForm })}
                        className="font-simona mt-1 transition-opacity hover:opacity-70"
                        style={{ color: TEXT, fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3 }}
                      >
                        פתח את הטופס
                      </button>
                    )}
                    {m.role === 'bot' && m.pendingAction && (
                      <div className="w-full mt-1">
                        <ConfirmActionCard
                          compact
                          action={m.pendingAction}
                          status={confirmCardStatus(m.pendingAction, chat.busyActionId)}
                          onConfirm={() => chat.confirm(m.pendingAction.id)}
                          onCancel={() => chat.cancel(m.pendingAction.id)}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {busy && (
                  <div className="flex justify-end" role="status" aria-label="העוזר מקליד">
                    <Loader2 size={14} className="animate-spin" style={{ color: TEXT }} />
                  </div>
                )}
              </div>
              {messages.length > 0 && (
                <div className="flex" style={{ marginBottom: 12, paddingRight: 194.2 }}>
                  <button
                    type="button"
                    onClick={() => setExpanded(e => !e)}
                    aria-expanded={expanded}
                    className="font-simona flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
                    style={{ width: 85.2, height: 28.9, gap: 6, background: '#EFEFEF', color: TEXT, fontSize: 13 }}
                    dir="ltr"
                  >
                    <img src={iconExpand} alt="" width={15} height={15} className="block" style={{ width: 15, height: 15 }} />
                    Expand
                  </button>
                </div>
              )}
            </>
          )}
          <div
            className="flex flex-col justify-center bg-white"
            style={{ minHeight: 86, gap: 14, padding: '12px 16px', border: '1px solid #E5E5E5', borderRadius: 23, filter: 'drop-shadow(0px 4px 10.55px rgba(0,0,0,0.07))' }}
          >
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="מה תרצי לדעת או לשנות בנכס?"
              aria-label="שאלה לעוזר ה-AI"
              className="font-simona w-full bg-transparent outline-none text-right placeholder:text-[#0B3838] resize-none"
              style={{ color: TEXT, fontSize: 17, fontWeight: 400, minHeight: 24, maxHeight: 96 }}
            />
            <div className="flex items-center justify-between" dir="ltr">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || !input.trim()}
                  className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-40"
                  title="שלח"
                  aria-label="שלח"
                >
                  {busy
                    ? <span className="w-full h-full rounded-full flex items-center justify-center" style={{ background: TEXT }}><Loader2 size={14} className="animate-spin text-white" /></span>
                    : <img src={btnSend} alt="" width={29} height={29} className="block" style={{ width: 29, height: 29 }} />}
                </button>
                <MicButton
                  tone="ghost"
                  compact
                  size={14}
                  iconWidth={14}
                  iconHeight={19}
                  iconSrc={iconMic}
                  onText={(t) => setInput(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))}
                />
              </div>
              <button
                type="button"
                onClick={() => onQuickAction('add_booking')}
                title="הוספת הזמנה"
                aria-label="הוספת הזמנה"
                className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105"
                style={{ background: '#E9E9E9' }}
              >
                <span className="overflow-hidden" style={{ width: 12, height: 12 }}>
                  <img src={iconPlus} alt="" width={12} height={12} className="block w-full h-full" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
