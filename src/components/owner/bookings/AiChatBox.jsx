import React, { useState, useRef } from 'react';
import { Send, Mic, Paperclip, Sparkles } from 'lucide-react';
import { api } from '@/api/client';

// Lightweight AI chat box at the bottom of the sidebar. Sends the owner's
// question + a compact summary of their bookings to InvokeLLM and renders
// the reply inline.
export default function AiChatBox({ bookings, zimmers }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  const buildSummary = () => {
    const zMap = Object.fromEntries(zimmers.map(z => [z.id, z]));
    const lines = bookings.slice(0, 40).map(b => {
      const z = zMap[b.zimmer_id];
      return `• ${b.guest_name} | ${b.zimmer_name || z?.name} | ${b.check_in}→${b.check_out} | ${b.num_guests || 1} אורחים | סטטוס: ${b.status} | ₪${b.total_price || 0}`;
    });
    return `יש ${bookings.length} הזמנות.\n${lines.join('\n')}`;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setBusy(true);
    try {
      const prompt = `אתה עוזר אישי לבעל צימרים. ענה בעברית, בקצרה ובעניין, רק על הזמנות/ניהול נכסים.\nתאריך היום: ${new Date().toISOString().split('T')[0]}\nהנתונים:\n${buildSummary()}\nשאלה: ${text}`;
      const res = await api.integrations.Core.InvokeLLM({ prompt });
      setMessages(prev => [...prev, { role: 'bot', content: typeof res === 'string' ? res : (res?.message || 'מצטער, לא הצלחתי לענות כעת.') }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', content: 'מצטער, שגיאה בשליחת השאלה. נסה שוב.' }]);
    }
    setBusy(false);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
  };

  return (
    <div className="flex flex-col" style={{ borderTop: '1px solid #ECEFF1' }}>
      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-40 overflow-y-auto px-3 py-2 space-y-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[85%] text-xs px-3 py-2 rounded-xl"
                style={m.role === 'user' ? { background: '#F5F5F5', color: '#212121' } : { background: '#E53935', color: '#fff' }}>
                {m.content}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2" style={{ border: '1px solid #ECEFF1' }}>
          <Sparkles size={15} style={{ color: '#E53935', flexShrink: 0 }} />
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="שאל את ה-AI על ההזמנות שלך..."
            className="flex-1 bg-transparent outline-none text-sm" style={{ color: '#212121' }} />
          <button className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#9e9e9e' }}><Paperclip size={14} /></button>
          <button className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#9e9e9e' }}><Mic size={14} /></button>
          <button onClick={send} disabled={busy || !input.trim()}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white disabled:opacity-40" style={{ background: '#E53935' }}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}