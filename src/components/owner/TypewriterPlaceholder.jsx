import React, { useState, useEffect, useRef } from 'react';

const SENTENCES = [
  'תרשום לי מהר הזמנה חדשה לצימר בסוף השבוע!',
  'סגור לי את היומן לתחזוקה באמצע השבוע',
  'עדכן מחיר מפנק לסופ"ש הקרוב בסוויטה',
  'כמה כסף נכנס לנו מההזמנות של השבוע?',
  'תארגן לי הודעת תזכורת חמודה לאורחים שמגיעים מחר',
];

// Fast typewriter speed (ms per char)
const CHAR_MS = 38;
const HOLD_MS = 1400;
const ERASE_MS = 18;

export default function TypewriterPlaceholder({ active }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('typing'); // typing | holding | erasing
  const timer = useRef(null);

  useEffect(() => {
    if (!active) { setText(''); setIdx(0); setPhase('typing'); return; }
    let cancelled = false;

    const schedule = (fn, ms) => {
      timer.current = setTimeout(() => { if (!cancelled) fn(); }, ms);
    };

    if (phase === 'typing') {
      const full = SENTENCES[idx];
      if (text.length < full.length) {
        schedule(() => setText(full.slice(0, text.length + 1)), CHAR_MS);
      } else {
        schedule(() => setPhase('holding'), HOLD_MS);
      }
    } else if (phase === 'holding') {
      schedule(() => setPhase('erasing'), 200);
    } else if (phase === 'erasing') {
      if (text.length > 0) {
        schedule(() => setText(text.slice(0, text.length - 1)), ERASE_MS);
      } else {
        setIdx((i) => (i + 1) % SENTENCES.length);
        setPhase('typing');
      }
    }

    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, [text, phase, idx, active]);

  if (!active || !text) return null;

  return (
    <span
      dir="rtl"
      className="pointer-events-none select-none truncate"
      style={{
        background: 'linear-gradient(90deg, #F97316 0%, #7C3AED 100%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  );
}