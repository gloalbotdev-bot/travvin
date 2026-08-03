import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, X, Home } from 'lucide-react';

const fmtTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

// Resolve an existing thread between this customer and the zimmer's owner, or create one.
export async function getOrCreateDirectThread({ zimmer, customer, bookingId }) {
  if (!base44.entities || !base44.entities.DirectChat) {
    throw new Error('מודול הצ׳אט הישיר עדיין לא נטען. רענן את הדף (F5) ונסה שוב.');
  }
  try {
    const existing = await base44.entities.DirectChat.filter({ zimmer_id: zimmer.id, customer_id: customer.id });
    if (existing && existing.length > 0) return existing[0];
  } catch (e) { /* fall through to create */ }
  return await base44.entities.DirectChat.create({
    zimmer_id: zimmer.id,
    zimmer_name: zimmer.name || '',
    customer_id: customer.id,
    customer_name: customer.full_name || customer.email || '',
    owner_id: zimmer.owner_id,
    owner_name: zimmer.owner_name || '',
    booking_id: bookingId || null,
    messages: [],
  });
}

export default function DirectChat({ thread, isOwner, user, counterpartName, zimmerName, onClose, inline }) {
  const [messages, setMessages] = useState(thread?.messages || []);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { setMessages(thread?.messages || []); }, [thread?.id]);

  useEffect(() => {
    const unsub = base44.entities.DirectChat.subscribe((ev) => {
      if (ev.id === thread?.id && ev.type === 'update' && ev.data) {
        setMessages(ev.data.messages || []);
      }
    });
    return unsub;
  }, [thread?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const myRole = isOwner ? 'owner' : 'customer';

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    const newMsg = { role: myRole, content: text, time: fmtTime() };
    const updated = [...messages, newMsg];
    setMessages(updated);
    try {
      await base44.entities.DirectChat.update(thread.id, { messages: updated });
    } catch (e) {
      setMessages(messages);
    }
    setSending(false);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className={`${inline ? 'absolute inset-0' : 'fixed inset-0 z-[60]'} flex flex-col bg-[#ECE5DD]`} dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      {/* Header */}
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 flex-shrink-0"><X size={20} /></button>
        <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-lg">
          {isOwner ? '👤' : '🏠'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base truncate">{counterpartName || (isOwner ? 'לקוח' : 'בעל הצימר')}</div>
          <div className="text-xs text-green-200 truncate flex items-center gap-1"><Home size={11} /> {zimmerName || thread?.zimmer_name}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="text-center text-sm text-gray-400 mt-8">אין הודעות עדיין — שלח את ההודעה הראשונה 👋</div>
        )}
        {messages.map((m, i) => {
          const mine = m.role === myRole;
          return (
            <div key={i} className={`flex items-end gap-2 mb-1 ${mine ? 'flex-row-reverse' : ''}`}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: m.role === 'owner' ? '#075E54' : '#25D366' }}>
                {m.role === 'owner' ? 'ב' : 'ל'}
              </div>
              <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl shadow-sm ${mine ? 'bg-[#DCF8C6] text-gray-800 rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm'}`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                <span className="text-[10px] text-gray-400 block text-left mt-0.5">{m.time}{mine && <span className="text-blue-400"> ✓✓</span>}</span>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className={`flex items-end gap-2 mb-1 ${'flex-row-reverse'}`}>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold">{isOwner ? 'ב' : 'ל'}</div>
            <div className="bg-[#DCF8C6] rounded-2xl rounded-br-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="bg-[#F0F0F0] px-3 py-3 flex items-end gap-2">
        <button onClick={send} disabled={!input.trim() || sending}
          className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-md hover:bg-[#128C7E] transition-colors disabled:opacity-50 flex-shrink-0">
          <Send size={20} />
        </button>
        <div className="flex-1 bg-white rounded-full px-4 py-3 flex items-center shadow-sm min-h-[48px]">
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="כתוב הודעה..." className="w-full bg-transparent outline-none resize-none text-gray-800 text-sm leading-5 max-h-32" rows={1} style={{ direction: 'rtl' }} />
        </div>
      </div>
    </div>
  );
}