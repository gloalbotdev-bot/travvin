import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Send, HelpCircle, Check, X, Loader2 } from 'lucide-react';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';

// Compact "ask the owner" form rendered below the zimmer-page side chat.
// Creates an UnansweredQuestion (created_by_id = customer) so the existing
// "Question Answered Notify Customer" workflow notifies the customer on answer.
export default function ZimmerAskOwnerForm({ zimmer, user, initialQuestion, onClose }) {
  const [text, setText] = useState(initialQuestion || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { ref: inputRef, resize } = useAutoResize(text, 160);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 60); return () => clearTimeout(t); }, []);

  const submit = async () => {
    const v = text.trim();
    if (!v || sending || sent) return;
    setSending(true);
    try {
      await api.entities.UnansweredQuestion.create({
        zimmer_id: zimmer.id,
        zimmer_name: zimmer.name,
        owner_id: zimmer.owner_id,
        question: v,
        customer_name: user?.full_name || '',
        session_id: '',
        status: 'ממתינה',
      });
      setSent(true);
    } catch (e) { /* silent */ }
    setSending(false);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };

  if (sent) {
    return (
      <div className="px-3 py-3" dir="rtl" style={{ background: '#F8F7F4', borderBottom: '1px solid #E8E5E0' }}>
        <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#16A34A' }}>
            <Check size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: '#15803D' }}>נשלח לבעל הצימר ✅</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#16A34A' }}>התשובה תגיע בעדכונים ובאזור האישי שלך למטה ברגע שבעל הצימר יענה.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={16} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3" dir="rtl" style={{ background: '#F8F7F4', borderBottom: '1px solid #E8E5E0' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: '#0B3838' }}>
          <HelpCircle size={14} /> שאלה לבעל הצימר
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 bg-white rounded-2xl px-3 py-2 flex items-center shadow-sm" style={{ border: '1px solid #E8E5E0' }}>
          <textarea ref={inputRef} value={text} onChange={(e) => { setText(e.target.value); resize(); }} onKeyDown={handleKeyDown}
            rows={1} placeholder="כתוב את השאלה שלך..." className="w-full bg-transparent outline-none resize-none text-sm leading-5 overflow-y-auto max-h-28" style={{ direction: 'rtl' }} />
        </div>
        <MicButton tone="light" disabled={sending} onText={(t) => setText((p) => (p ? p.replace(/\s+$/, '') + ' ' + t : t))} />
        <button onClick={submit} disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md flex-shrink-0 transition-colors disabled:opacity-50"
          style={{ background: '#0B3838' }}>
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}