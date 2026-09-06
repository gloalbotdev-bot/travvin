import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Send, Bot, X, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const fmtTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

/**
 * Compact inline AI assistant scoped to a single zimmer (no agents API).
 */
export default function ZimmerInlineChat({ zimmer, initialPrompt, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const sentRef = useRef(false);
  const endRef = useRef(null);

  const addMsg = (role, content) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, content, time: fmtTime() }]);
  };

  const doSend = async (text) => {
    const t = text.trim();
    if (!t || sending) return;
    setInput('');
    setSending(true);
    addMsg('user', t);
    const ctx = `[מצב: עריכה] [הקשר: אתה בדף ניהול הצימר "${zimmer.name}" (מזהה ${zimmer.id}). כל בקשה מתייחסת לצימר זה אלא אם צוין אחרת.] ${t}`;
    try {
      const response = await api.assistant.chat({
        profile: 'admin_zimmer_editor',
        message: ctx,
        conversationId,
        clientState: { zimmerId: zimmer.id },
      });
      if (response?.conversationId) setConversationId(response.conversationId);
      const content = response?.message?.content || response?.message || 'לא התקבלה תשובה.';
      addMsg('assistant', typeof content === 'string' ? content : JSON.stringify(content));
    } catch {
      addMsg('assistant', 'מצטער, אירעה שגיאה. נסה שוב.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (initialPrompt && !sentRef.current) {
      sentRef.current = true;
      doSend(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #E5E7EB' }} dir="rtl">
      <div className="flex items-center justify-between px-3 py-2" style={{ background: '#1E293B' }}>
        <div className="flex items-center gap-2 text-white min-w-0">
          <Sparkles size={14} style={{ color: '#A855F7', flexShrink: 0 }} />
          <span className="text-xs font-bold truncate">עוזר AI · {zimmer.name}</span>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white flex-shrink-0"><X size={14} /></button>
      </div>

      <div className="px-3 py-3 space-y-2 overflow-y-auto" style={{ maxHeight: 280, background: '#F9FAFB' }}>
        {messages.length === 0 && !sending && (
          <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>שאל אותי משהו על הצימר...</p>
        )}
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const content = isUser
            ? String(m.content || '').replace(/^\[מצב: [^\]]+\]\s*\[הקשר:[^\]]*\]\s*/, '')
            : (m.content || '');
          return (
            <div key={m.id} className={`flex items-end gap-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              {!isUser && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: '#F97316' }}>
                  <Bot size={12} />
                </div>
              )}
              <div className="max-w-[85%] min-w-0">
                <div className="px-3 py-2 rounded-2xl text-xs leading-relaxed"
                  style={isUser
                    ? { background: '#1E293B', color: '#fff', borderBottomLeftRadius: '4px' }
                    : { background: '#fff', color: '#1A1A1A', border: '1px solid #F0EEE8', borderBottomRightRadius: '4px' }}>
                  {isUser
                    ? <p className="whitespace-pre-wrap">{content}</p>
                    : <div className="prose prose-sm max-w-none"><ReactMarkdown>{content}</ReactMarkdown></div>}
                </div>
                <div className="text-[10px] mt-0.5 px-1" style={{ color: '#9CA3AF' }}>{m.time}</div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex items-end gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: '#F97316' }}><Bot size={12} /></div>
            <div className="px-3 py-2 rounded-2xl" style={{ background: '#fff', border: '1px solid #F0EEE8' }}>
              <div className="flex gap-1 items-center h-3">
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-1.5 p-2" style={{ background: '#fff', borderTop: '1px solid #F0EEE8' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') doSend(input); }}
          placeholder="כתוב פקודה לצימר..."
          className="flex-1 bg-transparent outline-none text-xs" style={{ color: '#1A1A1A' }} />
        <button onClick={() => doSend(input)} disabled={!input.trim() || sending}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white disabled:opacity-40" style={{ background: '#F97316' }}>
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );
}
