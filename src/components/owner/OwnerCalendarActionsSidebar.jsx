import React, { useState, useRef } from 'react';
import { api } from '@/api/client';
import { Loader2 } from 'lucide-react';
import BlockDateForm from '@/components/owner/BlockDateForm';
import PriceUpdateForm from '@/components/owner/PriceUpdateForm';
import CalendarAiSuggestions from '@/components/owner/CalendarAiSuggestions';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';
import MicButton from '@/components/chat/MicButton';
import iconChevron from '@/assets/owner/calendar/chevron-action.svg';
import iconPlus from '@/assets/owner/home/icon-plus.svg';
import iconSend from '@/assets/owner/home/icon-send.svg';
import iconMic from '@/assets/owner/home/icon-mic.svg';

const SECTIONS = [
  { id: 'block', title: 'חסימת תאריך', desc: 'סגירת יום או טווח תאריכים שלא יהיו זמינים להזמנה.\nמתאים לתחזוקה, שימוש פרטי, חופשה או כל סיבה אחרת.' },
  { id: 'price', title: 'עדכון מחיר', desc: 'שינוי מחיר ליום מסוים או לטווח תאריכים. אפשר לקבוע מחיר חדש, להעלות באחוזים או להוריד לפי צורך.' },
  { id: 'booking', title: 'הוספת הזמנה', desc: 'יצירת הזמנה ידנית ביומן. מתאים להזמנה שנסגרה מחוץ למערכת, בטלפון או מול בעל הצימר ישירות.' },
  { id: 'ai', title: 'הצעות AI', desc: 'קבלת הצעות חכמות לשיפור היומן. למשל: עדכון מחיר, פתיחת זמינות, הנחה לתאריך פנוי או בדיקת תקופה מבוקשת.' },
];

export default function OwnerCalendarActionsSidebar({ ownerId, zimmers, bookings, selectedDate, onRefresh, onOpenManual, onZimmerSaved, command, onCommandConsumed }) {
  const [open, setOpen] = useState(null);
  const [blockPrefill, setBlockPrefill] = useState({ date: selectedDate, zimmerId: '' });
  const [pricePrefill, setPricePrefill] = useState({ zimmerId: '', range: null });
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const inputRef = useRef(null);

  // Keep block prefill date in sync with the selected calendar day when the
  // accordion is closed (so opening it reflects the current day).
  React.useEffect(() => {
    if (open !== 'block') setBlockPrefill(p => ({ ...p, date: selectedDate }));
  }, [selectedDate]);

  // Apply external command (from the calendar Quick Actions menu).
  React.useEffect(() => {
    if (!command) return;
    if (command.type === 'block') {
      setBlockPrefill({ date: command.date, zimmerId: command.zimmerId || '' });
      setOpen('block');
    } else if (command.type === 'price') {
      setPricePrefill({ zimmerId: command.zimmerId || '', range: command.range || null });
      setOpen('price');
    }
    onCommandConsumed?.();
  }, [command]);

  const toggle = (id) => setOpen(o => (o === id ? null : id));

  const applyAiSuggestion = (s) => {
    const zimmer = zimmers.find(z => z.name === s.zimmer_name) || zimmers[0];
    if (s.type === 'price_update' || s.type === 'discount') {
      setPricePrefill({ zimmerId: zimmer?.id || '', range: { start: s.start_date, end: s.end_date } });
      setOpen('price');
    } else if (s.type === 'open_availability') {
      setOpen('block');
    } else {
      setOpen('ai');
    }
  };

  const classifyAndRoute = async () => {
    const text = aiText.trim();
    if (!text || aiBusy) return;
    setAiBusy(true); setAiError('');
    try {
      const zimmerList = zimmers.map(z => z.name).join(', ');
      const res = await api.integrations.Core.InvokeLLM({
        prompt: `סווג את בקשת המשתמש לאחת מ-4 פעולות ביומן צימרים וחלץ פרמטרים.\nפעולות: block_date (חסימת תאריך), update_price (עדכון מחיר), add_booking (הוספת הזמנה), ai_suggestion (הצעה/ניתוח כללי).\nנכסים אפשריים: ${zimmerList}.\nתאריך נוכחי: ${selectedDate}\nבקשה: "${text}"\nהחזר JSON בלבד.`,
        response_json_schema: {
          type: 'object',
          properties: {
            intent: { type: 'string', enum: ['block_date', 'update_price', 'add_booking', 'ai_suggestion'] },
            zimmer_name: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
            reason: { type: 'string' },
            price: { type: 'number' },
            mode: { type: 'string', enum: ['absolute', 'increase', 'decrease'] },
          },
        },
      });
      const intent = res?.intent || 'ai_suggestion';
      const zimmer = zimmers.find(z => z.name === res?.zimmer_name) || zimmers[0];
      if (intent === 'block_date') {
        setBlockPrefill({ date: res?.start_date || selectedDate, zimmerId: zimmer?.id || '' });
        setOpen('block');
      } else if (intent === 'update_price') {
        setPricePrefill({ zimmerId: zimmer?.id || '', range: { start: res?.start_date, end: res?.end_date } });
        setOpen('price');
      } else if (intent === 'add_booking') {
        onOpenManual?.(res?.start_date || selectedDate);
      } else {
        setOpen('ai');
      }
      setAiText('');
    } catch {
      setAiError('שגיאה. נסה לנסח אחרת.');
    }
    setAiBusy(false);
  };

  return (
    <div
      dir="rtl"
      className="h-full flex flex-col font-simona"
      style={{ background: '#FFFFFF', borderRadius: 23 }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-10" dir="rtl">
          {/* Figma: AI icon to the RIGHT of «פעולות» */}
          <OwnerAiIcon size={40} />
          <h2
            className="font-simpler"
            style={{ color: '#000', fontSize: 29, fontWeight: 600, lineHeight: 'normal' }}
          >
            פעולות
          </h2>
        </div>

        <div className="flex flex-col" style={{ gap: 19 }}>
          {SECTIONS.map((s) => {
            const isOpen = open === s.id;
            return (
              <div key={s.id} className="relative">
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="w-full text-right transition-opacity hover:opacity-80"
                >
                  <div className="flex items-start gap-3" dir="rtl">
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-simpler"
                        style={{ color: '#000', fontSize: 19, fontWeight: 600, lineHeight: 'normal' }}
                      >
                        {s.title}
                      </p>
                      <p
                        className="font-simona mt-[11px] whitespace-pre-line"
                        style={{ color: '#000', fontSize: 14, fontWeight: 400, lineHeight: '26px' }}
                      >
                        {s.desc}
                      </p>
                    </div>
                    {/* Figma 1011:1019 — chevron on the left, full glyph not clipped */}
                    <span
                      className="flex-shrink-0 mt-1 flex items-center justify-center"
                      style={{
                        width: 12,
                        height: 16,
                        transform: isOpen ? 'rotate(-90deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    >
                      <img src={iconChevron} alt="" width={12} height={16} className="block" style={{ width: 12, height: 16 }} />
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3 pb-2">
                    {s.id === 'block' && (
                      <BlockDateForm
                        key={blockPrefill.date + blockPrefill.zimmerId}
                        zimmers={zimmers}
                        ownerId={ownerId}
                        initialDate={blockPrefill.date}
                        initialZimmerId={blockPrefill.zimmerId}
                        onSaved={onRefresh}
                        onDone={() => setOpen(null)}
                      />
                    )}
                    {s.id === 'price' && (
                      <PriceUpdateForm
                        key={(pricePrefill.range?.start || '') + pricePrefill.zimmerId}
                        zimmers={zimmers}
                        initialZimmerId={pricePrefill.zimmerId}
                        initialRange={pricePrefill.range}
                        onSaved={() => { onRefresh(); onZimmerSaved?.(); }}
                        onDone={() => setOpen(null)}
                      />
                    )}
                    {s.id === 'booking' && (
                      <button
                        onClick={() => onOpenManual?.(selectedDate)}
                        type="button"
                        className="font-simona w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] transition-all hover:opacity-90"
                        style={{ background: '#0B3838', color: '#fff', fontSize: 14, fontWeight: 500 }}
                      >
                        פתח טופס הוספת הזמנה
                      </button>
                    )}
                    {s.id === 'ai' && (
                      <CalendarAiSuggestions ownerId={ownerId} zimmers={zimmers} bookings={bookings} onApply={applyAiSuggestion} />
                    )}
                  </div>
                )}

                <div className="mt-[20px]" style={{ height: 1, background: '#E8E8E8' }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom assistant input — Figma 1011:1201 */}
      <div className="px-6 pb-8 pt-2">
        {aiError && <p className="font-simona text-xs mb-1.5 text-red-500">{aiError}</p>}
        <div
          className="flex flex-col justify-center rounded-[11px] px-4 py-3 bg-white"
          style={{
            minHeight: 86,
            gap: 14,
            border: '1.5px solid #E5E5E5',
          }}
        >
          <input
            ref={inputRef}
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); classifyAndRoute(); } }}
            placeholder="מה תרצי לשנות או לבדוק בצימר?"
            className="font-simona w-full bg-transparent outline-none text-right"
            style={{ color: '#6B7280', fontSize: 17, fontWeight: 400 }}
          />
          <div className="flex items-center justify-between" dir="ltr">
            {/* Figma 1011:1203 — send+mic on the left, plus on the right */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={classifyAndRoute}
                disabled={aiBusy || !aiText.trim()}
                className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: '#0B3838' }}
                title="שלח"
              >
                {aiBusy
                  ? <Loader2 size={14} className="animate-spin text-white" />
                  : <img src={iconSend} alt="" width={8} height={12} className="block" style={{ width: 8, height: 12 }} />}
              </button>
              <MicButton
                tone="ghost"
                compact
                size={14}
                iconWidth={14}
                iconHeight={19}
                iconSrc={iconMic}
                onText={(t) => setAiText((p) => (p ? p.replace(/\s+$/, '') + ' ' + t : t))}
              />
            </div>
            <button
              type="button"
              onClick={() => onOpenManual?.(selectedDate)}
              title="הוספת הזמנה"
              className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105"
              style={{ background: '#E9E9E9' }}
            >
              <span className="overflow-hidden" style={{ width: 12, height: 12 }}>
                <img src={iconPlus} alt="" width={12} height={12} className="block w-full h-full" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
