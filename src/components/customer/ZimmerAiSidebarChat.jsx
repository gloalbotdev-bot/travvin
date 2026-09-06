import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/api/client';
import { Send, Sparkles, HelpCircle, CalendarDays, ClipboardList } from 'lucide-react';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';
import MiniAvailabilityCalendar from '@/components/chat/MiniAvailabilityCalendar';
import BookingForm from '@/components/chat/BookingForm';
import { totalBeds, bathroomsCount } from '@/lib/rooms';

const fmtTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

// AI assistant scoped to a single zimmer: answers questions about it from the
// owner's data, and can trigger a booking (onBook) when the customer asks to book.
export default function ZimmerAiSidebarChat({ zimmer, user, onBook, onAskOwner }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef(null);
  const { ref: inputRef, resize: resizeInput } = useAutoResize(input, 200);

  useEffect(() => {
    setMessages([{
      id: Date.now(),
      role: 'bot',
      content: `👋 שלום${user?.full_name ? ' ' + user.full_name : ''}! אני כאן לענות על כל שאלה על "${zimmer.name}". רוצה לדעת על החדרים, המתקנים, המחיר או להזמין? פשוט תשאל 👇`,
      time: fmtTime(),
    }]);
  }, [zimmer.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const buildContext = () => {
    const beds = totalBeds(zimmer.rooms_detail);
    const baths = bathroomsCount(zimmer.rooms_detail, zimmer.additional_bathrooms_count);
    const lines = [
      `שם: ${zimmer.name}`,
      `מיקום: ${zimmer.location || 'לא צוין'}`,
      zimmer.price_per_night ? `מחיר בסיס: ₪${zimmer.price_per_night}/לילה` : null,
      zimmer.weekday_price ? `מחיר אמצ"ש (א'-ה'): ₪${zimmer.weekday_price}` : null,
      zimmer.weekend_price ? `מחיר סופ"ש (ה'-ש'): ₪${zimmer.weekend_price}` : null,
      zimmer.num_rooms ? `חדרים: ${zimmer.num_rooms}` : null,
      zimmer.max_guests ? `אורחים לשינה: ${zimmer.max_guests}` : null,
      zimmer.max_guests_event ? `אורחים לאירוע: ${zimmer.max_guests_event}` : null,
      zimmer.size_sqm ? `גודל: ${zimmer.size_sqm} מ״ר` : null,
      beds != null ? `מיטות: ${beds}` : null,
      baths > 0 ? `חדרי רחצה: ${baths}` : null,
      (zimmer.amenities || []).length ? `מתקנים: ${zimmer.amenities.join(', ')}` : null,
      zimmer.description ? `תיאור: ${zimmer.description}` : null,
      zimmer.cancellation_policy_text ? `מדיניות ביטול: ${zimmer.cancellation_policy_text}` : null,
      zimmer.smoking_policy ? `מדיניות עישון: ${zimmer.smoking_policy}` : null,
      (zimmer.nearby_landmarks || []).length ? `אתרים בסביבה: ${zimmer.nearby_landmarks.map(l => l.name + (l.travel_time_minutes ? ` (${l.travel_time_minutes} דק)` : '')).join(', ')}` : null,
      (zimmer.data_zones || []).length ? `מידע נוסף מהבעלים:\n${zimmer.data_zones.map(dz => `[${dz.source_type || 'מידע'}]: ${dz.content || ''}`).join('\n')}` : null,
    ].filter(Boolean).join('\n');
    return lines;
  };

  const send = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || isTyping) return;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'user', content: text, time: fmtTime() }]);
    setIsTyping(true);
    try {
      const prompt = `אתה עוזר אישי למידע על צימר ספציפי. ענה בעברית חמה ותמציתית בלבד.
הלקוח צופה כעת בדף הצימר. ענה אך ורק על שאלות הנוגעות לצימר הזה על בסיס הנתונים להלן.
נתוני הצימר:
${buildContext()}

שאלת הלקוח: "${text}"
הלקוח מחובר למערכת: ${user ? 'כן' : 'לא'}

כללים:
- אם יש מידע בנתונים — ענה מתוכם ב-action="answer".
- אם אין מידע על מה שנשאל (התשובה לא מופיעה בנתונים למעלה) והלקוח מחובר למערכת — החזר action="ask_owner", וב-message הסבר קצר וידידותי שאין לך את המידע כרגע ושתעביר את השאלה ישירות לבעל הצימר. אל תמציא תשובה.
- אם אין מידע והלקוח אינו מחובר — החזר action="answer" והצע לפנות לבעל הצימר דרך כפתור "צ'אט ישיר" או וואטסאפ.
- אם הלקוח מבקש להזמין / לבדוק זמינות / רוצה להזמין — החזר action="booking" וב-message הסבר קצר שתפתח טופס הזמנה.
- אל תמציא מחירים, מתקנים או פרטים שאינם מופיעים בנתונים.
החזר JSON בלבד: {"action":"answer"|"booking"|"ask_owner","message":"..."}`;
      const res = await api.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: { action: { type: 'string' }, message: { type: 'string' } },
        },
      });
      const action = res?.action || 'answer';
      const answer = res?.message || 'מצטער, לא הצלחתי לענות כרגע.';
      const askOwner = action === 'ask_owner' && !!user && !!onAskOwner;
      setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', content: answer, time: fmtTime(), askOwner, askOwnerText: askOwner ? text : undefined }]);
      if (action === 'booking') {
        setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', type: 'booking', content: zimmer, time: fmtTime() }]);
      } else if (askOwner) {
        onAskOwner(text);
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', content: 'מצטער, אירעה שגיאה. נסה שוב.', time: fmtTime() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(null); } };

  const pushCalendar = () => setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', type: 'calendar', time: fmtTime() }]);
  const pushBooking = () => setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', type: 'booking', content: zimmer, time: fmtTime() }]);

  const handleBookingSubmit = async (data, z, msgId) => {
    try {
      await api.entities.BookingRequest.create({
        zimmer_id: z.id, zimmer_name: z.name, owner_id: z.owner_id,
        ...data, status: 'ממתינה',
      });
      setMessages(prev => [...prev.filter(m => m.id !== msgId), { id: Date.now() + Math.random(), role: 'bot', content: `✅ בקשת ההזמנה ל-${z.name} התקבלה! בעל הצימר יצור איתך קשר בקרוב. 🎉`, time: fmtTime() }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', content: 'מצטער, לא הצלחתי לשמור את ההזמנה. נסה שוב.', time: fmtTime() }]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#ECE5DD]" dir="rtl">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {messages.map(msg => {
          if (msg.type === 'calendar') {
            return (
              <div key={msg.id} className="flex items-end gap-2 mb-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#0B3838' }}>✦</div>
                <div className="flex-1 min-w-0">
                  <MiniAvailabilityCalendar zimmerId={zimmer.id} weeks={4} />
                  <div className="text-[10px] text-gray-400 mt-1 text-left">{msg.time}</div>
                </div>
              </div>
            );
          }
          if (msg.type === 'booking') {
            return (
              <div key={msg.id} className="flex items-end gap-2 mb-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#0B3838' }}>✦</div>
                <div className="flex-1 min-w-0">
                  <BookingForm zimmer={msg.content} onSubmit={(data, z) => handleBookingSubmit(data, z, msg.id)} onClose={() => setMessages(prev => prev.filter(m => m.id !== msg.id))} />
                  <div className="text-[10px] text-gray-400 mt-1 text-left">{msg.time}</div>
                </div>
              </div>
            );
          }
          return (
            <div key={msg.id} className={`flex items-end gap-2 mb-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'bot' && <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#0B3838' }}>✦</div>}
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'bot' ? 'bg-white text-gray-800 rounded-bl-sm' : 'bg-[#DCF8C6] text-gray-800 rounded-br-sm'}`}>
                {msg.content}
                {msg.askOwner && (
                  <button onClick={() => onAskOwner?.(msg.askOwnerText || '')}
                    className="mt-2 flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
                    style={{ background: '#0B3838' }}>
                    <HelpCircle size={13} /> שלח שאלה לבעל הצימר
                  </button>
                )}
                <div className="text-[10px] text-gray-400 mt-0.5 text-left">{msg.time}{msg.role === 'user' && <span className="text-blue-400"> ✓✓</span>}</div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex items-end gap-2 mb-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#0B3838' }}>✦</div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="bg-[#F0F0F0] px-3 pt-2 pb-2.5">
        <div className="flex gap-2 mb-2">
          <button onClick={pushCalendar} type="button" className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl text-white transition-opacity hover:opacity-90" style={{ background: '#0B3838' }}>
            <CalendarDays size={14} /> זמינות
          </button>
          <button onClick={pushBooking} type="button" className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl text-white transition-opacity hover:opacity-90" style={{ background: '#16A34A' }}>
            <ClipboardList size={14} /> הזמן עכשיו
          </button>
        </div>
        <div className="flex items-end gap-2">
          <button onClick={() => send(null)} disabled={!input.trim() || isTyping}
            className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-md hover:bg-[#128C7E] transition-colors disabled:opacity-50 flex-shrink-0">
            <Send size={18} />
          </button>
          <div className="flex-1 bg-white rounded-full px-4 py-2.5 flex items-center shadow-sm min-h-[40px]">
            <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); resizeInput(); }} onKeyDown={handleKeyDown}
              placeholder="שאל שאלה על הצימר..." className="w-full bg-transparent outline-none resize-none text-gray-800 text-sm leading-5 overflow-y-auto" rows={1} style={{ direction: 'rtl' }} />
          </div>
          <MicButton tone="light" disabled={isTyping} onText={t => setInput(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))} />
        </div>
      </div>
    </div>
  );
}