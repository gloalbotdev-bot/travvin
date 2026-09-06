import React, { useState, useRef } from 'react';
import { api } from '@/api/client';
import { ChevronDown, Sparkles, CalendarClock, Tag, Plus, Wand2, Send, Loader2, ArrowUp, Mic } from 'lucide-react';
import BlockDateForm from '@/components/owner/BlockDateForm';
import PriceUpdateForm from '@/components/owner/PriceUpdateForm';
import CalendarAiSuggestions from '@/components/owner/CalendarAiSuggestions';

const SECTIONS = [
  { id: 'block', title: 'חסימת תאריך', icon: CalendarClock, desc: 'סגירת יום או טווח תאריכים שלא יהיו זמינים להזמנה. מתאים לתחזוקה, שימוש פרטי, חופשה או כל סיבה אחרת.' },
  { id: 'price', title: 'עדכון מחיר', icon: Tag, desc: 'שינוי מחיר ליום מסוים או לטווח תאריכים. אפשר לקבוע מחיר חדש, להעלות באחוזים או להוריד לפי צורך.' },
  { id: 'booking', title: 'הוספת הזמנה', icon: Plus, desc: 'יצירת הזמנה ידנית ביומן. מתאים להזמנה שנסגרה מחוץ למערכת, בטלפון או מול בעל הצימר ישירות.' },
  { id: 'ai', title: 'הצעות AI', icon: Wand2, desc: 'קבלת הצעות חכמות לשיפור היומן. למשל: עדכון מחיר, פתיחת זמינות, הנחה לתאריך פנוי או בדיקת תקופה מבוקשת.' },
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
    } catch (e) {
      setAiError('שגיאה. נסה לנסח אחרת.');
    }
    setAiBusy(false);
  };

  return (
    <div dir="rtl" className="h-full flex flex-col" style={{ background: '#f9f9f9', fontFamily: 'Heebo, sans-serif' }}>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.1)' }}>
            <Sparkles size={18} style={{ color: '#F97316' }} />
          </div>
          <h2 className="font-black text-lg" style={{ color: '#1A1A1A' }}>פעולות</h2>
        </div>

        <div className="space-y-2.5">
          {SECTIONS.map(s => {
            const isOpen = open === s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <button onClick={() => toggle(s.id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-right transition-all hover:bg-gray-50">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F8F7F4' }}>
                    <Icon size={16} style={{ color: '#1A1A1A' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: '#1A1A1A' }}>{s.title}</p>
                    {!isOpen && <p className="text-xs mt-0.5 line-clamp-2 leading-snug" style={{ color: '#9CA3AF' }}>{s.desc}</p>}
                  </div>
                  <ChevronDown size={16} style={{ color: '#9CA3AF', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1">
                    <p className="text-xs mb-3 leading-snug" style={{ color: '#6B7280' }}>{s.desc}</p>
                    {s.id === 'block' && (
                      <BlockDateForm key={blockPrefill.date + blockPrefill.zimmerId} zimmers={zimmers} ownerId={ownerId}
                        initialDate={blockPrefill.date} initialZimmerId={blockPrefill.zimmerId}
                        onSaved={onRefresh} onDone={() => setOpen(null)} />
                    )}
                    {s.id === 'price' && (
                      <PriceUpdateForm key={(pricePrefill.range?.start || '') + pricePrefill.zimmerId} zimmers={zimmers}
                        initialZimmerId={pricePrefill.zimmerId} initialRange={pricePrefill.range}
                        onSaved={() => { onRefresh(); onZimmerSaved?.(); }} onDone={() => setOpen(null)} />
                    )}
                    {s.id === 'booking' && (
                      <button onClick={() => onOpenManual?.(selectedDate)} type="button"
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-bold transition-all hover:opacity-90" style={{ background: '#F97316' }}>
                        <Plus size={15} /> פתח טופס הוספת הזמנה
                      </button>
                    )}
                    {s.id === 'ai' && (
                      <CalendarAiSuggestions ownerId={ownerId} zimmers={zimmers} bookings={bookings} onApply={applyAiSuggestion} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom assistant input */}
      <div className="px-4 py-3" style={{ borderTop: '1.5px solid #F0EEE8', background: '#fff' }}>
        {aiError && <p className="text-xs mb-1.5 text-red-500">{aiError}</p>}
        <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0' }}>
          <input ref={inputRef} value={aiText} onChange={e => setAiText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); classifyAndRoute(); } }}
            placeholder="מה תרצי לשנות או לבדוק בצימר?"
            className="flex-1 bg-transparent outline-none text-sm" style={{ color: '#1A1A1A' }} />
          <button type="button" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#9CA3AF' }}><ArrowUp size={15} /></button>
          <button type="button" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#9CA3AF' }}><Mic size={15} /></button>
          <button onClick={classifyAndRoute} disabled={aiBusy || !aiText.trim()} type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-40" style={{ background: '#F97316' }}>
            {aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}