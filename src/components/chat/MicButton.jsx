import React, { useEffect, useState } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { Mic, Loader2 } from 'lucide-react';

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// tone: 'dark' for dark chats (owner/admin panels), 'light' for customer-facing chats.
export default function MicButton({ onText, disabled, tone = 'light', size = 18 }) {
  const { recording, transcribing, error, elapsedSec, toggle } = useVoiceInput({ onText });
  const [showErr, setShowErr] = useState(false);
  useEffect(() => {
    if (error) { setShowErr(true); const t = setTimeout(() => setShowErr(false), 4000); return () => clearTimeout(t); }
  }, [error]);

  let style;
  if (recording) style = { background: '#EF4444', color: '#fff' };
  else if (transcribing) style = tone === 'dark' ? { background: '#374151', color: '#9CA3AF' } : { background: '#F3F4F6', color: '#9CA3AF' };
  else style = tone === 'dark' ? { background: '#374151', color: '#D1D5DB' } : { background: '#fff', color: '#9CA3AF', border: '1.5px solid #E8E5E0' };

  return (
    <div className="relative flex-shrink-0">
      {showErr && (
        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] bg-red-500 text-white px-2 py-1 rounded-lg shadow z-10">
          {error}
        </div>
      )}
      <button type="button" onClick={toggle} disabled={disabled || transcribing}
        title={recording ? 'עצור הקלטה' : 'הקלט קול'}
        className="w-12 h-12 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
        style={style}>
        {recording
          ? <span className="text-xs font-bold tabular-nums">{fmt(elapsedSec)}</span>
          : transcribing ? <Loader2 size={size} className="animate-spin" />
          : <Mic size={size} />}
      </button>
    </div>
  );
}