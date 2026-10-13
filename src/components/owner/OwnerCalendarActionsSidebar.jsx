import React, { useState, useRef } from 'react';
import { api } from '@/api/client';
import { Loader2 } from 'lucide-react';
import BlockDateForm from '@/components/owner/BlockDateForm';
import PriceUpdateForm from '@/components/owner/PriceUpdateForm';
import CalendarAiSuggestions from '@/components/owner/CalendarAiSuggestions';
import MicButton from '@/components/chat/MicButton';
import { useDayPriceAdvice } from '@/components/owner/CalendarDayAiSummary';
import { effectivePricePerNight } from '@/lib/bookingPrice';
import { monthOccupancy, freeNightsLeft } from '@/lib/occupancy';
import iconPlus from '@/assets/owner/home/icon-plus.svg';
import iconSendYellow from '@/assets/owner/calendar/send-yellow.svg';
import iconMic from '@/assets/owner/home/icon-mic.svg';
import iconCollapse from '@/assets/owner/today/collapse.svg';
import iconExpand from '@/assets/owner/calendar/expand.svg';
import iconPillAdd from '@/assets/owner/calendar/pill-add.svg';
import iconPillBlock from '@/assets/owner/calendar/pill-block.svg';
import iconPillPrice from '@/assets/owner/calendar/pill-price.svg';
import iconCloseDay from '@/assets/owner/properties/icon-close-sidebar.svg';
import iconDateTab from '@/assets/owner/calendar/date-tab.svg';
import iconTag from '@/assets/owner/calendar/pill-price.svg';
import iconChevron from '@/assets/owner/bookings/sidebar-chevron.svg';

const INK = '#0B3838';
const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const shekel = (n) => `₪${Math.round(Number(n)).toLocaleString('he-IL')}`;

const PILLS = [
  { id: 'booking', label: 'הוספת הזמנה', icon: iconPillAdd, w: 19, h: 19 },
  { id: 'block', label: 'חסימת תאריך', icon: iconPillBlock, w: 19, h: 19 },
  { id: 'price', label: 'עדכון מחיר', icon: iconPillPrice, w: 18, h: 18 },
];

function DotLabel({ children, style }) {
  return (
    <div className="flex items-center justify-center" style={{ gap: 9, ...style }}>
      <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: INK, opacity: 0.6 }} />
      <p className="font-simpler" style={{ color: INK, fontSize: 16, fontWeight: 400, lineHeight: 'normal' }}>{children}</p>
      <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: INK, opacity: 0.6 }} />
    </div>
  );
}

/* Figma 1776:18460 — date tab card (calendar icon with the day number) */
function DateTab({ iso }) {
  const d = new Date(`${iso}T00:00:00`);
  return (
    <div
      className="mx-auto flex flex-col items-center justify-center"
      style={{ width: 107.3, height: 96.2, background: '#fff', borderRadius: 23, boxShadow: '0px 4px 21.1px rgba(0,0,0,0.1)', marginTop: 12, gap: 2 }}
    >
      <span className="relative block" style={{ width: 39, height: 44 }}>
        <img src={iconDateTab} alt="" width={39} height={44} className="block" />
        <span className="absolute inset-x-0 font-simpler text-center" style={{ top: 13, color: INK, fontSize: 17, fontWeight: 600, lineHeight: '24px' }}>
          {d.getDate()}
        </span>
      </span>
      <span className="font-simona" style={{ color: INK, fontSize: 11.1, lineHeight: 'normal' }}>{HEB_MONTHS[d.getMonth()]}</span>
    </div>
  );
}

function CardCta({ label, onClick, busy }) {
  return (
    <div className="w-full flex flex-col items-center" style={{ gap: 12, paddingTop: 6 }}>
      <div className="w-full" style={{ height: 1, background: 'rgba(0,0,0,0.17)' }} />
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="w-full flex items-center justify-between transition-opacity hover:opacity-80 disabled:opacity-60"
        style={{ maxWidth: 308 }}
      >
        <span className="flex items-center" style={{ gap: 12 }}>
          <span className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 29, background: '#fff', borderRadius: 7 }}>
            {busy ? <Loader2 size={14} className="animate-spin" style={{ color: INK }} /> : <img src={iconTag} alt="" width={15} height={15} className="block" />}
          </span>
          <span className="font-simona" style={{ color: INK, fontSize: 18, fontWeight: 500 }}>{label}</span>
        </span>
        <img src={iconChevron} alt="" width={8} height={14} className="block flex-shrink-0" />
      </button>
    </div>
  );
}

/* Figma 1776:18460 — recommended price for the selected night */
function DayPriceCard({ iso, zimmers, bookings, zimmerFilter, onUpdatePrice }) {
  const scope = zimmerFilter && zimmerFilter !== 'all' ? zimmers.filter((z) => z.id === zimmerFilter) : zimmers;
  const { loading, data, error, retry } = useDayPriceAdvice(iso, scope, bookings);
  const d = new Date(`${iso}T00:00:00`);
  const recs = data?.recommendations || [];
  const rec = recs.find((r) => scope.some((z) => z.name === r.zimmer_name)) || recs[0];
  const zimmer = scope.find((z) => z.name === rec?.zimmer_name) || scope[0];
  const current = zimmer ? effectivePricePerNight(zimmer, iso) : null;
  const recommended = Number(rec?.recommended_price) || null;

  let title = 'בודקת את המחיר המומלץ…';
  if (error) title = 'לא הצלחתי לבדוק את המחיר';
  else if (recommended && current) {
    title = recommended > current ? 'אפשר להרוויח יותר מהלילה הזה' : recommended < current ? 'כדאי לשקול מחיר נמוך יותר' : 'המחיר הנוכחי מתאים';
  }

  return (
    <div className="w-full flex flex-col items-center" style={{ background: '#FAFAFA', borderRadius: 23, padding: '32px 18px 22px', gap: 24 }}>
      <div className="flex flex-col text-right" style={{ width: '100%', maxWidth: 266, gap: 7, color: INK }}>
        <p className="font-simona" style={{ fontSize: 17, lineHeight: 'normal' }}>{d.getDate()} ב{HEB_MONTHS[d.getMonth()]}{zimmer && scope.length > 1 ? ` · ${zimmer.name}` : ''}</p>
        <p className="font-simpler" style={{ fontSize: 22, fontWeight: 600, lineHeight: 'normal' }}>{title}</p>
        {!loading && (rec?.reason || data?.summary) && (
          <p className="font-simona" style={{ fontSize: 14, lineHeight: 'normal' }}>{rec?.reason || data?.summary}</p>
        )}
      </div>
      {recommended && (
        <div className="flex flex-col items-center justify-center text-center" style={{ width: '100%', maxWidth: 243, minHeight: 132, background: '#AAEFFD', borderRadius: 19, padding: '14px 12px' }}>
          <span className="font-simona" style={{ color: '#464646', fontSize: 18, fontWeight: 500, lineHeight: 'normal' }}>מחיר מומלץ</span>
          <span className="font-simona" style={{ color: INK, fontSize: 38.5, fontWeight: 500, lineHeight: 'normal' }}>{shekel(recommended)}</span>
          {current ? <span className="font-simona" style={{ color: '#464646', fontSize: 16, lineHeight: 'normal' }}>{shekel(current)} מחיר נוכחי</span> : null}
        </div>
      )}
      {error ? (
        <CardCta label="לנסות שוב" onClick={retry} />
      ) : (
        <CardCta
          label={recommended ? `עדכן ל־${shekel(recommended)}` : 'בודקת…'}
          busy={loading}
          onClick={() => onUpdatePrice?.(zimmer?.id || '', recommended)}
        />
      )}
    </div>
  );
}

const SECTIONS = [
  { id: 'block', title: 'חסימת תאריך', desc: 'סגירת יום או טווח תאריכים שלא יהיו זמינים להזמנה.\nמתאים לתחזוקה, שימוש פרטי, חופשה או כל סיבה אחרת.' },
  { id: 'price', title: 'עדכון מחיר', desc: 'שינוי מחיר ליום מסוים או לטווח תאריכים. אפשר לקבוע מחיר חדש, להעלות באחוזים או להוריד לפי צורך.' },
  { id: 'booking', title: 'הוספת הזמנה', desc: 'יצירת הזמנה ידנית ביומן. מתאים להזמנה שנסגרה מחוץ למערכת, בטלפון או מול בעל הצימר ישירות.' },
  { id: 'ai', title: 'הצעות AI', desc: 'קבלת הצעות חכמות לשיפור היומן. למשל: עדכון מחיר, פתיחת זמינות, הנחה לתאריך פנוי או בדיקת תקופה מבוקשת.' },
];

export default function OwnerCalendarActionsSidebar({
  ownerId, zimmers, bookings, selectedDate, onRefresh, onOpenManual, onZimmerSaved, command, onCommandConsumed, monthLabel,
  showPills = false, monthDate, zimmerFilter = 'all', daySelected = false, onCloseDay,
}) {
  const [open, setOpen] = useState(null);
  const [expanded, setExpanded] = useState(false);
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

  const openSection = SECTIONS.find((s) => s.id === open && s.id !== 'ai');

  const scopedZimmers = zimmerFilter !== 'all' ? zimmers.filter((z) => z.id === zimmerFilter) : zimmers;
  const scopedBookings = zimmerFilter !== 'all' ? bookings.filter((b) => b.zimmer_id === zimmerFilter) : bookings;

  const monthStat = (() => {
    if (!monthDate || !scopedZimmers.length) return null;
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const pct = monthOccupancy(scopedBookings, scopedZimmers.length, y, m);
    const now = new Date();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    let sub = '';
    if (last >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      const from = first > now ? first : now;
      const iso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
      const free = freeNightsLeft(scopedBookings, scopedZimmers.map((z) => z.id), iso);
      sub = free === 0 ? 'כל הלילות החודש תפוסים' : free === 1 ? 'נשאר לילה פנוי אחד החודש' : `נשארו ${free} לילות פנויים החודש`;
    }
    return { label: 'תפוסה החודש', value: `${pct}%`, sub };
  })();

  const dayStatus = (() => {
    if (!selectedDate || !scopedZimmers.length) return '';
    const on = scopedBookings.filter((b) => b.check_in <= selectedDate && b.check_out > selectedDate);
    const taken = new Set(on.map((b) => b.zimmer_id));
    const blocked = on.length > 0 && on.every((b) => b.is_block || b.status === 'חסום');
    if (taken.size === 0) return 'התאריך הזה פנוי';
    if (taken.size >= scopedZimmers.length) return blocked ? 'התאריך הזה חסום' : 'התאריך הזה תפוס';
    return `${scopedZimmers.length - taken.size} מתוך ${scopedZimmers.length} נכסים פנויים`;
  })();

  const showDay = daySelected && !!selectedDate;

  return (
    <div dir="rtl" className="relative h-full flex flex-col font-simona" style={{ background: '#FFFFFF' }}>
      {showDay && (
        <button
          type="button"
          onClick={onCloseDay}
          aria-label="חזרה לתמונת מצב"
          className="absolute z-10 transition-opacity hover:opacity-80"
          style={{ left: 41, top: 26.8 }}
        >
          <img src={iconCloseDay} alt="" width={29} height={29} className="block" style={{ width: 28.9, height: 28.9 }} />
        </button>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto owner-hide-scrollbar" style={{ paddingLeft: 45, paddingRight: 42 }}>
        {showDay ? (
          <>
            <DateTab iso={selectedDate} />
            <DotLabel style={{ marginTop: 21 }}>{dayStatus}</DotLabel>
          </>
        ) : (
          <>
            {/* Figma 1776:18960 — snapshot tab */}
            <div
              className="mx-auto flex flex-col items-center justify-center text-center"
              style={{ width: 182, height: 86.6, background: '#fff', borderRadius: '0 0 23px 23px', boxShadow: '0px 4px 21.1px rgba(0,0,0,0.07)' }}
            >
              <p className="font-simpler" style={{ color: INK, fontSize: 16.95, fontWeight: 600, lineHeight: 'normal' }}>תמונת מצב</p>
              <p className="font-simona" style={{ color: INK, fontSize: 15.09, lineHeight: 'normal' }}>{monthLabel ? `ל${monthLabel}` : ''}</p>
            </div>

            {/* Figma 1776:18966 — • הצעות של Travvin • */}
            <DotLabel style={{ marginTop: 21 }}>הצעות של Travvin</DotLabel>
          </>
        )}

        <div className="mx-auto" style={{ marginTop: 16, width: '100%', maxWidth: 344 }}>
          {openSection ? (
            <div className="flex flex-col" style={{ background: '#FAFAFA', borderRadius: 23, padding: '28px 20px 22px', gap: 16 }}>
              <div className="flex items-center justify-between">
                <p className="font-simpler" style={{ color: '#0B3838', fontSize: 22, fontWeight: 600, lineHeight: 'normal' }}>{openSection.title}</p>
                <button type="button" onClick={() => setOpen(null)} aria-label="סגירה" className="flex-shrink-0 transition-opacity hover:opacity-70">
                  <img src={iconCollapse} alt="" width={29} height={29} className="block" />
                </button>
              </div>
              {open === 'block' && (
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
              {open === 'price' && (
                <PriceUpdateForm
                  key={(pricePrefill.range?.start || '') + pricePrefill.zimmerId}
                  zimmers={zimmers}
                  initialZimmerId={pricePrefill.zimmerId}
                  initialRange={pricePrefill.range}
                  onSaved={() => { onRefresh(); onZimmerSaved?.(); }}
                  onDone={() => setOpen(null)}
                />
              )}
              {open === 'booking' && (
                <button
                  onClick={() => onOpenManual?.(selectedDate)}
                  type="button"
                  className="font-simona w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] transition-all hover:opacity-90"
                  style={{ background: '#0B3838', color: '#fff', fontSize: 14, fontWeight: 500 }}
                >
                  פתח טופס הוספת הזמנה
                </button>
              )}
            </div>
          ) : showDay ? (
            <DayPriceCard
              iso={selectedDate}
              zimmers={zimmers}
              bookings={bookings}
              zimmerFilter={zimmerFilter}
              onUpdatePrice={(zimmerId) => {
                setPricePrefill({ zimmerId, range: { start: selectedDate, end: selectedDate } });
                setOpen('price');
              }}
            />
          ) : (
            <CalendarAiSuggestions variant="card" expanded={expanded} ownerId={ownerId} zimmers={zimmers} bookings={bookings} onApply={applyAiSuggestion} stat={monthStat} />
          )}
        </div>

        {/* Figma 1776:19044 — Expand */}
        {!openSection && !showDay && (
          <div className="flex justify-center" style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="relative transition-opacity hover:opacity-80"
              style={{ width: 85.2, height: 28.9 }}
            >
              <img src={iconExpand} alt="" width={86} height={29} className="absolute inset-0 block" />
              <span className="absolute font-simona" style={{ right: 7.3, top: 6, color: '#0B3838', fontSize: 13, lineHeight: 'normal' }} dir="ltr">Expand</span>
            </button>
          </div>
        )}
      </div>

      {/* Figma 1776:18992 — ai-input-bar */}
      <div className="flex-shrink-0" style={{ padding: '16px 42px 24px 45px' }}>
        {aiError && <p className="font-simona text-xs mb-1.5 text-red-500">{aiError}</p>}
        <div
          className="flex flex-col justify-center bg-white"
          style={{ minHeight: 86, gap: 14, padding: '12px 16px', border: '1px solid #E5E5E5', borderRadius: 23, filter: 'drop-shadow(0px 4px 10.55px rgba(0,0,0,0.07))' }}
        >
          <input
            ref={inputRef}
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); classifyAndRoute(); } }}
            placeholder="שאלי אותי על התאריך הזה..."
            aria-label="שאלי אותי על התאריך הזה"
            className="font-simona w-full bg-transparent outline-none text-right placeholder:text-[#0B3838]"
            style={{ color: '#0B3838', fontSize: 17, fontWeight: 400 }}
          />
          <div className="flex items-center justify-between" dir="ltr">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={classifyAndRoute}
                disabled={aiBusy || !aiText.trim()}
                className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: INK }}
                title="שלח"
                aria-label="שלח"
              >
                {aiBusy
                  ? <Loader2 size={14} className="animate-spin text-white" />
                  : <img src={iconSendYellow} alt="" width={29} height={29} className="block" />}
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

      {/* Figma 1776:18938 — quick-action pills floating past the divider */}
      {showPills && (
        <div className="hidden lg:flex flex-col absolute z-20" style={{ left: 'calc(100% + 23px)', top: 'min(605px, calc(100% - 210px))', gap: 13 }}>
          {PILLS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => (p.id === 'booking' ? onOpenManual?.(selectedDate) : toggle(p.id))}
              aria-pressed={open === p.id}
              className="self-end flex items-center bg-white transition-transform hover:scale-[1.02]"
              style={{ height: 56.4, borderRadius: 28.2, boxShadow: '0px 4px 15.9px rgba(0,0,0,0.25)', padding: '0 20.5px 0 24px', gap: 14 }}
            >
              <img src={p.icon} alt="" width={p.w} height={p.h} className="block flex-shrink-0" />
              <span className="font-simona whitespace-nowrap" style={{ color: INK, fontSize: 16, lineHeight: 'normal' }}>{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

