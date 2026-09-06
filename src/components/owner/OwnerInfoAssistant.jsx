import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/api/client';
import { Send, ExternalLink, Sparkles, Check, X, Eye, Pencil, AlertTriangle } from 'lucide-react';
import { bookingErrorMessage } from '@/lib/bookingErrors';
import { buildOwnerRecentTurns, applyOwnerAssistantResponse } from '@/lib/assistantOwner';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';

const formatTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const TypingIndicator = () => (
  <div className="flex items-end gap-2 mb-3">
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#F97316' }}>Z</div>
    <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
      <div className="flex gap-1 items-center h-4">
        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  </div>
);

// Action links shown when user asks to view something (not a direct mutation)
const ACTION_LINKS = {
  bookings: { label: '📋 עבור להזמנות', tab: 'bookings' },
  calendar: { label: '📅 פתח יומן', tab: 'calendar' },
  questions: { label: '❓ שאלות לקוחות', tab: 'questions' },
  reviews: { label: '⭐ ביקורות', tab: 'reviews' },
};

function ActionButton({ actionKey, onNavigate }) {
  const action = ACTION_LINKS[actionKey];
  if (!action) return null;
  return (
    <button
      onClick={() => onNavigate(action.tab)}
      className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all hover:opacity-80"
      style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C', border: '1px solid rgba(249,115,22,0.2)' }}
    >
      {action.label} <ExternalLink size={11} />
    </button>
  );
}

const ZIMMER_FIELDS = [
  'name', 'location', 'price_per_night', 'weekday_price', 'weekend_price',
  'num_rooms', 'max_guests', 'description',
  'partial_pricing_enabled', 'min_guests', 'price_per_adult', 'price_per_child',
  'seasonal_pricing', 'images', 'info_summary'
]; // server whitelists the same set (M15 #8ב)

export default function OwnerInfoAssistant({ ownerId, onNavigate, onMutated, initialPrompt, onPromptConsumed }) {
  const [mode, setMode] = useState('info'); // 'info' | 'edit' — matches Base44 OwnerAgentChat
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [context, setContext] = useState(null);
  const [pendingOp, setPendingOp] = useState(null);
  const [applying, setApplying] = useState(false);
  const messagesEndRef = useRef(null);
  const sentInitialRef = useRef(false);
  const greetedRef = useRef(false);
  const sendingRef = useRef(false);
  const messagesRef = useRef([]);
  const modeRef = useRef(mode);
  const [chatStarted, setChatStarted] = useState(false);
  const { ref: textareaRef, resize: resizeInput } = useAutoResize(input, 240);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    greetedRef.current = false;
    setChatStarted(false);
    setMessages([]);
    setPendingOp(null);
    setContext(null);
    loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-init when owner changes
  }, [ownerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (context && !isTyping) textareaRef.current?.focus();
  }, [context, isTyping]);

  useEffect(() => {
    if (!context || !initialPrompt?.trim() || sentInitialRef.current) return;
    sentInitialRef.current = true;
    handleSend(initialPrompt.trim());
    onPromptConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when context ready
  }, [context, initialPrompt]);

  const fetchContext = async () => {
    const [zimmers, bookings, questions, reviews] = await Promise.all([
      api.entities.Zimmer.filter({ owner_id: ownerId }),
      api.entities.BookingRequest.filter({ owner_id: ownerId }, '-created_date', 100),
      api.entities.UnansweredQuestion.filter({ owner_id: ownerId }, '-created_date', 20),
      api.entities.Review.filter({ owner_id: ownerId }, '-created_date', 20),
    ]);
    return { zimmers, bookings, questions, reviews };
  };

  const loadContext = async () => {
    if (!ownerId) return;
    const ctx = await fetchContext();
    setContext(ctx);
    if (greetedRef.current) return;
    greetedRef.current = true;
    const pendingCount = ctx.bookings.filter(b => b.status === 'ממתינה').length;
    const unansweredCount = ctx.questions.filter(q => q.status === 'ממתינה').length;
    const greeting = `שלום! 👋 אני העוזר האישי המרכזי שלך.\n\nמכאן אתה יכול לעשות הכל ממקום אחד:\n• לקבל מידע על הצימרים, ההזמנות, הביקורות וההכנסות\n• להוסיף צימר חדש בטקסט חופשי\n• לעדכן פרטי צימר (מחיר, תיאור, מיקום...)\n• להוסיף הזמנות חדשות\n\nסטטוס נוכחי: ${ctx.zimmers.length} צימרים · ${ctx.bookings.filter(b => b.status === 'אושרה').length} הזמנות מאושרות${pendingCount ? `, ${pendingCount} ממתינות` : ''}${unansweredCount ? ` · ${unansweredCount} שאלות לקוחות פתוחות` : ''}.\n\nמה תרצה לעשות?`;
    addMsg('bot', 'text', greeting);
  };

  const reloadContext = async () => {
    const ctx = await fetchContext();
    setContext(ctx);
  };

  const applyOperation = async (op) => {
    setApplying(true);
    try {
      const result = await executeOperation(op);
      if (result) addMsg('bot', 'text', result);
      else addMsg('bot', 'text', '⚠️ לא הצלחתי לבצע את הפעולה. נסה לנסח שוב עם פרטים מלאים.');
      await reloadContext();
    } catch (e) {
      addMsg('bot', 'text', `⚠️ שגיאה בביצוע הפעולה: ${e?.message || 'שגיאה לא ידועה'}`);
    } finally {
      setApplying(false);
      setPendingOp(null);
    }
  };

  const confirmOp = () => { if (pendingOp) applyOperation(pendingOp); };
  const cancelOp = () => {
    setPendingOp(null);
    addMsg('bot', 'text', 'בוטל ✋ — לא בוצע שום שינוי.');
  };

  const addMsg = (role, type, content, extra = {}) => {
    const msg = { id: `${Date.now()}-${Math.random()}`, role, type, content, time: formatTime(), ...extra };
    setMessages(prev => {
      const next = [...prev, msg];
      messagesRef.current = next;
      return next;
    });
    return msg;
  };

  // Server-enforced mutations (M15 #8ב) — never call entity APIs directly from LLM output
  const prepareAssistantOp = (op) => {
    if (!op || op.type !== 'update_zimmer' || !context?.zimmers) return op;
    const out = { ...op, fields: { ...(op.fields || {}) } };
    if (out.price != null && out.fields.price_per_night == null) {
      out.fields.price_per_night = out.price;
    }
    if (out.price_per_night != null && out.fields.price_per_night == null) {
      out.fields.price_per_night = out.price_per_night;
    }
    if (!out.zimmer_id) {
      const hint = out.zimmer_name || out.name;
      const matched = hint
        ? context.zimmers.find(
            (z) => z.name === hint || z.name.includes(hint) || hint.includes(z.name),
          )
        : context.zimmers[0];
      if (matched) out.zimmer_id = matched.id;
    }
    return out;
  };

  const executeOperation = async (op) => {
    try {
      const { data } = await api.functions.invoke('executeOwnerAssistantOp', {
        owner_id: ownerId,
        operation: prepareAssistantOp(op),
      });
      if (data?.kind && onMutated) onMutated(data);
      return data?.message || null;
    } catch (e) {
      return `⚠️ ${bookingErrorMessage(e, e?.message || 'שגיאה לא ידועה')}`;
    }
  };

  const handleSend = async (rawText) => {
    const text = (rawText ?? input).trim();
    if (!text || !context || sendingRef.current) return;
    sendingRef.current = true;
    setChatStarted(true);
    setInput('');
    const activeMode = modeRef.current;
    addMsg('user', 'text', text);
    setIsTyping(true);
    setPendingOp(null);
    try {
      const history = messagesRef.current;
      const response = await api.assistant.chat({
        profile: 'owner_assistant',
        message: text,
        clientState: {
          mode: activeMode,
          ownerId,
          recentTurns: buildOwnerRecentTurns(history),
        },
      });
      setIsTyping(false);

      await applyOwnerAssistantResponse({
        response,
        actions: {
          onExecutedMessage: async (content, exec) => {
            addMsg('bot', 'text', content);
            if (exec?.kind && onMutated) onMutated(exec);
            await reloadContext();
          },
          onBotText: (content, actionKeys) => {
            addMsg('bot', 'text', content || '…', { actions: actionKeys || [] });
          },
          onEditModeRequired: () => {
            addMsg('bot', 'text', 'אתה במצב מידע. כדי לבצע את הפעולה — עבור למצב עריכה עם המתג בכותרת.');
          },
        },
      });
    } catch (e) {
      setIsTyping(false);
      addMsg('bot', 'text', `מצטער, אירעה שגיאה. ${e?.message || 'נסה שוב.'}`);
    } finally {
      sendingRef.current = false;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const QUICK_QUESTIONS = mode === 'edit'
    ? [
        'מה ההזמנות לשבוע הבא?',
        'כמה הזמנות ממתינות לאישור?',
        'עדכן את מחיר הצימר הראשון ל-600 ₪',
        'הוסף הזמנה ליעקב כהן 050-1234567',
        'צור צימר חדש בשם "נוף הגליל"',
      ]
    : [
        'מה ההזמנות לשבוע הבא?',
        'כמה הזמנות ממתינות לאישור?',
        'מה הדירוג הממוצע שלי?',
        'מה ההכנסה החודש?',
        'העבר למצב עריכה כדי לבצע פעולות',
      ];

  const modeConfig = mode === 'edit'
    ? { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.30)', color: '#EF4444', icon: Pencil, label: 'מצב עריכה', hint: 'העוזר יכול לבצע פעולות — ליצור, לעדכן ולהוסיף הזמנות. פעולות מתבצעות מיד.' }
    : { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.30)', color: '#3B82F6', icon: Eye, label: 'מצב מידע', hint: 'קריאה בלבד — העוזר רק מציג נתונים ועונה על שאלות, בלי לבצע שינויים.' };
  const ModeIcon = modeConfig.icon;
  const showQuick = !chatStarted && messages.length <= 1 && !isTyping && !pendingOp;

  return (
    <div className="flex flex-col h-full" dir="rtl" style={{ background: '#F8F7F4', height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="px-5 py-4" style={{ background: '#fff', borderBottom: '1.5px solid #F0EEE8' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F97316' }}>
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-black text-base" style={{ color: '#1A1A1A' }}>עוזר ניהול AI</h2>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>מרכז שליטה — מידע, יצירת צימרים, עדכונים והזמנות</p>
            </div>
          </div>

          {/* Mode toggle — restored from Base44 OwnerAgentChat */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
            <button
              type="button"
              onClick={() => setMode('info')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={mode === 'info' ? { background: '#3B82F6', color: '#fff' } : { color: '#6B7280' }}
            >
              <Eye size={13} /> מידע
            </button>
            <button
              type="button"
              onClick={() => setMode('edit')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={mode === 'edit' ? { background: '#EF4444', color: '#fff' } : { color: '#6B7280' }}
            >
              <Pencil size={13} /> עריכה
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl p-3 flex items-start gap-2.5" style={{ background: modeConfig.bg, border: `1.5px solid ${modeConfig.border}` }}>
          <ModeIcon size={16} style={{ color: modeConfig.color, flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold" style={{ color: modeConfig.color }}>{modeConfig.label}</span>
            <p className="text-xs mt-0.5" style={{ color: '#4B5563' }}>{modeConfig.hint}</p>
          </div>
          {mode === 'edit' && (
            <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: '#fff', color: '#EF4444' }}>
              <AlertTriangle size={11} /> פעולות מתבצעות מיד
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex items-end gap-2 mb-2 ${msg.role !== 'bot' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'bot' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#F97316' }}>Z</div>
            )}
            <div className="max-w-sm lg:max-w-lg">
              <div
                className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                style={msg.role === 'bot'
                  ? { background: '#fff', color: '#1A1A1A', border: '1.5px solid #F0EEE8', borderBottomRightRadius: '4px' }
                  : { background: '#F97316', color: '#fff', borderBottomLeftRadius: '4px' }
                }
              >
                {msg.content}
              </div>
              {msg.role === 'bot' && msg.actions?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {msg.actions.map(a => (
                    <ActionButton key={a} actionKey={a} onNavigate={(tab) => {
                      if (tab === 'booking_creator') onNavigate('booking_creator');
                      else onNavigate(tab);
                    }} />
                  ))}
                </div>
              )}
              <div className="text-xs mt-1 px-1" style={{ color: '#9CA3AF' }}>{msg.time}</div>
            </div>
          </div>
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Confirm bar — only if a pending op was left manually (legacy path) */}
      {pendingOp && !isTyping && !applying && (
        <div className="px-5 py-2 flex items-center gap-2 flex-wrap" dir="rtl">
          <span className="text-xs" style={{ color: '#6B7280' }}>לבצע את הפעולה?</span>
          <button onClick={confirmOp}
            className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl text-white"
            style={{ background: '#F97316' }}>
            <Check size={12} /> מאשר
          </button>
          <button onClick={cancelOp}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl"
            style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
            <X size={12} /> לא מאשר
          </button>
        </div>
      )}
      {pendingOp && applying && (
        <div className="px-5 py-2 text-xs" style={{ color: '#9CA3AF' }}>מבצע את הפעולה…</div>
      )}

      {/* Quick questions — hide once the user has started chatting */}
      {showQuick && (
        <div className="px-5 pb-2 flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => {
                if (q === 'העבר למצב עריכה כדי לבצע פעולות') {
                  setMode('edit');
                  return;
                }
                handleSend(q);
              }}
              disabled={isTyping}
              className="text-xs px-3 py-1.5 rounded-full transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: '#fff', border: '1.5px solid #F0EEE8', color: '#6B7280' }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 flex items-end gap-2" style={{ background: '#fff', borderTop: '1.5px solid #F0EEE8' }}>
        <div className="flex-1 rounded-2xl px-4 py-3 flex items-center min-h-[48px]" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); resizeInput(); }}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'edit' ? 'כתוב פקודה — אעשה אותה מיד...' : 'שאל שאלה — אציג לך את הנתונים...'}
            className="w-full bg-transparent outline-none resize-none text-sm leading-5 max-h-28"
            style={{ color: '#1A1A1A', direction: 'rtl' }}
            rows={1}
            disabled={isTyping}
          />
        </div>
        <MicButton tone="light" disabled={isTyping} onText={t => setInput(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))} />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!input.trim() || isTyping}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-all disabled:opacity-40 hover:opacity-90"
          style={{ background: mode === 'edit' ? '#EF4444' : '#F97316' }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
