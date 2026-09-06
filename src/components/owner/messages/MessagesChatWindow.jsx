import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Send, Plus } from 'lucide-react';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';
import AiReplySuggestion from './AiReplySuggestion';

const fmtTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

export default function MessagesChatWindow({ thread, booking, zimmer, user }) {
  const [messages, setMessages] = useState(thread?.messages || []);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const { ref: inputRef, resize } = useAutoResize(input, 200);

  useEffect(() => { setMessages(thread?.messages || []); }, [thread?.id]);

  useEffect(() => {
    const unsub = api.entities.DirectChat.subscribe((ev) => {
      if (ev.id === thread?.id && ev.type === 'update' && ev.data) setMessages(ev.data.messages || []);
    });
    return unsub;
  }, [thread?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    const newMsg = { role: 'owner', content: text, time: fmtTime() };
    const updated = [...messages, newMsg];
    setMessages(updated);
    try {
      await api.entities.DirectChat.update(thread.id, { messages: updated });
    } catch {
      setMessages(messages);
    }
    setSending(false);
  };
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const buildPrompt = () => {
    const zones = (zimmer?.data_zones || []).map(z => `[${z.source_type || 'מידע'}]: ${z.content || ''}`).join('\n');
    const hist = messages.slice(-12).map(m => `${m.role === 'owner' ? 'בעלים' : 'לקוח'}: ${m.content}`).join('\n');
    const lastCustomer = [...messages].reverse().find(m => m.role === 'customer');
    return `אתה עוזר של בעל צימר. כתוב תשובה קצרה, אדיבה ומועילה בעברית ללקוח בצ'אט.
צימר: ${zimmer?.name || thread?.zimmer_name || ''}
פרטי הנכס:
${zones || '(אין מידע נוסף)'}
${booking ? `הזמנה: ${booking.check_in} עד ${booking.check_out}, ${booking.num_guests || ''} אורחים, סטטוס: ${booking.status}` : ''}
היסטוריית צ'אט:
${hist || '(תחילת שיחה)'}
ההודעה האחרונה מהלקוח: ${lastCustomer?.content || ''}
החזר JSON בלבד: {"reply":"תוכן התשובה"}`;
  };

  const statusBadge = booking?.status === 'אושרה'
    ? { label: 'הזמנה מאושרת', bg: '#16A34A' }
    : booking?.status === 'ממתינה' ? { label: 'הזמנה ממתינה', bg: '#F97316' } : null;

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderColor: '#F0EEE8' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: '#075E54' }}>
          {(thread?.customer_name || 'ל').slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ color: '#1A1A1A' }}>{thread?.customer_name || 'לקוח'}</div>
          <div className="text-xs truncate" style={{ color: '#9CA3AF' }}>
            {thread?.zimmer_name}{booking ? ` · ${booking.check_in} עד ${booking.check_out}` : ''}
          </div>
        </div>
        {statusBadge && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white flex-shrink-0" style={{ background: statusBadge.bg }}>{statusBadge.label}</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ background: '#FAFAFA' }}>
        {messages.length === 0 && (
          <div className="text-center text-sm text-gray-400 mt-8">אין הודעות עדיין — שלח את ההודעה הראשונה 👋</div>
        )}
        {messages.map((m, i) => {
          const mine = m.role === 'owner';
          return (
            <div key={i} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl shadow-sm ${mine ? 'rounded-bl-sm' : 'bg-white border rounded-br-sm'}`}
                style={mine ? { background: '#F3F4F6', color: '#1F2937' } : { borderColor: '#E5E7EB', color: '#1F2937' }}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                <span className="text-[10px] block text-left mt-0.5" style={{ color: '#9CA3AF' }}>
                  {m.time}{mine && <span style={{ color: '#3B82F6' }}> ✓✓</span>}
                </span>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ background: '#F3F4F6' }}>
              <div className="flex gap-1 h-4 items-center">
                {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: d + 'ms' }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <AiReplySuggestion
        key={thread?.id}
        contextLabel="לפי פרטי הנכס והשיחה"
        buildPrompt={buildPrompt}
        onApply={(t) => { setInput(p => p ? p.replace(/\s+$/, '') + ' ' + t : t); resize(); inputRef.current?.focus(); }}
        disabled={sending}
      />

      {/* Input */}
      <div className="px-3 pb-3 pt-1 flex items-end gap-2 border-t" style={{ borderColor: '#F0EEE8', background: '#fff' }}>
        <button className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#F3F4F6', color: '#6B7280' }} title="צרף"><Plus size={20} /></button>
        <div className="flex-1 rounded-full px-4 py-2.5 flex items-center min-h-[44px]" style={{ background: '#F3F4F6' }}>
          <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); resize(); }} onKeyDown={onKey} rows={1}
            placeholder="כתיבת הודעה..." className="w-full bg-transparent outline-none resize-none text-sm text-gray-800 leading-5 overflow-y-auto max-h-32" style={{ direction: 'rtl' }} />
        </div>
        <MicButton tone="light" disabled={sending} onText={t => setInput(p => p ? p.replace(/\s+$/, '') + ' ' + t : t)} />
        <button onClick={send} disabled={!input.trim() || sending} className="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-50" style={{ background: '#16A34A' }}><Send size={20} /></button>
      </div>
    </div>
  );
}