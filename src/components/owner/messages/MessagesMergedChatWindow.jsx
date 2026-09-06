import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '@/api/client';
import { Send, Plus, Tag } from 'lucide-react';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';
import AiReplySuggestion from './AiReplySuggestion';
import { parseMsgTime } from './groupContacts';

const fmtTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

// Merged conversation across all of a contact's DirectChat threads.
// Messages are interleaved chronologically (thread created-date + msg time),
// each tagged with its zimmer. New messages go to the thread of the last
// customer message, or the most recently updated thread if none.
export default function MessagesMergedChatWindow({ contact, zimmers = {}, user }) {
  const [threadMessages, setThreadMessages] = useState(() => {
    const m = {};
    (contact?.threads || []).forEach(t => { m[t.id] = t.messages || []; });
    return m;
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const { ref: inputRef, resize } = useAutoResize(input, 200);

  useEffect(() => {
    const m = {};
    (contact?.threads || []).forEach(t => { m[t.id] = t.messages || []; });
    setThreadMessages(m);
  }, [contact?.key]);

  useEffect(() => {
    const unsub = api.entities.DirectChat.subscribe((ev) => {
      if (ev.type === 'update' && ev.data && threadMessages[ev.id] !== undefined) {
        setThreadMessages(prev => ({ ...prev, [ev.id]: ev.data.messages || [] }));
      }
    });
    return unsub;
  }, [contact?.key]);

  // Build a chronologically-sorted merged list of all messages across threads.
  const merged = useMemo(() => {
    const arr = [];
    (contact?.threads || []).forEach(t => {
      const base = new Date(t.created_date || t.updated_date || Date.now());
      (threadMessages[t.id] || []).forEach((m, idx) => {
        const tm = parseMsgTime(m.time);
        let ts;
        if (tm) { ts = new Date(base); ts.setHours(tm.h, tm.min, 0, 0); }
        else { ts = new Date(base.getTime() + idx * 1000); }
        arr.push({ ...m, threadId: t.id, zimmerId: t.zimmer_id, zimmerName: t.zimmer_name, ts });
      });
    });
    arr.sort((a, b) => a.ts - b.ts);
    return arr;
  }, [threadMessages, contact?.key]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [merged.length, sending]);

  // Target thread for the next outgoing message.
  const targetThread = useMemo(() => {
    const lastCustomer = [...merged].reverse().find(m => m.role === 'customer');
    if (lastCustomer) {
      const t = (contact?.threads || []).find(x => x.id === lastCustomer.threadId);
      if (t) return t;
    }
    return [...(contact?.threads || [])].sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date))[0];
  }, [merged, contact?.key]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !targetThread) return;
    setInput('');
    setSending(true);
    const newMsg = { role: 'owner', content: text, time: fmtTime() };
    const updated = [...(threadMessages[targetThread.id] || []), newMsg];
    setThreadMessages(prev => ({ ...prev, [targetThread.id]: updated }));
    try {
      await api.entities.DirectChat.update(targetThread.id, { messages: updated });
    } catch {
      setThreadMessages(prev => ({ ...prev, [targetThread.id]: targetThread.messages || [] }));
    }
    setSending(false);
  };
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const buildPrompt = () => {
    const z = targetThread ? zimmers[targetThread.zimmer_id] : null;
    const zones = (z?.data_zones || []).map(zn => `[${zn.source_type || 'מידע'}]: ${zn.content || ''}`).join('\n');
    const hist = merged.slice(-12).map(m => `${m.role === 'owner' ? 'בעלים' : 'לקוח'}${m.zimmerName ? ` (${m.zimmerName})` : ''}: ${m.content}`).join('\n');
    const lastCustomer = [...merged].reverse().find(m => m.role === 'customer');
    return `אתה עוזר של בעל צימר. כתוב תשובה קצרה, אדיבה ומועילה בעברית ללקוח בצ'אט.
צימר: ${z?.name || targetThread?.zimmer_name || ''}
פרטי הנכס:
${zones || '(אין מידע נוסף)'}
היסטוריית צ'אט:
${hist || '(תחילת שיחה)'}
ההודעה האחרונה מהלקוח: ${lastCustomer?.content || ''}
החזר JSON בלבד: {"reply":"תוכן התשובה"}`;
  };

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderColor: '#F0EEE8' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: '#075E54' }}>
          {(contact?.name || 'ל').slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ color: '#1A1A1A' }}>{contact?.name || 'לקוח'}</div>
          <div className="text-xs truncate" style={{ color: '#9CA3AF' }}>
            {(contact?.threads || []).length} צימרים · {targetThread?.zimmer_name || ''}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ background: '#FAFAFA' }}>
        {merged.length === 0 && (
          <div className="text-center text-sm text-gray-400 mt-8">אין הודעות עדיין — שלח את ההודעה הראשונה 👋</div>
        )}
        {merged.map((m, i) => {
          const mine = m.role === 'owner';
          const senderName = mine ? (user?.full_name || 'בעלים') : (contact?.name || 'לקוח');
          return (
            <div key={i} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl shadow-sm ${mine ? 'rounded-bl-sm' : 'bg-white border rounded-br-sm'}`}
                style={mine ? { background: '#F3F4F6', color: '#1F2937' } : { borderColor: '#E5E7EB', color: '#1F2937' }}>
                <div className="flex items-center gap-1 mb-1">
                  <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(7,94,84,0.1)', color: '#075E54' }}>
                    {senderName}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(67,56,202,0.08)', color: '#4338ca' }}>
                    <Tag size={9} /> {m.zimmerName || 'צימר'}
                  </span>
                </div>
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
        key={contact?.key}
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
            placeholder={`כתיבת הודעה${targetThread ? ` · ${targetThread.zimmer_name}` : ''}...`} className="w-full bg-transparent outline-none resize-none text-sm text-gray-800 leading-5 overflow-y-auto max-h-32" style={{ direction: 'rtl' }} />
        </div>
        <MicButton tone="light" disabled={sending} onText={t => setInput(p => p ? p.replace(/\s+$/, '') + ' ' + t : t)} />
        <button onClick={send} disabled={!input.trim() || sending} className="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-50" style={{ background: '#16A34A' }}><Send size={20} /></button>
      </div>
    </div>
  );
}