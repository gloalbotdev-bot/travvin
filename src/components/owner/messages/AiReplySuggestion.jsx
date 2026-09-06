import React, { useState } from 'react';
import { api } from '@/api/client';
import { Sparkles, Plus, X, Check } from 'lucide-react';

// "רוצה שאנוש תשובה?" block. Generates a reply via the LLM using the
// caller's buildPrompt(), then lets the owner insert it into their input.
// IMPORTANT: scope to a single thread/question by passing a key={id} from
// the parent so the component remounts (and resets its state) on switch.
export default function AiReplySuggestion({ contextLabel, buildPrompt, onApply, disabled }) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [err, setErr] = useState('');

  const generate = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await api.integrations.Core.InvokeLLM({
        prompt: buildPrompt(),
        response_json_schema: { type: 'object', properties: { reply: { type: 'string' } } },
      });
      const text = (res && (res.reply || res.message)) || (typeof res === 'string' ? res : '');
      if (!text) { setErr('לא הצלחתי לייצר תשובה כרגע'); }
      else { setSuggestion(text); }
    } catch {
      setErr('שגיאה בייצור תשובה. נסה שוב.');
    }
    setLoading(false);
  };

  return (
    <div className="px-3 pb-2">
      {/* Collapsed trigger bar */}
      <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: '#eef0ff' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fff' }}>
          <Sparkles size={18} style={{ color: '#4338ca' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: '#4338ca' }}>רוצה שאנסח תשובה?</p>
          {contextLabel && <p className="text-xs truncate" style={{ color: '#6366f1' }}>{contextLabel}</p>}
        </div>
        <button onClick={generate} disabled={disabled || loading} title="ייצר תשובה"
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-50"
          style={{ background: '#4338ca', color: '#fff' }}>
          {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Plus size={18} />}
        </button>
      </div>

      {err && <p className="text-xs mt-1.5 px-1" style={{ color: '#ef4444' }}>{err}</p>}

      {/* Expanded suggestion card */}
      {suggestion && (
        <div className="mt-2 rounded-2xl p-3" style={{ background: '#fff', border: '1px solid #e0e0e0' }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold" style={{ color: '#0f172a' }}>הצעת תשובה</p>
            <button onClick={() => setSuggestion('')} className="text-gray-400 hover:text-gray-600" title="סגור"><X size={14} /></button>
          </div>
          <p className="text-sm whitespace-pre-wrap mb-3" style={{ color: '#334155' }}>{suggestion}</p>
          <div className="flex justify-start">
            <button onClick={() => { onApply(suggestion); setSuggestion(''); }}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl text-white"
              style={{ background: '#4338ca' }}>
              <Check size={16} /> הוסף לתיבה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}