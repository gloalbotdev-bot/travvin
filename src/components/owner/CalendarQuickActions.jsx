import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CalendarDayAiSummary from '@/components/owner/CalendarDayAiSummary';
import iconClose from '@/assets/owner/calendar/popup-close.svg';
import iconAdd from '@/assets/owner/calendar/popup-add.svg';
import iconBlock from '@/assets/owner/calendar/popup-block.svg';
import iconPrice from '@/assets/owner/calendar/popup-price.svg';
import iconAi from '@/assets/owner/calendar/popup-ai.svg';

const MENU_WIDTH = 320;
const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const INK = '#0B3838';

/**
 * Figma 1776:19720 — "מה תרצי לעשות ב…" popup next to the clicked day.
 * The Travvin row expands a date-specific price summary inline; "פתח עם AI" opens the assistant chat.
 */
export default function CalendarQuickActions({ iso, zimmers, bookings, anchorRect, popoverLeft, popoverTop, onClose, onAction }) {
  const [aiOpen, setAiOpen] = useState(false);

  let left = popoverLeft;
  if (left + MENU_WIDTH > window.innerWidth - 12) left = window.innerWidth - MENU_WIDTH - 12;
  if (left < 12) left = 12;
  const rawTop = popoverTop ?? anchorRect?.top ?? 100;
  const top = Math.max(12, Math.min(rawTop, window.innerHeight - 360));
  const d = new Date(`${iso}T00:00:00`);

  const actions = [
    { id: 'booking', label: 'הוספת הזמנה', icon: iconAdd },
    { id: 'block', label: 'חסימת תאריך', icon: iconBlock },
    { id: 'price', label: 'עדכון מחירים', icon: iconPrice },
  ];

  return (
    <motion.div
      dir="rtl"
      role="dialog"
      aria-label={`פעולות ל-${d.getDate()} ב${HEB_MONTHS[d.getMonth()]}`}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="fixed z-[55] flex flex-col"
      style={{
        left,
        top,
        width: MENU_WIDTH,
        background: '#fff',
        border: '1px solid #EFEFEF',
        borderRadius: 20,
        boxShadow: '0px 12px 32px rgba(0,0,0,0.1)',
        padding: '25px 12px 12px',
        gap: 9,
        maxHeight: 'calc(100dvh - 24px)',
        overflowY: 'auto',
      }}
    >
      <div className="flex items-start justify-between" style={{ padding: '8px 12px' }}>
        <h3 className="font-simpler text-right" style={{ color: INK, fontSize: 16, fontWeight: 600, lineHeight: 1.18, maxWidth: 156 }}>
          מה תרצי לעשות ב-{d.getDate()} ב{HEB_MONTHS[d.getMonth()]}?
        </h3>
        <button type="button" onClick={onClose} className="flex-shrink-0 transition-opacity hover:opacity-80" aria-label="סגור">
          <img src={iconClose} alt="" width={24} height={24} className="block" />
        </button>
      </div>

      <div style={{ height: 1, background: '#EFEFEF' }} />

      <div className="flex flex-col">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onAction(a.id)}
            className="w-full flex items-center text-right transition-colors hover:bg-[#F5F5F5] focus-visible:bg-[#F5F5F5]"
            style={{ height: 44, padding: 12, gap: 12, borderRadius: 12 }}
          >
            <img src={a.icon} alt="" width={20} height={20} className="block flex-shrink-0" />
            <span className="font-simona flex-1" style={{ color: INK, fontSize: 16, lineHeight: 'normal' }}>{a.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setAiOpen((v) => !v)}
        aria-expanded={aiOpen}
        className="w-full flex items-center text-right transition-colors hover:bg-[#F5F5F5] focus-visible:bg-[#F5F5F5]"
        style={{ minHeight: 80, padding: 12, gap: 12, borderRadius: 12 }}
      >
        <img src={iconAi} alt="" width={26} height={27} className="block flex-shrink-0" />
        <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 2 }}>
          <span className="font-simona" style={{ color: INK, fontSize: 16, lineHeight: 'normal' }}>הצעות של Travvin על התאריך הזה</span>
          <span className="font-simona" style={{ color: INK, fontSize: 14, opacity: 0.7, lineHeight: 'normal' }}>מבוסס על נתוני השוק</span>
        </span>
        <span dir="ltr" className="flex-shrink-0" style={{ color: INK, fontSize: 11, fontFamily: 'Manrope, sans-serif' }}>⌘K</span>
      </button>

      <AnimatePresence initial={false}>
        {aiOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <CalendarDayAiSummary iso={iso} zimmers={zimmers} bookings={bookings} />
            <button
              type="button"
              onClick={() => onAction('ai')}
              className="font-simona underline transition-opacity hover:opacity-70"
              style={{ color: INK, fontSize: 14, padding: '4px 12px 8px' }}
            >
              פתח עם AI
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
