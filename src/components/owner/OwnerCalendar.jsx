import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/api/client';
import { Sliders } from 'lucide-react';
import ManualBookingForm from '@/components/owner/ManualBookingForm';
import OwnerCalendarActionsSidebar from '@/components/owner/OwnerCalendarActionsSidebar';
import CalendarDayPopover, { DRAWER_WIDTH } from '@/components/owner/CalendarDayPopover';
import CalendarQuickActions from '@/components/owner/CalendarQuickActions';
import CalendarReservationBar from '@/components/owner/CalendarReservationBar';
import monthChevron from '@/assets/owner/calendar/month-chevron.svg';
import selectChevron from '@/assets/owner/calendar/select-chevron.svg';
import iconAddPlus from '@/assets/owner/calendar/add-plus.svg';
import cellLogo from '@/assets/owner/calendar/cell-logo.svg';
import cellPlus from '@/assets/owner/calendar/cell-plus.svg';
import iconBlocked from '@/assets/owner/calendar/blocked.svg';

const INK = '#0B3838';
const QUICK_WIDTH = 320;

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

export default function OwnerCalendar({ ownerId, zimmers, onAddBookingText, onZimmerUpdated, onOpenAI, onOpenBooking }) {
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
  const [daySelected, setDaySelected] = useState(false);

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
    if (view === 'month') {
      const sameYear = anchor.getFullYear() === new Date().getFullYear();
      return sameYear ? HEB_MONTHS[anchor.getMonth()] : `${HEB_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    }
    return `${anchor.getFullYear()}`;
  };

  const openManual = (dateStr) => { setManualDate(dateStr || selectedDate || ''); setShowManual(true); };

  const openPopover = (iso, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSelectedDate(iso);
    setDaySelected(true);
    setPopover({ iso, rect, mode: 'day' });
    setShowQuick(true);
  };

  const openBarDrawer = (booking, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDaySelected(false);
    setShowQuick(false);
    setPopover({ iso: booking.check_in, rect, mode: 'bar', booking });
  };

  const closePopups = () => { setPopover(null); setShowQuick(false); };

  useEffect(() => {
    if (!popover) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setPopover(null); setShowQuick(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popover]);

  const deleteBlock = async (b) => {
    if (!confirm('לבטל את החסימה?')) return;
    try { await api.entities.BookingRequest.delete(b.id); } catch {}
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
        {/* Day headers — Figma: 40px row + underline, 30px gap before cells (Day Headers y=235 → row y=305) */}
        <div
          className="grid grid-cols-7"
          style={{ gap: CELL_GAP, borderBottom: '1px solid #E5E7EB', marginBottom: 30 }}
        >
          {HEB_DAYS.map((d) => (
            <div
              key={d}
              className="font-simona flex items-center justify-center"
              style={{ height: 40, color: INK, fontSize: 13, fontWeight: 600 }}
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
                    style={{ height: CELL_H, borderRadius: 12, border: '1px solid #E5E7EB', background: '#FAFAFA', opacity: 0.5 }}
                  />
                );
              }
              const iso = toISO(date);
              const isToday = iso === todayISO();
              const isSelected = daySelected && iso === selectedDate;
              const dayBookings = bookingsOn(iso);
              const block = dayBookings.find((b) => b.is_block || b.status === 'חסום');
              const price = block ? null : priceOnDay(iso);
              const todayPill = isToday && !block;

              // Figma 1776:18757 / 1776:18460: today + selected = ink border; blocked = #F2F2F2 + icon + «חסום»
              let border = '1px solid #E5E7EB';
              let background = '#fff';
              if (block) {
                border = '1px solid #EFEFEF';
                background = '#F2F2F2';
              }
              if (isToday || isSelected) border = `1px solid ${INK}`;

              return (
                <div
                  key={iso}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${date.getDate()} ב${HEB_MONTHS[date.getMonth()]}${block ? ', חסום' : ''}`}
                  onClick={(e) => openPopover(iso, e)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPopover(iso, e); } }}
                  className={`group relative flex flex-col cursor-pointer overflow-hidden ${block ? '' : 'hover:!border-[#0B3838] focus-visible:!border-[#0B3838]'}`}
                  style={{
                    height: CELL_H,
                    borderRadius: 12,
                    border,
                    background,
                    padding: 12,
                  }}
                >
                  {isSelected && (
                    <img
                      src={cellLogo}
                      alt=""
                      aria-hidden
                      width={54}
                      height={58}
                      className="owner-logo-roll absolute pointer-events-none"
                      style={{ left: 'calc(50% - 31.5px)', top: 'calc(50% - 29px)' }}
                    />
                  )}

                  <div className="relative flex justify-start w-full">
                    <span
                      className="font-simona inline-flex items-center justify-center"
                      style={{
                        minWidth: todayPill ? 27 : undefined,
                        height: todayPill ? 21 : undefined,
                        borderRadius: todayPill ? 18 : 0,
                        background: todayPill ? '#FFFF00' : 'transparent',
                        color: block ? '#717171' : INK,
                        fontSize: todayPill ? 16 : 15,
                        fontWeight: todayPill ? 500 : 400,
                        paddingInline: todayPill ? 6 : 0,
                        lineHeight: 'normal',
                      }}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {block && (
                    <div className="relative flex-1 flex items-center justify-center w-full" style={{ gap: 5 }}>
                      <img src={iconBlocked} alt="" width={12} height={12} className="block flex-shrink-0" />
                      <span className="font-simona" style={{ color: '#4F4F4F', fontSize: 15, fontWeight: 400 }}>
                        חסום
                      </span>
                    </div>
                  )}

                  {!block && price && (
                    <div className="relative mt-auto">
                      <span className={`font-simona block truncate ${isSelected ? 'text-left' : 'text-right group-hover:text-left group-focus-visible:text-left'}`} style={{ color: INK, fontSize: 14, fontWeight: 400 }}>
                        {price}
                      </span>
                    </div>
                  )}

                  {/* Figma 33:1153 (hover) / 33:1158 (click): + button; logo only on click */}
                  {(isSelected || !block) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); closePopups(); openManual(iso); }}
                      aria-label="הוספת הזמנה לתאריך"
                      className={`absolute z-[1] transition-transform hover:scale-105 ${isSelected ? '' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 focus-visible:opacity-100'}`}
                      style={{ right: 19, bottom: 12 }}
                    >
                      <img src={cellPlus} alt="" width={32} height={32} className="block" />
                    </button>
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
                    openBarDrawer(b, e);
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
                  background: toISO(d) === todayISO() ? '#FFFF00' : 'transparent',
                  color: INK,
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
                  border: isToday || (daySelected && iso === selectedDate) ? `1px solid ${INK}` : block ? '1px solid #EFEFEF' : '1px solid #E5E7EB',
                  background: block ? '#F2F2F2' : '#fff',
                  padding: 12,
                  gap: 6,
                }}
              >
                {block ? (
                  <div className="flex-1 flex items-center justify-center" style={{ gap: 5 }}>
                    <img src={iconBlocked} alt="" width={12} height={12} className="block flex-shrink-0" />
                    <span className="font-simona" style={{ color: '#4F4F4F', fontSize: 15 }}>חסום</span>
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
      monthLabel={HEB_MONTHS[anchor.getMonth()]}
      monthDate={anchor}
      zimmerFilter={zimmerFilter}
      daySelected={daySelected}
      onCloseDay={() => { setDaySelected(false); closePopups(); }}
    />
  );

  // Figma 1776:18757 — sidebar on visual LEFT (divider 1776:18936), calendar on RIGHT (LTR layout shell)
  return (
    <div className="flex gap-4 lg:gap-0 h-full font-simona bg-white" style={{ minHeight: 0 }} dir="ltr">
      <div
        className="hidden lg:block relative z-10 flex-shrink-0 self-stretch"
        style={{ width: 'clamp(340px, 23.13vw, 444px)', borderRight: '1px solid #E8E8E8' }}
        dir="rtl"
      >
        {React.cloneElement(sidebar, { showPills: true })}
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
        className="flex-1 min-w-0 flex flex-col overflow-hidden lg:pl-[clamp(16px,1.77vw,34px)] lg:pr-[clamp(12px,0.99vw,19px)]"
        style={{ background: '#fff' }}
        dir="rtl"
      >
        {/* Header — Figma 1776:18757: right = month · היום · views, left = property select · הוספה */}
        <div className="flex-shrink-0 px-4 sm:px-6 lg:px-0 pt-6 sm:pt-8 lg:pt-[clamp(32px,3.46vw,66.5px)] pb-4 lg:pb-[clamp(24px,2.43vw,46.6px)] lg:pr-[clamp(8px,1.2vw,23px)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center flex-wrap min-w-0" style={{ gap: 16 }}>
              <button
                type="button"
                onClick={() => setShowActions(true)}
                className="lg:hidden font-simona flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm flex-shrink-0"
                style={{ background: INK, color: '#fff', fontWeight: 500 }}
              >
                <Sliders size={14} /> פעולות
              </button>
              <label
                className="relative inline-flex items-center min-w-0 cursor-pointer transition-opacity hover:opacity-80"
                style={{ gap: 16, marginLeft: 'clamp(8px, 1.51vw, 29px)' }}
                title="בחירת חודש"
              >
                <h2
                  className="font-simpler whitespace-nowrap truncate pointer-events-none"
                  style={{ color: INK, fontSize: 29, fontWeight: 600, lineHeight: 'normal' }}
                >
                  {title()}
                </h2>
                <img src={monthChevron} alt="" width={20} height={20} className="block flex-shrink-0 pointer-events-none" />
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

              <button
                type="button"
                onClick={goToday}
                className="font-simona flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
                style={{ width: 83, height: 41, borderRadius: 35, border: '1px solid rgba(11,56,56,0.21)', color: INK, fontSize: 14, background: 'transparent' }}
              >
                היום
              </button>

              {/* LTR order שנה · שבוע · חודש → selected חודש sits rightmost */}
              <div
                className="flex items-center flex-shrink-0"
                dir="ltr"
                role="group"
                aria-label="תצוגת יומן"
                style={{ height: 41, background: '#F9F9F9', borderRadius: 99, padding: 4 }}
              >
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setView(v.id)}
                    aria-pressed={view === v.id}
                    className="font-simona h-full flex items-center transition-all"
                    style={{
                      padding: '0 20px',
                      borderRadius: 99,
                      fontSize: 14,
                      fontWeight: view === v.id ? 700 : 400,
                      color: INK,
                      background: view === v.id ? '#fff' : 'transparent',
                      boxShadow: view === v.id ? '0px 2px 4px rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center flex-shrink-0" style={{ gap: 7 }}>
              <label className="relative inline-flex items-center" style={{ maxWidth: '100%' }}>
                <select
                  value={zimmerFilter}
                  onChange={(e) => setZimmerFilter(e.target.value)}
                  aria-label="בחירת נכס"
                  className="font-simona appearance-none outline-none cursor-pointer"
                  style={{
                    height: 41,
                    background: '#fff',
                    border: '1px solid #E8E8E8',
                    borderRadius: 99,
                    padding: '0 20px 0 44px',
                    color: INK,
                    fontSize: 14,
                    fontWeight: 400,
                    minWidth: 155,
                  }}
                >
                  <option value="all">כל הנכסים ({zimmers.length})</option>
                  {zimmers.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
                <img
                  src={selectChevron}
                  alt=""
                  width={16}
                  height={16}
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 block"
                  style={{ left: 20 }}
                />
              </label>
              <button
                type="button"
                onClick={() => openManual(selectedDate)}
                className="font-simpler flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90"
                style={{ width: 131, height: 41, gap: 12, padding: 12, borderRadius: 35, background: INK, color: '#EFEFEF', fontSize: 16, fontWeight: 600 }}
              >
                <img src={iconAddPlus} alt="" width={14} height={14} className="block" style={{ width: 14, height: 14 }} />
                הוספה
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto owner-hide-scrollbar px-4 sm:px-6 lg:px-0 pb-6 sm:pb-8">
          {view === 'week' && renderWeekGrid()}
          {view === 'month' && renderMonthGrid(anchor.getFullYear(), anchor.getMonth())}
          {view === 'year' && renderYearGrid()}
        </div>
      </div>

      {popover && (() => {
        const rect = popover.rect;
        const clampLeft = (l, w) => Math.max(12, Math.min(l, window.innerWidth - w - 12));
        const clampTop = (t) => Math.max(12, Math.min(t, window.innerHeight - 380));

        // Figma prototype: reservation bar → Side Drawer at (+51.3, +41.5) from the bar, dissolve 0.3s.
        if (popover.mode === 'bar') {
          return (
            <>
              <div className="fixed inset-0 z-[54]" onClick={closePopups} aria-hidden />
              <CalendarDayPopover
                className="owner-dissolve"
                bookings={[popover.booking]}
                zimmers={zimmers}
                left={clampLeft(rect.left + 51.3, DRAWER_WIDTH)}
                top={clampTop(rect.top + 41.5)}
                onDeleteBlock={deleteBlock}
                onOpenBooking={(b) => { closePopups(); onOpenBooking?.(b); }}
              />
            </>
          );
        }

        // Figma prototype: date cell → ActionPopup at (-181.2, +70.5) from the cell.
        const blocks = bookingsOn(popover.iso).filter((b) => b.is_block || b.status === 'חסום');
        const quickLeft = clampLeft(rect.left - 181.2, QUICK_WIDTH);
        const quickTop = rect.top + 70.5;
        const blockLeft = quickLeft - 8 - DRAWER_WIDTH >= 12 ? quickLeft - 8 - DRAWER_WIDTH : quickLeft + QUICK_WIDTH + 8;
        return (
          <>
            <div className="fixed inset-0 z-[54]" onClick={closePopups} aria-hidden />
            {blocks.length > 0 && (
              <CalendarDayPopover
                bookings={blocks}
                zimmers={zimmers}
                left={clampLeft(blockLeft, DRAWER_WIDTH)}
                top={clampTop(quickTop)}
                onDeleteBlock={deleteBlock}
              />
            )}
            {showQuick && (
              <CalendarQuickActions
                iso={popover.iso}
                zimmers={zimmers}
                bookings={bookings}
                anchorRect={rect}
                popoverLeft={quickLeft}
                popoverTop={quickTop}
                onClose={closePopups}
                onAction={quickAction}
              />
            )}
          </>
        );
      })()}

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
