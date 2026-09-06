import React, { useState } from 'react';

// Two toggle switches (local UI state — visual only, matches Figma).
export default function AiToggles() {
  const [missingInfo, setMissingInfo] = useState(false);
  const [autoGuestMsgs, setAutoGuestMsgs] = useState(true);

  const Toggle = ({ on, onChange, label, hint }) => (
    <div className="flex items-center justify-between py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium" style={{ color: '#212121' }}>{label}</div>
        {hint && <div className="text-xs" style={{ color: '#9e9e9e' }}>{hint}</div>}
      </div>
      <button onClick={() => onChange(!on)}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: on ? '#E53935' : '#ECEFF1' }}>
        <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
          style={on ? { right: '0.125rem' } : { right: '2.125rem' }} />
      </button>
    </div>
  );

  return (
    <div className="px-1">
      <Toggle on={missingInfo} onChange={setMissingInfo} label="בדיקת מידע חסר" />
      <Toggle on={autoGuestMsgs} onChange={setAutoGuestMsgs} label="הודעות אוטומטיות לאורחים" />
    </div>
  );
}