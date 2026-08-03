import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Bot, ExternalLink, Sparkles, Check, X } from 'lucide-react';
import { calcBookingTotal, formatILS } from '@/lib/bookingPrice';

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
  'name', 'location', 'price_per_night', 'num_rooms', 'max_guests', 'description',
  'partial_pricing_enabled', 'min_guests', 'price_per_adult', 'price_per_child',
  'seasonal_pricing', 'images', 'info_summary'
];

export default function OwnerInfoAssistant({ ownerId, onNavigate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [context, setContext] = useState(null);
  const [pendingOp, setPendingOp] = useState(null);
  const [applying, setApplying] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadContext();
  }, [ownerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const fetchContext = async () => {
    const [zimmers, bookings, questions, reviews] = await Promise.all([
      base44.entities.Zimmer.filter({ owner_id: ownerId }),
      base44.entities.BookingRequest.filter({ owner_id: ownerId }, '-created_date', 100),
      base44.entities.UnansweredQuestion.filter({ owner_id: ownerId }, '-created_date', 20),
      base44.entities.Review.filter({ owner_id: ownerId }, '-created_date', 20),
    ]);
    return { zimmers, bookings, questions, reviews };
  };

  const loadContext = async () => {
    if (!ownerId) return;
    const ctx = await fetchContext();
    setContext(ctx);
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
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, type, content, time: formatTime(), ...extra }]);
  };

  // Actually perform mutations requested by the LLM
  const executeOperation = async (op) => {
    try {
      if (op.type === 'create_zimmer') {
        if (!op.name) return '⚠️ חסר שם הצימר — לא יכולתי ליצור אותו. ציין שם ונסה שוב.';
        const me = await base44.auth.me();
        const zimmer = await base44.entities.Zimmer.create({
          name: op.name,
          location: op.location || '',
          price_per_night: op.price_per_night ?? null,
          num_rooms: op.num_rooms ?? null,
          max_guests: op.max_guests ?? null,
          description: op.description || '',
          owner_id: ownerId,
          owner_name: me?.full_name || '',
          approval_status: 'אושר',
        });
        return `✅ יצרתי את הצימר "${zimmer.name}" בהצלחה והוא פורסם.`;
      }
      if (op.type === 'update_zimmer') {
        const zid = op.zimmer_id;
        if (!zid) return '⚠️ לא זיהיתי בבירור איזה צימר לעדכן. ציין את שם הצימר המדויק.';
        // Merge fields nested under `fields` with any top-level editable fields the LLM may have placed on the op
        const fields = { ...(op.fields || {}) };
        ZIMMER_FIELDS.forEach(k => {
          if (op[k] !== undefined && op[k] !== null && op[k] !== '' && fields[k] === undefined) {
            fields[k] = op[k];
          }
        });
        const clean = {};
        ZIMMER_FIELDS.forEach(k => { if (fields[k] !== undefined && fields[k] !== null && fields[k] !== '') clean[k] = fields[k]; });
        if (Object.keys(clean).length === 0) return '⚠️ לא צוינו שדות לעדכון. פרט איזה שדה לשנות ולאיזה ערך.';
        await base44.entities.Zimmer.update(zid, clean);
        const z = context.zimmers.find(z => z.id === zid);
        return `✅ עדכנתי את "${z?.name || 'הצימר'}" — ${Object.keys(clean).join(', ')}.`;
      }
      if (op.type === 'create_booking') {
        if (!op.guest_name || !op.guest_phone || !op.zimmer_name || !op.check_in || !op.check_out) {
          return '⚠️ חסרים פרטים ליצירת ההזמנה (שם לקוח, טלפון, צימר, תאריכים). שאל אותי שוב עם הפרטים המלאים.';
        }
        const matchedZimmer = context.zimmers.find(z =>
          z.name === op.zimmer_name || z.name.includes(op.zimmer_name) || (op.zimmer_name && op.zimmer_name.includes(z.name))
        );
        if (!matchedZimmer) return `⚠️ לא מצאתי צימר בשם "${op.zimmer_name}". ההזמנה לא נוצרה.`;
        const total = calcBookingTotal(op.check_in, op.check_out, matchedZimmer.price_per_night);
        const booking = await base44.entities.BookingRequest.create({
          guest_name: op.guest_name,
          guest_phone: op.guest_phone,
          zimmer_id: matchedZimmer.id,
          zimmer_name: matchedZimmer.name,
          owner_id: ownerId,
          check_in: op.check_in,
          check_out: op.check_out,
          num_guests: op.num_guests ?? null,
          status: 'אושרה',
          total_price: total,
          notes: op.notes || '',
        });
        return `✅ נוספה הזמנה ל-${booking.guest_name} בצימר "${matchedZimmer.name}" (${op.check_in} → ${op.check_out}${total ? ` · ${formatILS(total)}` : ''}).`;
      }
      return null;
    } catch (e) {
      return `⚠️ שגיאה בביצוע הפעולה: ${e?.message || 'שגיאה לא ידועה'}`;
    }
  };

  const runPrompt = async (text) => {
    const today = new Date().toISOString().split('T')[0];
    const { zimmers, bookings, questions, reviews } = context;

    const contextStr = `
היום: ${today}

צימרים (${zimmers.length}):
${zimmers.map(z => `id:${z.id} | ${z.name} | מיקום: ${z.location || '—'} | מחיר/לילה: ${z.price_per_night ?? '—'} | חדרים: ${z.num_rooms ?? '—'} | אורחים מקס: ${z.max_guests ?? '—'} | סטטוס: ${z.approval_status} | תיאור: ${z.description || 'אין'}`).join('\n')}

הזמנות (${bookings.length}):
${bookings.map(b => `• ${b.guest_name} | צימר: ${b.zimmer_name} | כניסה: ${b.check_in} | יציאה: ${b.check_out} | אורחים: ${b.num_guests || 1} | סטטוס: ${b.status} | טלפון: ${b.guest_phone}`).join('\n')}

שאלות לקוחות פתוחות (${questions.filter(q => q.status === 'ממתינה').length}):
${questions.map(q => `• "${q.question}" על ${q.zimmer_name} | סטטוס: ${q.status}`).join('\n')}

ביקורות (${reviews.length}):
${reviews.map(r => `• ${r.guest_name || 'אנונימי'} | ${r.zimmer_name} | דירוג: ${r.rating}/5 | "${r.text || ''}"`).join('\n')}
`;

    const historyText = messages.slice(-6)
      .filter(m => m.type === 'text')
      .map(m => `${m.role === 'user' ? 'בעל מתחם' : 'עוזר'}: ${m.content}`)
      .join('\n');

    const prompt = `אתה העוזר האישי המרכזי של בעל מתחם צימרים. אתה יכול לבצע פעולות בפועל במערכת, לא רק להפנות.

יכולותיך:
1. לספק מידע מהנתונים (הזמנות, צימרים, ביקורות, שאלות, הכנסות, תאריכים).
2. ליצור צימר חדש — כשיש לפחות שם, החזר operation מסוג create_zimmer.
3. לעדכן צימר קיים — שינוי מחיר/תיאור/מיקום/חדרים/אורחים. החזר operation מסוג update_zimmer עם zimmer_id ו-fields.
4. ליצור הזמנה חדשה — כשיש שם לקוח, טלפון, שם צימר, תאריכי כניסה/יציאה. החזר operation מסוג create_booking.
5. להפנות לתצוגות (יומן, רשימת הזמנות, ביקורות...) דרך actions, כשזה עניין של צפייה ולא פעולה ישירה.

נתונים:
${contextStr}

היסטוריה:
${historyText}

בקשת בעל המתחם: "${text}"

ענה JSON בלבד בדיוק במבנה הזה:
{
  "message": "תשובה בעברית תמציתית. כשאתה מבצע פעולה — נסח אותה כבקשת אישור (למשל: 'לעדכן את מחיר נוף הגליל ל-600₪? אשר/י כדי לבצע.'). אסור לכתוב 'בוצע' או 'יצרתי' — המערכת תציג תצוגה מקדימה ותבצע רק אחרי אישור הבעל מתחם.",
  "operation": { "type": "create_zimmer", "name": "...", "location": "...", "price_per_night": 0, "num_rooms": 0, "max_guests": 0, "description": "..." },
  "actions": []
}

חוקי חובה:
- operation הוא הביצוע בפועל. אם החלטת על פעולה — חובה למלא את operation עם type וכל השדות הדרושים. אסור להחזיר {} או null כשאתה מתכוון לפעול.
- actions הוא רק לקישורי ניווט/תצוגה (calendar, bookings, new_zimmer, edit_zimmer, questions, reviews). לעולם אל תשים שם פעולת ביצוע — פעולות ביצוע הולכות ל-operation בלבד.
- שדות לא ידועים ב-operation — פשוט אל תכלול אותם, אל תכתוב null.

דוגמה מלאה ל-create_zimmer:
{"type":"create_zimmer","name":"נוף הגליל","location":"צפת","price_per_night":700,"num_rooms":3,"max_guests":6,"description":"צימר מפנק בצפת"}

דוגמה ל-update_zimmer:
{"type":"update_zimmer","zimmer_id":"abc","fields":{"price_per_night":650}}

דוגמה ל-create_booking:
{"type":"create_booking","guest_name":"יעקב כהן","guest_phone":"050-1234567","zimmer_name":"נוף כנרת","check_in":"2026-08-01","check_out":"2026-08-03","num_guests":4}

פורמט operation (רק אחד בכל פעם, או null):
- יצירת צימר: {"type":"create_zimmer","name":"...","location":"...","price_per_night":number|null,"num_rooms":number|null,"max_guests":number|null,"description":"..."}
- עדכון צימר: {"type":"update_zimmer","zimmer_id":"<id מתוך הנתונים>","fields":{"price_per_night":500,"description":"..."}}
- יצירת הזמנה: {"type":"create_booking","guest_name":"...","guest_phone":"...","zimmer_name":"<שם צימר קיים מהנתונים>","check_in":"YYYY-MM-DD","check_out":"YYYY-MM-DD","num_guests":number|null,"notes":"..."}

כללים:
- אם חסר מידע לפעולה — שאל שאלה אחת ספציפית, והחזר operation=null.
- עדכון צימר: חובה לכלול zimmer_id של צימר קיים מתוך הנתונים. יש לך הרשאת עריכה חופשית לכל שדות הצימר. ב-fields רק שדות שהמשתמש ביקש לשנות, תמיד בתוך אובייקט fields. שדות אפשריים: name, location, price_per_night (מספר), num_rooms, max_guests, description, partial_pricing_enabled (boolean), min_guests, price_per_adult, price_per_child, seasonal_pricing (מערך), images (מערך), info_summary.
- יצירת הזמנה: חובה guest_name, guest_phone, zimmer_name (חייב להתאים לצימר קיים), check_in, check_out. num_guests אופציונלי.
- אל תמציא נתונים, מחירים או תאריכים. אם לא ברור — שאל.
- ענה תמיד בעברית.`;

    return await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          operation: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['create_zimmer', 'update_zimmer', 'create_booking'] },
              name: { type: 'string' },
              location: { type: 'string' },
              description: { type: 'string' },
              price_per_night: { type: 'number' },
              num_rooms: { type: 'number' },
              max_guests: { type: 'number' },
              zimmer_id: { type: 'string' },
              fields: { type: 'object', additionalProperties: true },
              guest_name: { type: 'string' },
              guest_phone: { type: 'string' },
              zimmer_name: { type: 'string' },
              check_in: { type: 'string' },
              check_out: { type: 'string' },
              num_guests: { type: 'number' },
              notes: { type: 'string' }
            }
          },
          actions: { type: 'array', items: { type: 'string' } }
        }
      }
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !context) return;
    setInput('');
    addMsg('user', 'text', text);
    setIsTyping(true);
    try {
      const response = await runPrompt(text);
      addMsg('bot', 'text', response.message, { actions: response.actions || [] });

      if (response.operation && response.operation.type) {
        setPendingOp(response.operation);
      }
      setIsTyping(false);
    } catch (e) {
      setIsTyping(false);
      addMsg('bot', 'text', `מצטער, אירעה שגיאה. ${e?.message || 'נסה שוב.'}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const quickAsk = async (text) => {
    if (!context) return;
    addMsg('user', 'text', text);
    setIsTyping(true);
    try {
      const response = await runPrompt(text);
      addMsg('bot', 'text', response.message, { actions: response.actions || [] });
      if (response.operation && response.operation.type) {
        setPendingOp(response.operation);
      }
      setIsTyping(false);
    } catch (e) {
      setIsTyping(false);
      addMsg('bot', 'text', `מצטער, אירעה שגיאה. ${e?.message || 'נסה שוב.'}`);
    }
  };

  const QUICK_QUESTIONS = [
    'מה ההזמנות לשבוע הבא?',
    'כמה הזמנות ממתינות לאישור?',
    'מה הדירוג הממוצע שלי?',
    'עדכן את מחיר הצימר הראשון ל-600 ₪',
    'הוסף הזמנה ליעקב כהן 050-1234567',
    'צור צימר חדש בשם "נוף הגליל"',
  ];

  return (
    <div className="flex flex-col h-full" dir="rtl" style={{ background: '#F8F7F4', height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="px-6 py-5" style={{ background: '#fff', borderBottom: '1.5px solid #F0EEE8' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F97316' }}>
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-black text-base" style={{ color: '#1A1A1A' }}>עוזר ניהול AI</h2>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>מרכז שליטה — מידע, יצירת צימרים, עדכונים והזמנות</p>
          </div>
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

      {/* Confirm bar */}
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

      {/* Quick questions */}
      {messages.length <= 1 && !isTyping && !pendingOp && (
        <div className="px-5 pb-2 flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => quickAsk(q)}
              className="text-xs px-3 py-1.5 rounded-full transition-all hover:opacity-80"
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
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="שאל, צור, עדכן או הוסף הזמנה — בשפה חופשית..."
            className="w-full bg-transparent outline-none resize-none text-sm leading-5 max-h-28"
            style={{ color: '#1A1A1A', direction: 'rtl' }}
            rows={1}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-all disabled:opacity-40 hover:opacity-90"
          style={{ background: '#F97316' }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}