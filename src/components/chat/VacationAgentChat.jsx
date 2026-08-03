import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Sparkles, MapPin, Utensils, Compass, ArrowRight } from 'lucide-react';

const fmtTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

function buildQuick(upcoming) {
  const opts = [];
  if (upcoming.length > 0) {
    const n = upcoming[0];
    opts.push({ icon: Compass, label: 'תכנן יום באזור הצימר', text: `תכנן לי יום כיפי באזור הצימר "${n.zimmer_name}"` });
    opts.push({ icon: Utensils, label: 'מסעדות בסביבה', text: `המלץ לי על מסעדות טובות באזור הצימר שלי` });
    if ((n.num_children || 0) > 0) {
      opts.push({ icon: Sparkles, label: 'אטרקציות לילדים', text: `יש לי ${n.num_children || 0} ילדים בחופשה, מה כדאי לעשות איתם באזור?` });
    }
    opts.push({ icon: MapPin, label: 'תחנות בדרך לצימר', text: `מה כדאי לעצור ולראות בדרך לצימר "${n.zimmer_name}"?` });
  } else {
    opts.push({ icon: Compass, label: 'רעיונות לחופשה בצפון', text: 'תן לי רעיונות לחופשה משפחתית בצפון' });
    opts.push({ icon: Sparkles, label: 'רעיונות לחופשה באילת', text: 'תן לי רעיונות לחופשה באילת' });
  }
  return opts;
}

export default function VacationAgentChat({ user, onSwitchToSearch }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [profile, setProfile] = useState(null);
  const [quickOpts, setQuickOpts] = useState([]);
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      let upcoming = [];
      let prof = null;
      try {
        if (user?.id) {
          const all = await base44.entities.BookingRequest.list('-created_date', 60);
          const isMine = b => b.created_by_id === user.id || (b.guest_name && user.full_name && b.guest_name.trim() === user.full_name.trim());
          upcoming = all
            .filter(b => isMine(b) && new Date(b.check_in) >= new Date())
            .sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
          const profs = await base44.entities.CustomerProfile.filter({ user_id: user.id });
          prof = profs[0] || null;
        }
      } catch (e) { /* silent */ }
      setBookings(upcoming);
      setProfile(prof);

      const greet = `👋 שלום${user?.full_name ? ' ' + user.full_name : ''}! אני הסוכן האישי לחופשה שלך.`;
      let extra = '';
      if (upcoming.length > 0) {
        const n = upcoming[0];
        const parts = [
          n.num_adults > 0 ? `${n.num_adults} מבוגרים` : null,
          n.num_children > 0 ? `${n.num_children} ילדים` : null,
        ].filter(Boolean);
        const comps = parts.join(' ו-');
        extra = `\nראיתי שיש לך חופשה קרובה ל"${n.zimmer_name}" (${n.check_in} עד ${n.check_out})${comps ? `, הרכב: ${comps}` : ''}.\nאוכל להמליץ לך על מסעדות, אטרקציות ונקודות עניין בסביבה ובדרך — מותאם להרכב שלכם 👨‍👩‍👧‍👦.`;
      } else {
        extra = `\nברגע שיהיה לך חופשה מתוכננת, אדע להתאים המלצות למקום ולהרכב שלכם. בינתיים תוכל לשאול אותי על כל יעד 🗺️.`;
        if (onSwitchToSearch) extra += `\nרוצה לחפש צימר? בחר "חיפוש והזמנות" בכפתור למעלה.`;
      }
      setMessages([{ id: Date.now(), role: 'bot', content: greet + extra, time: fmtTime() }]);
      setQuickOpts(buildQuick(upcoming));
    })();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const buildContext = () => {
    let c = `פרטי הלקוח: ${user?.full_name || ''} (${user?.email || ''}).`;
    if (profile) {
      if (profile.vacation_preferences) c += `\nהעדפות נופש: ${profile.vacation_preferences}`;
      if (profile.preferred_regions) c += `\nאזורים מועדפים: ${profile.preferred_regions}`;
      if (profile.num_guests_usual) c += `\nמספר אורחים רגיל: ${profile.num_guests_usual}`;
    }
    if (bookings.length > 0) {
      c += `\n\nהזמנות קרובות:`;
      bookings.slice(0, 3).forEach(b => {
        const parts = [b.num_adults ? `${b.num_adults} מבוגרים` : null, b.num_children ? `${b.num_children} ילדים` : null].filter(Boolean).join(' + ');
        c += `\n- ${b.zimmer_name} | כניסה ${b.check_in} עד ${b.check_out} | ${parts || 'הרכב לא צוין'} | סטטוס: ${b.status}`;
      });
    } else {
      c += `\nאין הזמנות קרובות כרגע.`;
    }
    return c;
  };

  const send = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || isTyping) return;
    setInput('');
    setQuickOpts([]);
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'user', content: text, time: fmtTime() }]);
    setIsTyping(true);
    try {
      const ctx = buildContext();
      const prompt = `אתה סוכן נופש אישי. ענה בעברית חמה ומועילה.
${ctx}

בקשת הלקוח: "${text}"

המלץ בצורה מפורטת: מסעדות, אטרקציות, נקודות עניין ופעילויות באזור החופשה ובדרך אליו.
- התאם את ההמלצות להרכב הנוסעים (מבוגרים/ילדים) שמופיע למעלה. אם יש ילדים, תעדף מקומות מתאימים למשפחות.
- השתמש במידע עדכני מהרשת (כתובות, שעות פתיחה, דירוגים).
- פרק את התשובה לפסקאות עם כותרות ורשימות להבהרה.`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
      });
      const answer = typeof res === 'string' ? res : (res?.message || 'מצטער, לא הצלחתי להפיק תשובה.');
      setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', content: answer, time: fmtTime() }]);
      setQuickOpts(buildQuick(bookings));
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', content: 'מצטער, אירעה שגיאה בשליפת ההמלצות. נסה שוב.', time: fmtTime() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(null); }
  };

  return (
    <div className="flex flex-col flex-1 bg-[#ECE5DD]" dir="rtl" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c5b8ac' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map(msg => (
          <div key={msg.id} className={`flex items-end gap-2 mb-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'bot' && <div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">✈</div>}
            <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl shadow-sm ${msg.role === 'bot' ? 'bg-white text-gray-800 rounded-bl-sm' : 'bg-[#DCF8C6] text-gray-800 rounded-br-sm'}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-[10px] text-gray-400">{msg.time}</span>
                {msg.role === 'user' && <span className="text-[10px] text-blue-400">✓✓</span>}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-end gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">✈</div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-xs">
              <div className="flex gap-1 items-center h-4">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        {!isTyping && quickOpts.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 pb-1">
            {quickOpts.map((q, i) => (
              <button key={i} onClick={() => send(q.text)}
                className="flex items-center gap-1.5 text-xs font-medium bg-white text-[#075E54] px-3 py-2 rounded-full shadow-sm hover:bg-green-50 transition-colors">
                <q.icon size={13} /> {q.label}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="bg-[#F0F0F0] px-3 py-3 flex items-end gap-2">
        <button
          onClick={() => send(null)}
          disabled={!input.trim() || isTyping}
          className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-md hover:bg-[#128C7E] transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <Send size={20} />
        </button>
        <div className="flex-1 bg-white rounded-full px-4 py-3 flex items-center shadow-sm min-h-[48px]">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="במה לעזור לך בחופשה?..."
            className="w-full bg-transparent outline-none resize-none text-gray-800 text-sm leading-5 max-h-32"
            rows={1}
            style={{ direction: 'rtl' }}
          />
        </div>
      </div>
    </div>
  );
}