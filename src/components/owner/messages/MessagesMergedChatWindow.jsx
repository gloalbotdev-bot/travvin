import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '@/api/client';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';
import AiReplySuggestion from './AiReplySuggestion';
import ContactAvatar from './ContactAvatar';
import { parseMsgTime } from './groupContacts';
import { fmtStayRange } from './useContactBooking';
import travvinAvatar from '@/assets/owner/messages/travvin-avatar.svg';
import composerPlus from '@/assets/owner/messages/composer-plus.svg';
import composerMic from '@/assets/owner/messages/composer-mic.svg';
import composerSend from '@/assets/owner/messages/composer-send.svg';

const fmtTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

// Merged conversation across all of a contact's DirectChat threads.
// Messages are interleaved chronologically (thread created-date + msg time),
// New messages go to the thread of the last customer message, or the most
// recently updated thread if none.
export default function MessagesMergedChatWindow({ contact, booking = null }) {
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

  const replyDraftState = () => ({
    kind: 'chat',
    threadIds: (contact?.threads || []).map(t => t.id).slice(0, 20),
    zimmerId: targetThread?.zimmer_id || undefined,
  });

  const lastMsg = merged[merged.length - 1];
  const aiKey = lastMsg && lastMsg.role === 'customer'
    ? `${contact?.key}|${lastMsg.threadId}|${merged.length}|${lastMsg.content}`
    : null;
  const stayRange = fmtStayRange(booking?.check_in, booking?.check_out);
  const headerZimmer = booking?.zimmer_name || targetThread?.zimmer_name || '';
  const headerSub = [headerZimmer, stayRange].filter(Boolean).join(' · ');

  return (
    <div className="font-simona flex flex-col h-full bg-white" dir="rtl">
      <div className="flex items-center justify-between px-[32px] py-[24px] border-b border-[#E5E5E5] flex-shrink-0">
        <div className="flex items-center gap-[12px] min-w-0">
          <ContactAvatar name={contact?.name} />
          <div className="flex flex-col gap-[2px] items-start leading-normal min-w-0">
            <span className="text-[16px] truncate max-w-full" style={{ color: '#0B3838', fontWeight: 500 }}>{contact?.name || 'לקוח'}</span>
            {headerSub && <span className="text-[13px] truncate max-w-full" style={{ color: '#6B7280' }}>{headerSub}</span>}
          </div>
        </div>
        <div className="relative w-[28px] h-[20px] flex-shrink-0" aria-hidden="true">
          {[0.43, 8.66, 16.89].map(top => (
            <span key={top} className="absolute left-0 rounded-full" style={{ top, width: 3.385, height: 3.385, background: '#0B3838' }} />
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto owner-hide-scrollbar p-[32px] flex flex-col gap-[11px]">
        {merged.length === 0 && (
          <div className="text-center text-[15px] mt-8" style={{ color: '#6B7280' }}>אין הודעות עדיין — שלח את ההודעה הראשונה 👋</div>
        )}
        {merged.map((m, i) => (m.role === 'owner'
          ? <OwnerBubble key={i} content={m.content} time={m.time} />
          : <GuestBubble key={i} content={m.content} time={m.time} />
        ))}
        {sending && (
          <div className="flex items-start justify-end gap-[8px] w-full">
            <div className="rounded-[16px] rounded-tl-none p-[16px]" style={{ background: '#EFEFEF' }}>
              <div className="flex gap-1 h-4 items-center">
                {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#6B7280', animationDelay: d + 'ms' }} />)}
              </div>
            </div>
            <img src={travvinAvatar} alt="" width={36} height={36} className="flex-shrink-0" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex-shrink-0 px-4 lg:px-0">
        <div className="mx-auto w-full max-w-[950px] flex flex-col gap-[23px] pt-[17px] pb-[16px] px-[16px] lg:px-[34px] rounded-t-[29px]"
          style={{ background: 'rgba(255,255,255,0.35)', boxShadow: '0px 4px 10.2px 0px rgba(0,0,0,0.09)' }}>
          <AiReplySuggestion
            key={contact?.key}
            autoKey={aiKey}
            getClientState={replyDraftState}
            onApply={(t) => { setInput(p => p ? p.replace(/\s+$/, '') + ' ' + t : t); resize(); inputRef.current?.focus(); }}
            disabled={sending}
          />

          <div className="bg-white border border-[#E5E5E5] rounded-[23px] min-h-[73px] flex items-center gap-[16px] px-[20px] lg:px-[32px] pt-[20px] pb-[24px]"
            style={{ filter: 'drop-shadow(0px 4px 10.55px rgba(0,0,0,0.07))' }}>
            <button type="button" className="flex-shrink-0 rounded-full" title="צרף" aria-label="צרף">
              <img src={composerPlus} alt="" width={29} height={29} className="block" />
            </button>
            <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); resize(); }} onKeyDown={onKey} rows={1}
              aria-label="כתיבת הודעה"
              placeholder="כתיבת הודעה..."
              className="flex-1 min-w-0 bg-transparent outline-none resize-none text-[18px] leading-[21px] overflow-y-auto max-h-32 placeholder:text-[#0B3838]"
              style={{ color: '#0B3838', direction: 'rtl' }} />
            <div className="flex items-center gap-[20px] flex-shrink-0">
              <MicButton compact tone="ghost" iconSrc={composerMic} iconWidth={16} iconHeight={21} disabled={sending}
                onText={t => setInput(p => p ? p.replace(/\s+$/, '') + ' ' + t : t)} />
              <button type="button" onClick={send} disabled={!input.trim() || sending} aria-label="שליחת הודעה" title="שליחת הודעה"
                className="rounded-full disabled:opacity-50">
                <img src={composerSend} alt="" width={29} height={29} className="block" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuestBubble({ content, time }) {
  return (
    <div className="flex items-start justify-start w-full">
      <div className="max-w-[480px] p-[16px] rounded-[16px] rounded-tr-none bg-white border border-[#E5E5E5] flex flex-col items-start">
        <p className="text-[15px] leading-[1.5] whitespace-pre-wrap text-right" style={{ color: '#0B3838' }}>{content}</p>
        {time && <span className="text-[11px] leading-normal self-end" style={{ color: '#6B7280' }}>{time}</span>}
      </div>
    </div>
  );
}

function OwnerBubble({ content, time }) {
  return (
    <div className="flex items-start justify-end gap-[8px] w-full">
      <div className="max-w-[480px] p-[16px] rounded-[16px] rounded-tl-none flex flex-col items-start" style={{ background: '#EFEFEF' }}>
        <p className="text-[15px] leading-[1.5] whitespace-pre-wrap text-right" style={{ color: '#0B3838' }}>{content}</p>
        {time && <span className="text-[11px] leading-normal self-end" style={{ color: '#6B7280' }}>{time}</span>}
      </div>
      <img src={travvinAvatar} alt="" width={36} height={36} className="flex-shrink-0" />
    </div>
  );
}