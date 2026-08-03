import React, { useState } from 'react';
import { Send, HelpCircle } from 'lucide-react';

export default function QuestionForm({ zimmer, question, onSubmit }) {
  const [text, setText] = useState(question || '');
  const [sending, setSending] = useState(false);

  const submit = () => {
    const v = text.trim();
    if (!v || sending) return;
    setSending(true);
    onSubmit(v);
    setSending(false);
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
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="כתוב את השאלה שלך..."
          className="w-full bg-[#F8F7F4] border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#25D366] resize-none"
          style={{ direction: 'rtl' }}
        />
        <button
          onClick={submit}
          disabled={!text.trim() || sending}
          className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send size={14} /> {sending ? 'שולח...' : 'שלח לבעל הצימר'}
        </button>
      </div>
    </div>
  );
}