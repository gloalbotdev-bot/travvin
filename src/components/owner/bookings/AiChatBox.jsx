import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip, Sparkles } from 'lucide-react';
import ConfirmActionCard from '@/components/owner/ConfirmActionCard';
import useOwnerAssistantThread, { confirmCardStatus } from '@/hooks/useOwnerAssistantThread';

// Lightweight AI chat box at the bottom of the sidebar — the shared owner assistant
// on the bookings surface; the server loads the bookings itself.
export default function AiChatBox({ ownerId, onMutated }) {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const chat = useOwnerAssistantThread({ ownerId, surface: 'bookings', onMutated });
  const { messages, isTyping: busy } = chat;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    chat.send(text);
  };

  return (
    <div className="flex flex-col" style={{ borderTop: '1px solid #ECEFF1' }}>
      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-40 overflow-y-auto px-3 py-2 space-y-2">
          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-start' : 'items-end'}`}>
              <div className="max-w-[85%] text-xs px-3 py-2 rounded-xl whitespace-pre-wrap"
                style={m.role === 'user' ? { background: '#F5F5F5', color: '#212121' } : { background: '#E53935', color: '#fff' }}>
                {m.content}
              </div>
              {m.role === 'bot' && m.pendingAction && (
                <div className="w-full mt-1">
                  <ConfirmActionCard
                    compact
                    action={m.pendingAction}
                    status={confirmCardStatus(m.pendingAction, chat.busyActionId)}
                    onConfirm={() => chat.confirm(m.pendingAction.id)}
                    onCancel={() => chat.cancel(m.pendingAction.id)}
                  />
                </div>
              )}
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
