import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { api } from '@/api/client';
import aiSpark from '@/assets/owner/messages/ai-spark.svg';
import iconChevron from '@/assets/owner/messages/icon-chevron.svg';

// "תשובה מוצעת לאורח" block. Generates a reply via the LLM using the caller's
// buildPrompt(); the action button hands the text to onApply (it never sends).
// Auto mode: pass autoKey — a new truthy key triggers generation, null hides the block.
// Manual mode: omit autoKey — the owner asks for a draft with a button.
// IMPORTANT: scope to a single thread/question by passing a key={id} from
// the parent so the component remounts (and resets its state) on switch.
export default function AiReplySuggestion({ buildPrompt, onApply, disabled, autoKey, title = 'תשובה מוצעת לאורח', actionLabel = 'שליחה' }) {
  const auto = autoKey !== undefined;
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [err, setErr] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const reduceMotion = useReducedMotion();
  const reqId = useRef(0);

  const generate = async () => {
    const id = ++reqId.current;
    setLoading(true);
    setErr('');
    setSuggestion('');
    try {
      const res = await api.integrations.Core.InvokeLLM({
        prompt: buildPrompt(),
        response_json_schema: { type: 'object', properties: { reply: { type: 'string' } } },
      });
      if (id !== reqId.current) return;
      const text = (res && (res.reply || res.message)) || (typeof res === 'string' ? res : '');
      if (!text) setErr('לא הצלחתי לייצר תשובה כרגע');
      else setSuggestion(text);
    } catch {
      if (id !== reqId.current) return;
      setErr('שגיאה בייצור תשובה. נסה שוב.');
    }
    setLoading(false);
  };

  const lastAutoKey = useRef(null);
  useEffect(() => {
    if (!auto || lastAutoKey.current === autoKey) return;
    lastAutoKey.current = autoKey;
    if (!autoKey) { reqId.current++; setSuggestion(''); setErr(''); setLoading(false); return; }
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  if (auto && !autoKey) return null;

  const showCard = !collapsed && (loading || suggestion || err || !auto);

  return (
    <div className="font-simona flex flex-col gap-[2px] w-full" dir="rtl">
      <div className="flex h-[46px] items-center justify-between px-[10px] rounded-[31px]">
        <div className="flex items-center gap-[10px]">
          <motion.img
            src={aiSpark} alt="" width={25} height={24} className="block flex-shrink-0"
            initial={{ rotate: -0.632 }}
            animate={reduceMotion ? { rotate: -0.632 } : { rotate: [-0.632, 359.368] }}
            transition={{ rotate: { duration: 2, times: [0, 1], ease: [0.5, 0, 0.1, 1], repeat: Infinity } }}
          />
          <p className="text-[17px] leading-normal" style={{ color: '#0B3838', fontWeight: 500 }}>{title}</p>
        </div>
        <button type="button" onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'הצג תשובה מוצעת' : 'הסתר תשובה מוצעת'} aria-expanded={!collapsed}
          className="w-[24px] h-[24px] flex items-center justify-center rounded-full">
          <img src={iconChevron} alt="" width={12} height={8} className="block transition-transform" style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }} />
        </button>
      </div>

      {showCard && (
        <div className="flex min-h-[87px] items-center justify-between gap-4 rounded-[23px] pl-[34px] pr-[43px] py-[12px]" style={{ background: '#FAFAFA' }}>
          <div className="flex-1 min-w-0 max-w-[553px]">
            {loading ? (
              <p className="text-[18px] leading-normal animate-pulse" style={{ color: '#6B7280' }} role="status">מנסח תשובה…</p>
            ) : err ? (
              <p className="text-[15px] leading-normal" style={{ color: '#B91C1C' }} role="alert">{err}</p>
            ) : suggestion ? (
              <p className="text-[18px] leading-normal whitespace-pre-wrap" style={{ color: '#0B3838' }}>{suggestion}</p>
            ) : (
              <p className="text-[15px] leading-normal" style={{ color: '#6B7280' }}>ניסוח תשובה לפי פרטי הנכס</p>
            )}
          </div>
          {suggestion && !loading ? (
            <ActionButton disabled={disabled} onClick={() => { onApply(suggestion); setSuggestion(''); }}>{actionLabel}</ActionButton>
          ) : !loading && (err || !auto) ? (
            <ActionButton disabled={disabled} onClick={generate}>{err ? 'נסה שוב' : 'ניסוח'}</ActionButton>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ActionButton({ onClick, disabled, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="font-simona flex-shrink-0 rounded-full px-[18.6px] py-[9.3px] text-[15.12px] leading-normal whitespace-nowrap bg-white/0 hover:bg-white transition-colors disabled:opacity-50"
      style={{ border: '1.163px solid #E5E5E5', color: '#0B3838', fontWeight: 700 }}>
      {children}
    </button>
  );
}
