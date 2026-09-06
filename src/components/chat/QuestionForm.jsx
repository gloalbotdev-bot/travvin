import React, { useState } from 'react';
import { Send, HelpCircle, Check } from 'lucide-react';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';

export default function QuestionForm({ zimmer, question, onSubmit }) {
  const [text, setText] = useState(question || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { ref: inputRef, resize: resizeInput } = useAutoResize(text, 200);

  const submit = () => {
    const v = text.trim();
    if (!v || sending || sent) return;
    setSending(true);
    onSubmit(v);
    setSending(false);
    setSent(true);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden" dir="rtl">
      <div className="bg-[#075E54] text-white px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold"><HelpCircle size={14} /> שאלה לבעל הצימר</div>
        <div className="text-xs text-green-200 mt-0.5 truncate">{zimmer?.name}</div>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-500">אין לי מידע על כך כרגע. ערוך את השאלה ולחץ "שלח" — השאלה תועבר ישירות לבעל הצימר.</p>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => { setText(e.target.value); resizeInput(); }}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="כתוב את השאלה שלך..."
            className="flex-1 bg-[#F8F7F4] border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#25D366] resize-none overflow-y-auto"
            style={{ direction: 'rtl' }}
          />
          <MicButton tone="light" disabled={sending} onText={t => setText(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))} />
        </div>
        <button
          onClick={submit}
          disabled={!text.trim() || sending || sent}
          className="w-full font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:cursor-default"
          style={sent
            ? { background: '#9CA3AF', color: '#fff' }
            : { background: '#25D366', color: '#fff' }}
        >
          {sent
            ? <><Check size={14} /> נשלח בהצלחה</>
            : <><Send size={14} /> {sending ? 'שולח...' : 'שלח לבעל הצימר'}</>}
        </button>
      </div>
    </div>
  );
}