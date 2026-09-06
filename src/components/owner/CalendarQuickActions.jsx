import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, PlusCircle, Ban, Tag, Command, ChevronDown } from 'lucide-react';
import CalendarDayAiSummary from '@/components/owner/CalendarDayAiSummary';

const MENU_WIDTH = 248;

/**
 * Floating "פעולות מהירות" menu that appears next to the day popover in the
 * OwnerCalendar. The top "הצעות AI" block expands a concise date-specific
 * price summary inline (does NOT open the personal assistant). The footer
 * "פתח עם AI" opens the main assistant chat with the day's context.
 */
export default function CalendarQuickActions({ iso, zimmers, bookings, anchorRect, popoverLeft, onClose, onAction }) {
  const [aiOpen, setAiOpen] = useState(false);

  // Place to the left of the day popover when there's room, else to the right.
  let left = popoverLeft - MENU_WIDTH - 8;
  if (left < 12) left = popoverLeft + 320 + 8;
  if (left + MENU_WIDTH > window.innerWidth - 12) left = window.innerWidth - MENU_WIDTH - 12;
  if (left < 12) left = 12;
  const top = anchorRect ? Math.min(anchorRect.top, window.innerHeight - 380) : 100;

  const actions = [
    { id: 'booking', label: 'הוספת הזמנה', icon: PlusCircle },
    { id: 'block', label: 'חסימת תאריך', icon: Ban },
    { id: 'price', label: 'עדכון מחירים', icon: Tag },
  ];

  return (
    <motion.div
      dir="rtl"
      initial={{ opacity: 0, scale: 0.92, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="fixed z-[55]"
      style={{ left, top, width: MENU_WIDTH, fontFamily: 'Heebo, sans-serif' }}
    >
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #EFEDE7', boxShadow: '0 12px 40px rgba(6,35,25,0.16)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-3">
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100" style={{ color: '#062319' }} aria-label="סגור">
            <X size={16} />
          </button>
          <h3 className="text-sm font-bold" style={{ color: '#062319' }}>פעולות מהירות</h3>
        </div>

        {/* AI suggestion block — expands inline summary (no chat) */}
        <button
          onClick={() => setAiOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3.5 py-3 text-right transition-colors hover:bg-gray-50"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'radial-gradient(circle at 30% 30%, #FBBF24 0%, #F472B6 45%, #8B5CF6 100%)' }}>
            <Sparkles size={18} style={{ color: '#fff' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: '#062319' }}>הצעות AI</p>
            <p className="text-[11px] mt-0.5" style={{ color: '#6B7280' }}>מבוסס על נתוני השוק</p>
          </div>
          <ChevronDown size={15} style={{ color: '#9CA3AF', transform: aiOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divider */}
        <div style={{ height: 1, background: '#F0EEE8' }} />

        {/* Action list */}
        <div className="py-1.5">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => onAction(a.id)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-right transition-colors hover:bg-gray-50"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#F4F2EE' }}>
                  <Icon size={15} style={{ color: '#062319' }} />
                </div>
                <span className="flex-1 text-sm font-medium" style={{ color: '#062319' }}>{a.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer — opens the main assistant chat */}
        <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderTop: '1px solid #F0EEE8', background: '#FAFAF8' }}>
          <button onClick={() => onAction('ai')} className="inline-flex items-center gap-1.5 text-xs font-bold transition-opacity hover:opacity-80" style={{ color: '#062319' }}>
            פתח עם AI <Sparkles size={13} />
          </button>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: '#F4F2EE', color: '#9CA3AF' }}>
            <Command size={11} />K
          </span>
        </div>
      </div>
    </motion.div>
  );
}