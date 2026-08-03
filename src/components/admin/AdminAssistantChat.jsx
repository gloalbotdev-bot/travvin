import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, ArrowRight, X } from 'lucide-react';

const formatTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const TypingIndicator = () => (
  <div className="flex items-end gap-2 mb-3">
    <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">Z</div>
    <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
      <div className="flex gap-1 items-center h-4">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  </div>
);

export default function AdminAssistantChat({ onClose, onRefresh }) {
  const [zimmers, setZimmers] = useState([]);
  const [selectedZimmer, setSelectedZimmer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(user => {
      base44.entities.Zimmer.filter({ owner_id: user.id }).then(data => {
        setZimmers(data);
        addMsg('bot', 'text', 'שלום! 🏠 אני עוזר הניהול שלך. על איזה צימר תרצה לבצע פעולות?');
        addMsg('bot', 'zimmer_select', data);
      });
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addMsg = (role, type, content, extra = {}) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, type, content, time: formatTime(), ...extra }]);
  };

  const selectZimmer = (zimmer) => {
    setSelectedZimmer(zimmer);
    addMsg('user', 'text', `בחרתי: ${zimmer.name}`);
    addMsg('bot', 'text', `מצוין! עובד על "${zimmer.name}" 🏠\n\nמה תרצה לעשות? לדוגמה:\n• "עדכן את המחיר ל-500"\n• "הוסף אזור מידע על מדיניות ביטול"\n• "הוסף כמה אזורי מידע: חיות מחמד, בריכה, חנייה"\n• "שנה את התיאור"\n• "שנה את המיקום ל-..."`);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !selectedZimmer) return;
    setInput('');
    addMsg('user', 'text', text);
    setIsTyping(true);

    try {
      const zimmerJson = JSON.stringify({
        id: selectedZimmer.id,
        name: selectedZimmer.name,
        location: selectedZimmer.location,
        price_per_night: selectedZimmer.price_per_night,
        num_rooms: selectedZimmer.num_rooms,
        max_guests: selectedZimmer.max_guests,
        description: selectedZimmer.description,
        data_zones: selectedZimmer.data_zones || [],
        images: selectedZimmer.images || []
      });

      const historyText = messages.slice(-12)
        .filter(m => m.type === 'text')
        .map(m => `${m.role === 'user' ? 'מנהל' : 'מערכת'}: ${m.content}`)
        .join('\n');

      const prompt = `אתה עוזר ניהול לבעל צימר.
צימר נוכחי:
${zimmerJson}

היסטוריית השיחה:
${historyText}

בקשת המנהל: "${text}"

המשימה שלך:
- נתח מה המנהל רוצה לשנות
- בנה עדכון מלא לצימר (שדות בסיסיים + data_zones)
- data_zones הם מערך של אובייקטים עם: content (string), source_label (string), source_type (string - אחד מ: "טקסט חופשי", "שיחת טלפון", "שיחת וואטסאפ"), source_date (תאריך היום: ${new Date().toLocaleDateString('he-IL')})
- אם המנהל רוצה להוסיף כמה אזורי מידע בבת אחת — צור אזור מידע לכל פריט
- שמור data_zones קיימים ורק הוסף/שנה לפי הבקשה
- אם הבקשה לא ברורה — שאל שאלת הבהרה ספציפית

ענה JSON:
{
  "action": "update" | "clarify" | "confirm",
  "message": "הודעה למנהל",
  "changes": {
    "name": "...",
    "location": "...",
    "price_per_night": number,
    "num_rooms": number,
    "max_guests": number,
    "description": "...",
    "data_zones": [{"content":"...","source_label":"עריכה ידנית","source_type":"טקסט חופשי","source_date":"${new Date().toLocaleDateString('he-IL')}"}]
  }
}

אם action=clarify: אל תכניס changes.
אם action=update או confirm: הכנס changes עם כל שדות הצימר (גם אלה שלא השתנו).`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            message: { type: 'string' },
            changes: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                location: { type: 'string' },
                price_per_night: { type: 'number' },
                num_rooms: { type: 'number' },
                max_guests: { type: 'number' },
                description: { type: 'string' },
                data_zones: { type: 'array', items: { type: 'object' } }
              }
            }
          }
        }
      });

      setIsTyping(false);

      if (response.action === 'clarify') {
        addMsg('bot', 'text', response.message);
      } else if (response.action === 'update' && response.changes) {
        setPendingChanges(response.changes);
        addMsg('bot', 'text', response.message || 'הנה השינויים שאני מתכנן לבצע:');
        addMsg('bot', 'changes_preview', response.changes);
      } else {
        addMsg('bot', 'text', response.message || 'לא הצלחתי לעבד את הבקשה.');
      }
    } catch (e) {
      setIsTyping(false);
      addMsg('bot', 'text', 'מצטער, אירעה שגיאה. נסה שוב.');
    }
  };

  const applyChanges = async () => {
    if (!pendingChanges || !selectedZimmer) return;
    setIsTyping(true);
    try {
      await base44.entities.Zimmer.update(selectedZimmer.id, pendingChanges);
      const user = await base44.auth.me();
      const updated = await base44.entities.Zimmer.filter({ owner_id: user.id });
      setZimmers(updated);
      const updatedZimmer = updated.find(z => z.id === selectedZimmer.id);
      if (updatedZimmer) setSelectedZimmer(updatedZimmer);
      setPendingChanges(null);
      setIsTyping(false);
      addMsg('bot', 'text', '✅ השינויים נשמרו בהצלחה! מה עוד תרצה לעשות?');
      if (onRefresh) onRefresh();
    } catch (e) {
      setIsTyping(false);
      addMsg('bot', 'text', 'מצטער, לא הצלחתי לשמור. נסה שוב.');
    }
  };

  const rejectChanges = () => {
    setPendingChanges(null);
    addMsg('bot', 'text', 'בסדר, ביטלתי. מה תרצה לשנות?');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" dir="rtl">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-950 flex flex-col shadow-2xl border-r border-gray-800">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center font-bold text-white">Z</div>
          <div className="flex-1">
            <div className="text-white font-bold text-sm">עוזר ניהול</div>
            <div className="text-gray-400 text-xs">{selectedZimmer ? `עובד על: ${selectedZimmer.name}` : 'בחר צימר לעבודה'}</div>
          </div>
          {selectedZimmer && (
            <button
              onClick={() => { setSelectedZimmer(null); setPendingChanges(null); addMsg('bot', 'zimmer_select', zimmers); addMsg('bot', 'text', 'על איזה צימר תרצה לעבוד עכשיו?'); }}
              className="text-xs text-gray-400 hover:text-white bg-gray-800 px-2 py-1 rounded-lg transition-colors"
            >
              שנה צימר
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {messages.map(msg => (
            <AssistantBubble
              key={msg.id}
              msg={msg}
              onSelectZimmer={selectZimmer}
              selectedZimmer={selectedZimmer}
              onApply={applyChanges}
              onReject={rejectChanges}
              pendingChanges={pendingChanges}
            />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {selectedZimmer && (
          <div className="bg-gray-900 border-t border-gray-800 px-3 py-3 flex items-end gap-2">
            <div className="flex-1 bg-gray-800 rounded-2xl px-4 py-3 min-h-[48px]">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="מה תרצה לשנות?"
                className="w-full bg-transparent outline-none resize-none text-white text-sm leading-5 max-h-28 placeholder-gray-500"
                rows={1}
                style={{ direction: 'rtl' }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center text-white flex-shrink-0 hover:bg-[#128C7E] transition-colors disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantBubble({ msg, onSelectZimmer, selectedZimmer, onApply, onReject, pendingChanges }) {
  const isBot = msg.role === 'bot';

  if (msg.type === 'zimmer_select') {
    return (
      <div className="flex items-start gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">Z</div>
        <div className="flex-1 flex flex-wrap gap-2">
          {msg.content.map(z => (
            <button
              key={z.id}
              onClick={() => !selectedZimmer && onSelectZimmer(z)}
              disabled={!!selectedZimmer}
              className="bg-gray-800 border border-gray-700 hover:border-[#25D366] hover:text-[#25D366] text-gray-200 text-xs px-3 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-default text-right"
            >
              <div className="font-medium">{z.name}</div>
              <div className="text-gray-500 text-[10px]">{z.location || 'ללא מיקום'}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (msg.type === 'changes_preview') {
    const ch = msg.content;
    return (
      <div className="flex items-start gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">Z</div>
        <div className="flex-1 bg-gray-900 border border-[#25D366]/40 rounded-2xl p-4 text-xs space-y-2">
          <p className="text-[#25D366] font-semibold text-xs uppercase tracking-wider mb-2">שינויים מתוכננים</p>
          {ch.name && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">שם:</span><span className="text-white">{ch.name}</span></div>}
          {ch.location && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">מיקום:</span><span className="text-white">{ch.location}</span></div>}
          {ch.price_per_night != null && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">מחיר/לילה:</span><span className="text-white">₪{ch.price_per_night}</span></div>}
          {ch.num_rooms != null && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">חדרים:</span><span className="text-white">{ch.num_rooms}</span></div>}
          {ch.max_guests != null && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">אורחים מקס׳:</span><span className="text-white">{ch.max_guests}</span></div>}
          {ch.description && <div><span className="text-gray-500 block mb-1">תיאור:</span><span className="text-white leading-relaxed">{ch.description}</span></div>}
          {ch.data_zones?.length > 0 && (
            <div>
              <span className="text-gray-500 block mb-1">אזורי מידע ({ch.data_zones.length}):</span>
              {ch.data_zones.map((dz, i) => (
                <div key={i} className="bg-gray-800 rounded-lg px-2 py-1.5 mb-1">
                  <div className="text-white">{dz.content}</div>
                  <div className="text-gray-500 text-[10px] mt-0.5">{dz.source_type} · {dz.source_date}</div>
                </div>
              ))}
            </div>
          )}
          {pendingChanges === msg.content && (
            <div className="flex gap-2 mt-3 pt-2 border-t border-gray-800">
              <button
                onClick={onApply}
                className="flex-1 bg-[#25D366] text-white py-2 rounded-xl text-xs font-semibold hover:bg-[#128C7E] transition-colors"
              >
                ✅ אשר ושמור
              </button>
              <button
                onClick={onReject}
                className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-xl text-xs font-medium hover:text-white transition-colors"
              >
                ❌ בטל
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 mb-1 ${!isBot ? 'flex-row-reverse' : ''}`}>
      {isBot && <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">Z</div>}
      <div className={`max-w-xs px-3 py-2 rounded-2xl shadow-sm whitespace-pre-wrap text-sm leading-relaxed ${
        isBot ? 'bg-gray-800 text-gray-100 rounded-bl-sm' : 'bg-[#25D366]/20 text-gray-100 rounded-br-sm'
      }`}>
        {msg.content}
        <div className="text-xs text-gray-500 mt-1 text-left">{msg.time}</div>
      </div>
    </div>
  );
}