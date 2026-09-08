import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/api/client';
import { Sliders } from 'lucide-react';
import ManualBookingForm from '@/components/owner/ManualBookingForm';
import OwnerCalendarActionsSidebar from '@/components/owner/OwnerCalendarActionsSidebar';
import CalendarDayPopover from '@/components/owner/CalendarDayPopover';
import CalendarQuickActions from '@/components/owner/CalendarQuickActions';
import CalendarReservationBar from '@/components/owner/CalendarReservationBar';
import iconChevron from '@/assets/owner/home/icon-chevron.svg';
import chevronMonth from '@/assets/owner/calendar/chevron-month.svg';
import underlineToday from '@/assets/owner/calendar/underline-today.svg';

const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const HEB_DAYS = ['יום א’', 'יום ב’', 'יום ג’', 'יום ד’', 'יום ה’', 'יום ו’', 'שבת'];
const HEB_DAYS_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

// Figma Frame 86 pastels per zimmer
const PASTELS = [
  { bg: '#AAEFFD', text: '#0B3838' },
  { bg: '#FFCEFF', text: '#0B3838' },
  { bg: '#D4F5C8', text: '#0B3838' },
  { bg: '#FFE6B3', text: '#0B3838' },
  { bg: '#D0C8F5', text: '#0B3838' },
  { bg: '#F5C8C8', text: '#0B3838' },
];

const VIEWS = [
  { id: 'year', label: 'שנה' },
  { id: 'week', label: 'שבוע' },
  { id: 'month', label: 'חודש' },
];

const CELL_H = 110;
const CELL_GAP = 12;
const BAR_H = 32;
const BAR_TOP = 42;

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());

function formatPrice(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return null;
  return `₪${Number(n).toLocaleString('he-IL')}`;
}

/** Build week-segmented reservation bars for a month grid (presentation only). */
function computeMonthBars(bookings, year, month, firstDay, daysInMonth) {
  const monthStart = new Date(year, month, 1);
  const monthLast = new Date(year, month, daysInMonth);
  const raw = [];

  for (const b of bookings) {
    if (b.is_block || b.status === 'חסום') continue;
    if (!b.check_in || !b.check_out) continue;
    let start = new Date(b.check_in + 'T00:00:00');
    const endExclusive = new Date(b.check_out + 'T00:00:00');
    if (endExclusive <= monthStart || start > monthLast) continue;
    if (start < monthStart) start = monthStart;
    const lastNight = new Date(Math.min(endExclusive.getTime() - 86400000, monthLast.getTime()));
    if (lastNight < start) continue;

    let cur = new Date(start);
    while (cur <= lastNight) {
      const dayNum = cur.getDate();
      const idx = firstDay + dayNum - 1;
      const col = idx % 7;
      const row = Math.floor(idx / 7);
      const daysLeftInWeek = 6 - col;
      const daysLeftInBooking = Math.round((lastNight - cur) / 86400000);
      const span = Math.min(daysLeftInWeek, daysLeftInBooking) + 1;
      raw.push({ booking: b, row, col, span, key: `${b.id}-${toISO(cur)}` });
      cur = new Date(cur.getTime() + span * 86400000);
    }
  }

  // Assign lanes per row to avoid overlap
  const byRow = {};
  for (const bar of raw) {
    (byRow[bar.row] = byRow[bar.row] || []).push(bar);
  }
  const result = [];
  for (const row of Object.keys(byRow)) {
    const list = byRow[row].sort((a, b) => a.col - b.col || b.span - a.span);
    const laneEnds = [];
    for (const bar of list) {
      let lane = 0;
      while (laneEnds[lane] != null && bar.col <= laneEnds[lane]) lane += 1;
      laneEnds[lane] = bar.col + bar.span - 1;
      result.push({ ...bar, lane });
    }
  }
  return result;
}

function cellInlineStart(col) {
  return `calc(${col} * ((100% - ${6 * CELL_GAP}px) / 7 + ${CELL_GAP}px))`;
}

function cellWidth(span) {
  return `calc(${span} * ((100% - ${6 * CELL_GAP}px) / 7) + ${(span - 1) * CELL_GAP}px)`;
}

export default function OwnerCalendar({ ownerId, zimmers, onAddBookingText, onZimmerUpdated, onOpenAI }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [zimmerFilter, setZimmerFilter] = useState('all');
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [popover, setPopover] = useState(null);
  const [showQuick, setShowQuick] = useState(false);
  const [command, setCommand] = useState(null);

  const load = useCallback(() => {
    if (!ownerId) return;
    api.entities.BookingRequest.filter({ owner_id: ownerId }).then((data) => {
      setBookings((data || []).filter((b) => b.status !== 'נדחית'));
      setLoading(false);
    });
  }, [ownerId]);

  useEffect(() => { load(); }, [load]);

  const zimmerColorMap = useMemo(() => {
    const m = {};
    zimmers.forEach((z, i) => { m[z.id] = PASTELS[i % PASTELS.length]; });
    return m;
  }, [zimmers]);

  const visibleBookings = useMemo(
    () => (zimmerFilter === 'all' ? bookings : bookings.filter((b) => b.zimmer_id === zimmerFilter)),
    [bookings, zimmerFilter]
  );

  const byDate = useMemo(() => {
    const map = {};
    for (const b of visibleBookings) {
      if (!b.check_in || !b.check_out) continue;
      let cur = new Date(b.check_in + 'T00:00:00');
      const end = new Date(b.check_out + 'T00:00:00');
      while (cur < end) {
        const iso = toISO(cur);
        (map[iso] = map[iso] || []).push(b);
        cur = new Date(cur.getTime() + 86400000);
      }
    }
    return map;
  }, [visibleBookings]);

  const bookingsOn = (iso) => byDate[iso] || [];

  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setAnchor(d); setSelectedDate(todayISO()); };

  const title = () => {
    if (view === 'week') {
      const start = new Date(anchor); start.setDate(anchor.getDate() - anchor.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      const s = `${start.getDate()} ${HEB_MONTHS[start.getMonth()]}`;
      const e = `${end.getDate()} ${HEB_MONTHS[end.getMonth()]}`;
      return `${s} – ${e} ${start.getFullYear()}`;
    }
    if (view === 'month') return `${HEB_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    return `${anchor.getFullYear()}`;
  };

  const openManual = (dateStr) => { setManualDate(dateStr || selectedDate || ''); setShowManual(true); };

  const openPopover = (iso, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSelectedDate(iso);
    setPopover({ iso, rect });
    setShowQuick(true);
  };

  const deleteBlock = async (b) => {
    if (!confirm('לבטל את החסימה?')) return;
    try { await api.entities.BookingRequest.delete(b.id); } catch {}
    setPopover(null);
    load();
  };

  const blockDay = async ({ zimmerId, reason }) => {
    const z = zimmers.find((x) => x.id === zimmerId);
    const ci = popover.iso;
    const co = toISO(new Date(new Date(ci + 'T00:00:00').getTime() + 86400000));
    try {
      await api.entities.BookingRequest.create({
        zimmer_id: zimmerId,
        zimmer_name: z?.name || '',
        owner_id: ownerId,
        guest_name: reason || 'חסום',
        guest_phone: '',
        check_in: ci,
        check_out: co,
        status: 'חסום',
        is_block: true,
        block_reason: reason || 'חסום',
        num_guests: null,
      });
    } catch {}
    setPopover(null);
    load();
  };

  const quickAction = (type) => {
    const iso = popover?.iso;
    setShowQuick(false);
    setPopover(null);
    if (!iso) return;
    if (type === 'booking') {
      openManual(iso);
    } else if (type === 'block') {
      setCommand({ type: 'block', date: iso, zimmerId: zimmerFilter !== 'all' ? zimmerFilter : (zimmers[0]?.id || ''), n: Date.now() });
      setShowActions(true);
    } else if (type === 'price') {
      setCommand({ type: 'price', range: { start: iso, end: iso }, zimmerId: zimmerFilter !== 'all' ? zimmerFilter : (zimmers[0]?.id || ''), n: Date.now() });
      setShowActions(true);
    } else if (type === 'ai') {
      const z = zimmerFilter !== 'all' ? zimmers.find((x) => x.id === zimmerFilter) : null;
      onOpenAI?.(iso, z?.name || null);
    }
  };

  const priceOnDay = (iso) => {
    const list = bookingsOn(iso).filter((b) => !(b.is_block || b.status === 'חסום'));
    for (const b of list) {
      const p = formatPrice(b.total_price);
      if (p) return p;
    }
    return null;
  };

  // --- compact cell (year) ---
  const renderCompactCell = (date) => {
    const iso = toISO(date);
    const isToday = iso === todayISO();
    const isSelected = iso === selectedDate;
    const dayBookings = bookingsOn(iso);
    const block = dayBookings.find((b) => b.is_block || b.status === 'חסום');
    const regular = dayBookings.filter((b) => !(b.is_block || b.status === 'חסום'));
    const occupied = regular.length || (block ? 1 : 0);

    return (
      <button
        key={iso}
        type="button"
        onClick={(e) => { setSelectedDate(iso); if (view === 'year') setAnchor(new Date(date)); else openPopover(iso, e); }}
        className="relative aspect-square font-simona flex flex-col items-center justify-center transition-all"
        style={{
          fontSize: 11,
          borderRadius: 8,
          border: '1px solid #E5E7EB',
          color: '#0B3838',
          background: block ? '#EFEFEF' : isToday ? 'rgba(11,56,56,0.08)' : '#fff',
          boxShadow: isSelected ? 'inset 0 0 0 2px #0B3838' : 'none',
        }}
      >
        <span style={{ fontWeight: isToday ? 700 : 400 }}>{date.getDate()}</span>
        {occupied > 0 && (
          <span
            className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
            style={{ background: block ? '#9CA3AF' : '#0B3838', color: '#fff' }}
          >
            {occupied}
          </span>
        )}
      </button>
    );
  };

  const renderMonthGrid = (year, month, opts = {}) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    if (opts.mini) {
      return (
        <div className="rounded-[12px] p-2.5" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div className="font-simpler text-center mb-2" style={{ color: '#0B3838', fontSize: 14, fontWeight: 600 }}>{HEB_MONTHS[month]}</div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {HEB_DAYS_SHORT.map((d, i) => (
              <div key={i} className="font-simona text-center" style={{ color: '#9CA3AF', fontSize: 9, fontWeight: 500 }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => (date ? renderCompactCell(date) : <div key={`e-${i}`} />))}
          </div>
        </div>
      );
    }

    const bars = computeMonthBars(visibleBookings, year, month, firstDay, daysInMonth);

    return (
      <div>
        {/* Day headers — Figma: underline + ~30px gap before cells (Day Headers y=235 → row y=305) */}
        <div
          className="grid grid-cols-7"
          style={{ gap: CELL_GAP, borderBottom: '1px solid #EFEFEF', marginBottom: 30 }}
        >
          {HEB_DAYS.map((d) => (
            <div
              key={d}
              className="font-simona text-center py-3"
              style={{ color: '#0B3838', fontSize: 13, fontWeight: 600 }}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="relative">
          <div
            className="grid grid-cols-7"
            style={{ gap: CELL_GAP }}
          >
            {cells.map((date, i) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${i}`}
                    style={{ height: CELL_H, borderRadius: 12, border: '0.5px solid #E5E7EB', background: '#FAFAFA', opacity: 0.5 }}
                  />
                );
              }
              const iso = toISO(date);
              const isToday = iso === todayISO();
              const dayBookings = bookingsOn(iso);
              const block = dayBookings.find((b) => b.is_block || b.status === 'חסום');
              const price = block ? null : priceOnDay(iso);

              // Figma: today = border #0B3838; blocked = bg #F2F2F2 + «חסום»; else light border
              let border = '0.5px solid #E5E7EB';
              let background = '#fff';
              if (block) {
                border = '1px solid #EFEFEF';
                background = '#F2F2F2';
              } else if (isToday) {
                border = '1px solid #0B3838';
              }

              return (
                <div
                  key={iso}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => openPopover(iso, e)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPopover(iso, e); } }}
                  className="relative flex flex-col cursor-pointer transition-opacity hover:opacity-95"
                  style={{
                    height: CELL_H,
                    borderRadius: 12,
                    border,
                    background,
                    padding: 12,
                  }}
                >
                  <div className="flex justify-end w-full">
                    <span
                      className="font-simona inline-flex items-center justify-center"
                      style={{
                        minWidth: isToday && !block ? 27 : undefined,
                        height: isToday && !block ? 21 : undefined,
                        borderRadius: isToday && !block ? 999 : 0,
                        background: isToday && !block ? '#0B3838' : 'transparent',
                        color: block ? '#717171' : isToday ? '#EFEFEF' : '#0B3838',
                        fontSize: 15,
                        fontWeight: isToday && !block ? 500 : 400,
                        paddingInline: isToday && !block ? 8 : 0,
                      }}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {block && (
                    <div className="flex-1 flex items-center justify-center w-full">
                      <span
                        className="font-simona"
                        style={{ color: '#4F4F4F', fontSize: 15, fontWeight: 400, opacity: 0.4 }}
                      >
                        חסום
                      </span>
                    </div>
                  )}

                  {!block && price && (
                    <div className="mt-auto">
                      <span className="font-simona block text-right truncate" style={{ color: '#0B3838', fontSize: 14, fontWeight: 400 }}>
                        {price}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reservation bars overlay */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden={false}>
            {bars.map((bar) => {
              const b = bar.booking;
              const pending = b.status === 'ממתינה';
              const c = zimmerColorMap[b.zimmer_id] || PASTELS[0];
              const zName = b.zimmer_name || zimmers.find((z) => z.id === b.zimmer_id)?.name || '';
              const label = `${b.guest_name || 'אורח'}${zName ? ` · ${zName}` : ''}`;
              const top = bar.row * (CELL_H + CELL_GAP) + BAR_TOP + bar.lane * (BAR_H + 4);

              return (
                <CalendarReservationBar
                  key={bar.key}
                  label={label}
                  pending={pending}
                  bg={c.bg}
                  textColor={c.text}
                  onClick={(e) => {
                    e.stopPropagation();
                    const iso = b.check_in;
                    const fake = { currentTarget: e.currentTarget, ...e };
                    openPopover(iso, fake);
                  }}
                  style={{
                    top,
                    insetInlineStart: cellInlineStart(bar.col),
                    width: cellWidth(bar.span),
                    zIndex: 2 + bar.lane,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekGrid = () => {
    const start = new Date(anchor); start.setDate(anchor.getDate() - anchor.getDay());
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });

    return (
      <div>
        <div className="grid grid-cols-7" style={{ gap: CELL_GAP, borderBottom: '1px solid #EFEFEF', marginBottom: 30 }}>
          {days.map((d, i) => (
            <div key={i} className="font-simona text-center py-2" style={{ color: '#0B3838', fontSize: 13, fontWeight: 600 }}>
              <span className="block opacity-70">{HEB_DAYS[i]}</span>
              <span
                className="mt-1 inline-flex items-center justify-center"
                style={{
                  minWidth: 27,
                  height: 21,
                  borderRadius: 999,
                  background: toISO(d) === todayISO() ? '#0B3838' : 'transparent',
                  color: toISO(d) === todayISO() ? '#fff' : '#0B3838',
                  fontSize: 15,
                  paddingInline: 8,
                }}
              >
                {d.getDate()}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7" style={{ gap: CELL_GAP }}>
          {days.map((d) => {
            const iso = toISO(d);
            const isToday = iso === todayISO();
            const dayBookings = bookingsOn(iso);
            const block = dayBookings.find((b) => b.is_block || b.status === 'חסום');
            const regular = dayBookings.filter((b) => !(b.is_block || b.status === 'חסום'));
            const price = block ? null : priceOnDay(iso);

            return (
              <div
                key={iso}
                role="button"
                tabIndex={0}
                onClick={(e) => openPopover(iso, e)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPopover(iso, e); } }}
                className="relative flex flex-col cursor-pointer"
                style={{
                  minHeight: 150,
                  borderRadius: 12,
                  border: block ? '1px solid #EFEFEF' : isToday ? '1px solid #0B3838' : '0.5px solid #E5E7EB',
                  background: block ? '#F2F2F2' : '#fff',
                  padding: 12,
                  gap: 6,
                }}
              >
                {block ? (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="font-simona" style={{ color: '#4F4F4F', fontSize: 15, opacity: 0.4 }}>חסום</span>
                  </div>
                ) : (
                  regular.map((b) => {
                    const pending = b.status === 'ממתינה';
                    const c = zimmerColorMap[b.zimmer_id] || PASTELS[0];
                    const zName = b.zimmer_name || '';
                    return (
                      <div
                        key={b.id}
                        className="font-simona truncate flex items-center"
                        style={{
                          height: 32,
                          borderRadius: 10,
                          background: pending ? '#EFEFEF' : c.bg,
                          color: pending ? '#383838' : c.text,
                          fontSize: 13,
                          fontWeight: 500,
                          paddingInline: 10,
                          gap: 8,
                        }}
                      >
                        <span className="truncate flex-1 text-right">{b.guest_name}{zName ? ` · ${zName}` : ''}</span>
                        {pending && (
                          <span style={{ background: '#FFFF00', borderRadius: 8, padding: '0 6px', fontSize: 12 }}>ממתין</span>
                        )}
                      </div>
                    );
                  })
                )}
                {!block && price && (
                  <div className="mt-auto">
                    <span className="font-simona block text-right" style={{ color: '#0B3838', fontSize: 14 }}>{price}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearGrid = () => {
    const y = anchor.getFullYear();
    const months = Array.from({ length: 12 }, (_, m) => ({ year: y, month: m }));
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {months.map(({ year, month }) => <div key={`${year}-${month}`}>{renderMonthGrid(year, month, { mini: true })}</div>)}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: '#E5E7EB', borderTopColor: '#0B3838' }} />
      </div>
    );
  }

  const sidebar = (
    <OwnerCalendarActionsSidebar
      ownerId={ownerId}
      zimmers={zimmers}
      bookings={bookings}
      selectedDate={selectedDate}
      onRefresh={load}
      onOpenManual={openManual}
      onZimmerSaved={onZimmerUpdated}
      command={command}
      onCommandConsumed={() => setCommand(null)}
    />
  );

  // Figma 1011:1010 — sidebar on visual LEFT, calendar on RIGHT (LTR layout shell)
  return (
    <div className="flex gap-4 h-full font-simona" style={{ minHeight: 0 }} dir="ltr">
      {/* Desktop actions sidebar — left, narrower, white, radius 23, no shadow */}
      <div className="hidden lg:block flex-shrink-0 self-stretch" style={{ width: 422 }}>
        <div className="h-full overflow-hidden" style={{ background: '#FFFFFF', borderRadius: 23 }} dir="rtl">
          {sidebar}
        </div>
      </div>

      {/* Mobile drawer */}
      {showActions && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-start" onClick={() => setShowActions(false)} dir="ltr">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />
          <div
            className="relative h-full overflow-hidden"
            style={{ width: 'min(422px, 85vw)', background: '#FFFFFF', borderRadius: '0 23px 23px 0' }}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {sidebar}
          </div>
        </div>
      )}

      {/* Calendar card */}
      <div
        className="flex-1 min-w-0 flex flex-col overflow-hidden"
        style={{ background: '#fff', borderRadius: 23 }}
        dir="rtl"
      >
        {/* Header chrome — Figma: month title on right, views on left */}
        <div className="flex-shrink-0 px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Month title — Figma 1011:1182: one down-chevron to the LEFT of title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setShowActions(true)}
                className="lg:hidden font-simona flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm flex-shrink-0"
                style={{ background: '#0B3838', color: '#fff', fontWeight: 500 }}
              >
                <Sliders size={14} /> פעולות
              </button>
              <label
                className="relative inline-flex items-center min-w-0 cursor-pointer transition-opacity hover:opacity-80"
                style={{ gap: 16 }}
                dir="ltr"
                title="בחירת חודש"
              >
                <span className="flex-shrink-0 overflow-hidden pointer-events-none" style={{ width: 20, height: 20 }}>
                  <img src={chevronMonth} alt="" width={20} height={20} className="block w-full h-full" />
                </span>
                <h2
                  className="font-simpler whitespace-nowrap truncate pointer-events-none"
                  style={{ color: '#0B3838', fontSize: 29, fontWeight: 600, lineHeight: 'normal' }}
                  dir="rtl"
                >
                  {title()}
                </h2>
                <select
                  aria-label="בחירת חודש"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  value={view === 'year' ? String(anchor.getFullYear()) : `${anchor.getFullYear()}-${anchor.getMonth()}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (view === 'year') {
                      const d = new Date(anchor);
                      d.setFullYear(Number(v));
                      setAnchor(d);
                      return;
                    }
                    const [y, m] = v.split('-').map(Number);
                    const d = new Date(anchor);
                    d.setFullYear(y);
                    d.setMonth(m);
                    d.setDate(1);
                    setAnchor(d);
                  }}
                >
                  {view === 'year'
                    ? Array.from({ length: 7 }, (_, i) => anchor.getFullYear() - 3 + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))
                    : Array.from({ length: 12 }, (_, m) => (
                      <option key={m} value={`${anchor.getFullYear()}-${m}`}>
                        {HEB_MONTHS[m]} {anchor.getFullYear()}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="flex justify-start lg:justify-center">
              <label className="relative inline-flex items-center" style={{ maxWidth: '100%' }}>
                <select
                  value={zimmerFilter}
                  onChange={(e) => setZimmerFilter(e.target.value)}
                  className="font-simona appearance-none outline-none cursor-pointer"
                  style={{
                    background: '#fff',
                    border: '1px solid #E8E8E8',
                    borderRadius: 99,
                    padding: '10px 20px 10px 40px',
                    color: '#0B3838',
                    fontSize: 14,
                    fontWeight: 400,
                    minWidth: 155,
                  }}
                >
                  <option value="all">כל הנכסים ({zimmers.length})</option>
                  {zimmers.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ width: 16, height: 16 }}>
                  <img src={iconChevron} alt="" width={6} height={12} className="block mx-auto" style={{ width: 8, height: 12, transform: 'rotate(-90deg)' }} />
                </span>
              </label>
            </div>

            {/* Figma LTR order: שנה → שבוע → חודש then היום to the right — no box on היום */}
            <div className="flex items-center flex-wrap" style={{ gap: 16 }} dir="ltr">
              <div
                className="flex items-center"
                style={{ background: '#F9F9F9', borderRadius: 99, padding: 4 }}
              >
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setView(v.id)}
                    className="font-simona transition-all"
                    style={{
                      padding: '8px 20px',
                      borderRadius: 99,
                      fontSize: 14,
                      fontWeight: view === v.id ? 700 : 400,
                      color: '#0B3838',
                      background: view === v.id ? '#fff' : 'transparent',
                      boxShadow: view === v.id ? '0px 2px 2px rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={goToday}
                className="font-simona flex flex-col items-center transition-opacity hover:opacity-80"
                style={{
                  color: '#0B3838',
                  fontSize: 18,
                  fontWeight: 500,
                  background: 'transparent',
                  border: 'none',
                  padding: '8px 20px',
                  gap: 1,
                }}
              >
                היום
                <img
                  src={underlineToday}
                  alt=""
                  aria-hidden
                  width={34}
                  height={5}
                  className="block"
                  style={{ width: 34, height: 5 }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto owner-hide-scrollbar px-4 sm:px-6 pb-6 sm:pb-8">
          {view === 'week' && renderWeekGrid()}
          {view === 'month' && renderMonthGrid(anchor.getFullYear(), anchor.getMonth())}
          {view === 'year' && renderYearGrid()}
        </div>
      </div>

      {popover && (
        <CalendarDayPopover
          iso={popover.iso}
          bookings={bookingsOn(popover.iso)}
          zimmers={zimmers}
          anchorRect={popover.rect}
          zimmerFilter={zimmerFilter}
          onClose={() => { setPopover(null); setShowQuick(false); }}
          onAddBooking={(d) => { setPopover(null); setShowQuick(false); openManual(d); }}
          onDeleteBlock={deleteBlock}
          onBlockDay={blockDay}
        />
      )}

      {popover && showQuick && (
        <CalendarQuickActions
          iso={popover.iso}
          zimmers={zimmers}
          bookings={bookings}
          anchorRect={popover.rect}
          popoverLeft={(() => {
            if (!popover.rect) return 80;
            let l = popover.rect.left;
            if (l + 320 > window.innerWidth - 12) l = window.innerWidth - 320 - 12;
            if (l < 12) l = 12;
            return l;
          })()}
          onClose={() => setShowQuick(false)}
          onAction={quickAction}
        />
      )}

      {showManual && (
        <ManualBookingForm
          zimmers={zimmers}
          ownerId={ownerId}
          initialDate={manualDate}
          onClose={() => setShowManual(false)}
          onSaved={() => { setShowManual(false); setLoading(true); load(); }}
          onSwitchToText={() => { setShowManual(false); onAddBookingText?.(); }}
        />
      )}
    </div>
  );
}
