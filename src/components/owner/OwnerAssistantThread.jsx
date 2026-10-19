/**
 * Owner assistant conversation thread, shown in place on the Today and AI assistant tabs.
 * No Figma frame exists for the conversation state — styling follows the surrounding
 * screens (1776-18070 / 1776-18223): ink #0B3838, Simona, radius 23, #F2F2F2 / #E5E5E5 surfaces.
 */
import React, { useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';
import ConfirmActionCard from '@/components/owner/ConfirmActionCard';
import { confirmCardStatus } from '@/hooks/useOwnerAssistantThread';

const INK = '#0B3838';

const OPEN_FORM_LABELS = {
  block: 'פתח טופס חסימת תאריכים',
  price: 'פתח טופס עדכון מחיר',
  booking: 'פתח טופס הוספת הזמנה',
};

const ACTION_LINKS = {
  bookings: { label: 'עבור להזמנות', tab: 'bookings' },
  calendar: { label: 'פתח יומן', tab: 'calendar' },
  questions: { label: 'שאלות לקוחות', tab: 'questions' },
  reviews: { label: 'ביקורות', tab: 'reviews' },
};

function MessageAttachments({ attachments }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map(a => (
        <a
          key={a.url}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 max-w-[200px] bg-white"
          style={{ border: '1px solid #E5E5E5' }}
          title={a.name}
        >
          {a.type?.startsWith('image/')
            ? <img src={a.url} alt={a.name} className="w-12 h-12 rounded object-cover flex-shrink-0" />
            : <FileText size={16} className="flex-shrink-0" style={{ color: INK }} />}
          <span className="font-simona text-xs truncate" style={{ color: '#535353' }}>{a.name}</span>
        </a>
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3" role="status" aria-label="העוזר מקליד">
      <OwnerAiIcon size={32} />
      <div className="bg-white px-5 py-4" style={{ border: '1px solid #E5E5E5', borderRadius: 23 }}>
        <div className="flex gap-1 items-center h-4">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: INK, opacity: 0.35, animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OwnerAssistantThread({
  messages, isTyping, busyActionId, onConfirm, onCancel, onNavigate, onOpenForm, scrollParentRef,
}) {
  const endRef = useRef(null);
  const visible = messages.filter(m => !m.greeting);

  useEffect(() => {
    let cancelled = false;
    const scrollToEnd = () => {
      if (cancelled) return;
      const parent = scrollParentRef?.current;
      if (parent) {
        parent.scrollTop = parent.scrollHeight;
        return;
      }
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };
    // Double rAF waits for bubble + typing layout before measuring scrollHeight.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToEnd);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [messages, visible.length, isTyping, busyActionId, scrollParentRef]);

  return (
    <div dir="rtl" className="w-full flex flex-col" style={{ maxWidth: 723, gap: 18 }} aria-live="polite">
      {visible.map(msg => {
        const isBot = msg.role === 'bot';
        return (
          <div key={msg.id} className={`flex items-start gap-3 ${isBot ? '' : 'flex-row-reverse'}`}>
            {isBot && <OwnerAiIcon size={32} />}
            <div className={`flex flex-col min-w-0 max-w-[85%] ${isBot ? 'items-start' : 'items-end'}`}>
              <div
                className="font-simona whitespace-pre-wrap break-words text-right"
                style={{
                  color: INK,
                  fontSize: 16,
                  lineHeight: 1.5,
                  padding: '14px 20px',
                  borderRadius: 23,
                  ...(isBot
                    ? { background: '#FFFFFF', border: '1px solid #E5E5E5' }
                    : { background: '#F2F2F2' }),
                }}
              >
                {msg.content}
                {msg.attachments?.length > 0 && <MessageAttachments attachments={msg.attachments} />}
              </div>
              {isBot && msg.actions?.length > 0 && (
                <div className="flex flex-wrap gap-4 mt-2 px-2">
                  {msg.actions.map(key => {
                    const action = ACTION_LINKS[key];
                    if (!action) return null;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onNavigate?.(action.tab)}
                        className="font-simona transition-opacity hover:opacity-70"
                        style={{ color: INK, fontSize: 14, textDecoration: 'underline', textUnderlineOffset: 3 }}
                      >
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {isBot && msg.openForm && OPEN_FORM_LABELS[msg.openForm] && onOpenForm && (
                <button
                  type="button"
                  onClick={() => onOpenForm({ form: msg.openForm })}
                  className="font-simona mt-2 px-2 transition-opacity hover:opacity-70"
                  style={{ color: INK, fontSize: 14, textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  {OPEN_FORM_LABELS[msg.openForm]}
                </button>
              )}
              {isBot && msg.pendingAction && (
                <div className="w-full mt-2" style={{ minWidth: 260 }}>
                  <ConfirmActionCard
                    action={msg.pendingAction}
                    status={confirmCardStatus(msg.pendingAction, busyActionId)}
                    onConfirm={() => onConfirm?.(msg.pendingAction.id)}
                    onCancel={() => onCancel?.(msg.pendingAction.id)}
                  />
                </div>
              )}
              <span className="font-simona mt-1 px-2" style={{ color: '#9CA3AF', fontSize: 12 }}>{msg.time}</span>
            </div>
          </div>
        );
      })}

      {isTyping && <TypingIndicator />}
      <div ref={endRef} style={{ scrollMarginBottom: 220 }} aria-hidden />
    </div>
  );
}
