import React, { useState, useEffect } from 'react';
import { X, Sparkles, MessageCircle } from 'lucide-react';
import DirectChat, { getOrCreateDirectThread } from '@/components/chat/DirectChat';
import ZimmerAiSidebarChat from '@/components/customer/ZimmerAiSidebarChat';
import ZimmerAskOwnerForm from '@/components/customer/ZimmerAskOwnerForm';
import ZimmerPersonalArea from '@/components/customer/ZimmerPersonalArea';

// Side chat panel with a toggle between the AI assistant (scoped to this zimmer)
// and a direct chat thread with the owner.
export default function ZimmerPageSidebar({ zimmer, user, onBook, onClose }) {
  const [mode, setMode] = useState('ai'); // 'ai' | 'direct'
  const [thread, setThread] = useState(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [askOwner, setAskOwner] = useState(null);

  useEffect(() => {
    if (mode !== 'direct' || !user || thread) return;
    let active = true;
    setLoadingThread(true);
    (async () => {
      try {
        const t = await getOrCreateDirectThread({ zimmer, customer: user });
        if (active) setThread(t);
      } catch {} finally { if (active) setLoadingThread(false); }
    })();
    return () => { active = false; };
  }, [mode, user, zimmer.id, thread]);

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      {/* Toggle header */}
      <div className="flex items-center gap-1.5 px-3 py-2.5" style={{ background: '#0B3838' }}>
        <button onClick={() => setMode('ai')}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg transition-all"
          style={mode === 'ai' ? { background: '#fff', color: '#0B3838' } : { color: 'rgba(255,255,255,0.7)' }}>
          <Sparkles size={13} /> עוזר AI
        </button>
        <button onClick={() => setMode('direct')}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg transition-all"
          style={mode === 'direct' ? { background: '#fff', color: '#0B3838' } : { color: 'rgba(255,255,255,0.7)' }}>
          <MessageCircle size={13} /> צ'אט ישיר
        </button>
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          {mode === 'ai' ? (
            <ZimmerAiSidebarChat zimmer={zimmer} user={user} onBook={onBook} onAskOwner={(q) => setAskOwner({ question: q, ts: Date.now() })} />
          ) : loadingThread ? (
            <div className="h-full flex items-center justify-center" style={{ background: '#ECE5DD' }}>
              <div className="w-6 h-6 border-2 border-gray-300 border-t-[#0B3838] rounded-full animate-spin" />
            </div>
          ) : thread ? (
            <DirectChat thread={thread} isOwner={false} user={user}
              counterpartName={thread.owner_name} zimmerName={thread.zimmer_name}
              onClose={() => setMode('ai')} inline />
          ) : (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: '#9CA3AF', background: '#ECE5DD' }}>לא הצלחנו לפתוח את הצ'אט. נסה שוב.</div>
          )}
        </div>
        {mode === 'ai' && user && (
          <div className="flex-shrink-0 flex flex-col" style={{ borderTop: '1px solid #E8E5E0' }}>
            {askOwner && (
              <ZimmerAskOwnerForm key={askOwner.ts} zimmer={zimmer} user={user} initialQuestion={askOwner.question} onClose={() => setAskOwner(null)} />
            )}
            <ZimmerPersonalArea zimmer={zimmer} user={user} />
          </div>
        )}
      </div>
    </div>
  );
}