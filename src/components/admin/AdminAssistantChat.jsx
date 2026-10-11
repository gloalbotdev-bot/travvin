import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/api/client';
import { X, Check } from 'lucide-react';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';
import iconSend from '@/assets/owner/home/icon-send.svg';
import iconMic from '@/assets/owner/home/icon-mic.svg';

const formatTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const TypingIndicator = () => (
  <div className="flex items-end gap-2" role="status" aria-label="העוזר מקליד">
    <OwnerAiIcon size={32} />
    <div className="rounded-[10px] px-4 py-3 bg-white" style={{ border: '1px solid #F0EEE8' }}>
      <div className="flex gap-1 items-center h-4">
        {[0, 150, 300].map(d => (
          <div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#0B3838', opacity: 0.35, animationDelay: `${d}ms` }}></div>
        ))}
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
  const { ref: inputRef, resize: resizeInput } = useAutoResize(input, 240);

  useEffect(() => {
    api.auth.me().then(user => {
      api.entities.Zimmer.filter({ owner_id: user.id }).then(data => {
        setZimmers(data);
        addMsg('bot', 'text', 'שלום! אני עוזר הניהול שלך. על איזה צימר תרצה לבצע פעולות?');
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
    addMsg('bot', 'text', `מצוין! עובד על "${zimmer.name}"\n\nמה תרצה לעשות? לדוגמה:\n• "עדכן את המחיר ל-500"\n• "הוסף אזור מידע על מדיניות ביטול"\n• "הוסף כמה אזורי מידע: חיות מחמד, בריכה, חנייה"\n• "שנה את התיאור"\n• "שנה את המיקום ל-..."`);
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

      const response = await api.integrations.Core.InvokeLLM({
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
      await api.entities.Zimmer.update(selectedZimmer.id, pendingChanges);
      const user = await api.auth.me();
      const updated = await api.entities.Zimmer.filter({ owner_id: user.id });
      setZimmers(updated);
      const updatedZimmer = updated.find(z => z.id === selectedZimmer.id);
      if (updatedZimmer) setSelectedZimmer(updatedZimmer);
      setPendingChanges(null);
      setIsTyping(false);
      addMsg('bot', 'text', 'השינויים נשמרו בהצלחה! מה עוד תרצה לעשות?');
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(11,56,56,0.35)' }} onClick={onClose} />
      <div
        className="relative w-full max-w-md flex flex-col"
        style={{ background: '#FAFAFA', borderRight: '1px solid #F0EEE8', boxShadow: '0px 8px 30px rgba(11,56,56,0.18)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-assistant-title"
      >
        {/* Header */}
        <div className="bg-white px-5 py-4 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid #F0EEE8' }}>
          <OwnerAiIcon size={36} />
          <div className="flex-1 min-w-0">
            <h2 id="admin-assistant-title" className="font-simpler leading-tight" style={{ color: '#0B3838', fontSize: 18, fontWeight: 600 }}>עוזר ניהול AI</h2>
            <p className="font-simona truncate mt-0.5" style={{ color: '#717171', fontSize: 13 }}>{selectedZimmer ? `עובד על: ${selectedZimmer.name}` : 'בחר צימר לעבודה'}</p>
          </div>
          {selectedZimmer && (
            <button
              type="button"
              onClick={() => { setSelectedZimmer(null); setPendingChanges(null); addMsg('bot', 'zimmer_select', zimmers); addMsg('bot', 'text', 'על איזה צימר תרצה לעבוד עכשיו?'); }}
              className="font-simona text-xs px-3 py-1.5 rounded-full flex-shrink-0 transition-all hover:opacity-90"
              style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838', border: '1.5px solid rgba(11,56,56,0.12)' }}
            >
              שנה צימר
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
            style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto owner-hide-scrollbar px-4 py-4 space-y-3">
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
          <div className="px-4 pb-4 pt-2 flex-shrink-0">
            <div
              className="rounded-xl bg-white flex flex-col justify-between px-4 pt-3 pb-2.5"
              style={{ border: '1.5px solid #E5E5E5', boxShadow: '0px 0px 3.9px 0px rgba(0,0,0,0.14)' }}
            >
              <label htmlFor="admin-assistant-input" className="font-simona text-right" style={{ color: '#535353', fontSize: 14 }}>
                מה תרצה לשנות?
              </label>
              <div className="flex items-end gap-2.5 mt-1.5">
                <textarea
                  id="admin-assistant-input"
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); resizeInput(); }}
                  onKeyDown={handleKeyDown}
                  className="font-simona flex-1 min-w-0 bg-transparent outline-none resize-none overflow-y-auto leading-5 py-1"
                  rows={1}
                  style={{ color: '#0B3838', fontSize: 14, direction: 'rtl' }}
                />
                <MicButton
                  tone="ghost"
                  compact
                  size={14}
                  iconWidth={14}
                  iconHeight={19}
                  iconSrc={iconMic}
                  disabled={isTyping}
                  onText={t => setInput(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  title="שלח"
                  aria-label="שלח"
                  className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-default"
                  style={{ background: '#0B3838' }}
                >
                  <img src={iconSend} alt="" width={8} height={12} className="block" style={{ width: 8, height: 12 }} />
                </button>
              </div>
            </div>
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
      <div className="flex items-start gap-2">
        <OwnerAiIcon size={32} className="mt-1" />
        <div className="flex-1 flex flex-wrap gap-2">
          {msg.content.map(z => (
            <button
              key={z.id}
              type="button"
              onClick={() => !selectedZimmer && onSelectZimmer(z)}
              disabled={!!selectedZimmer}
              className="font-simona bg-white border-[1.5px] border-[#E4E7E5] enabled:hover:border-[#0B3838] px-3.5 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-default text-right"
            >
              <div style={{ color: '#0B3838', fontSize: 14, fontWeight: 500 }}>{z.name}</div>
              <div style={{ color: '#717171', fontSize: 12 }}>{z.location || 'ללא מיקום'}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (msg.type === 'changes_preview') {
    const ch = msg.content;
    const rows = [
      ch.name && ['שם', ch.name],
      ch.location && ['מיקום', ch.location],
      ch.price_per_night != null && ['מחיר/לילה', `₪${ch.price_per_night}`],
      ch.num_rooms != null && ['חדרים', ch.num_rooms],
      ch.max_guests != null && ['אורחים מקס׳', ch.max_guests],
    ].filter(Boolean);
    return (
      <div className="flex items-start gap-2">
        <OwnerAiIcon size={32} className="mt-1" />
        <div className="font-simona flex-1 min-w-0 bg-white rounded-[23px] p-4 space-y-3" style={{ border: '1.5px solid #E4E7E5' }}>
          <p className="font-simpler" style={{ color: '#0B3838', fontSize: 16, fontWeight: 600 }}>שינויים מתוכננים</p>
          {rows.length > 0 && (
            <div className="space-y-1.5">
              {rows.map(([label, value]) => (
                <div key={label} className="flex gap-2 items-baseline">
                  <span className="w-24 flex-shrink-0" style={{ color: '#717171', fontSize: 13 }}>{label}</span>
                  <span className="min-w-0" style={{ color: '#0B3838', fontSize: 14 }}>{value}</span>
                </div>
              ))}
            </div>
          )}
          {ch.description && (
            <div>
              <span className="block mb-1" style={{ color: '#717171', fontSize: 13 }}>תיאור</span>
              <p className="leading-relaxed whitespace-pre-wrap" style={{ color: '#0B3838', fontSize: 14 }}>{ch.description}</p>
            </div>
          )}
          {ch.data_zones?.length > 0 && (
            <div>
              <span className="block mb-1.5" style={{ color: '#717171', fontSize: 13 }}>אזורי מידע ({ch.data_zones.length})</span>
              <div className="space-y-1.5">
                {ch.data_zones.map((dz, i) => (
                  <div key={i} className="rounded-[10px] px-3 py-2" style={{ background: '#F5F5F5' }}>
                    <div className="whitespace-pre-wrap" style={{ color: '#0B3838', fontSize: 13 }}>{dz.content}</div>
                    <div className="mt-0.5" style={{ color: '#717171', fontSize: 11 }}>{dz.source_type} · {dz.source_date}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pendingChanges === msg.content && (
            <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid #F0EEE8' }}>
              <button
                type="button"
                onClick={onApply}
                className="font-simpler flex-1 text-white py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
                style={{ background: '#0B3838', fontWeight: 600 }}
              >
                <Check size={15} /> אשר ושמור
              </button>
              <button
                type="button"
                onClick={onReject}
                className="font-simona flex-1 py-2.5 rounded-xl text-sm transition-all hover:opacity-90"
                style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838', border: '1.5px solid rgba(11,56,56,0.12)' }}
              >
                בטל
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 ${!isBot ? 'flex-row-reverse' : ''}`}>
      {isBot && <OwnerAiIcon size={32} />}
      <div
        className="max-w-[80%] px-4 py-2.5 rounded-[10px]"
        style={isBot ? { background: '#fff', color: '#0B3838', border: '1px solid #F0EEE8' } : { background: '#0B3838', color: '#fff' }}
      >
        <p className="font-simona leading-relaxed whitespace-pre-wrap" style={{ fontSize: 15 }}>{msg.content}</p>
        <div className="font-simona mt-1 text-left" style={{ fontSize: 11, color: isBot ? '#717171' : 'rgba(255,255,255,0.7)' }}>{msg.time}</div>
      </div>
    </div>
  );
}