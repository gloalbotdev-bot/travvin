import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/api/client';
import { ChevronRight, ChevronLeft, Plus, Sliders } from 'lucide-react';
import ManualBookingForm from '@/components/owner/ManualBookingForm';
import OwnerCalendarActionsSidebar from '@/components/owner/OwnerCalendarActionsSidebar';
import CalendarDayPopover from '@/components/owner/CalendarDayPopover';
import CalendarQuickActions from '@/components/owner/CalendarQuickActions';

const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEB_DAYS_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

// Light pastel palette per zimmer (background + readable text).
const PASTELS = [
  { bg: '#a8dce5', text: '#0b3a4a' },
  { bg: '#e8a8e5', text: '#3a0b3a' },
  { bg: '#c8e6b8', text: '#0b3a1a' },
  { bg: '#f5d9a8', text: '#3a2b0b' },
  { bg: '#d0c8f5', text: '#1a0b3a' },
  { bg: '#f5c8c8', text: '#3a0b0b' },
];

const VIEWS = [
  { id: 'month', label: 'חודש' },
  { id: 'week', label: 'שבוע' },
  { id: 'year', label: 'שנה' },
];

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());

export default function OwnerCalendar({ ownerId, zimmers, onAddBookingText, onZimmerUpdated, onOpenAI }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [zimmerFilter, setZimmerFilter] = useState('all');
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [showActions, setShowActions] = useState(false); // mobile drawer
  const [popover, setPopover] = useState(null); // { iso, rect }
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
    () => zimmerFilter === 'all' ? bookings : bookings.filter((b) => b.zimmer_id === zimmerFilter),
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
  const isCheckIn = (b, iso) => b.check_in === iso;
  const isCheckOut = (b, iso) => b.check_out === iso;

  const shift = (delta) => {
    const d = new Date(anchor);
    if (view === 'week') d.setDate(d.getDate() + delta * 7);
    else if (view === 'month') d.setMonth(d.getMonth() + delta);
    else d.setFullYear(d.getFullYear() + delta);
    setAnchor(d);
  };

  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setAnchor(d); setSelectedDate(todayISO()); };

  const title = () => {
    if (view === 'week') {
      const start = new Date(anchor); start.setDate(anchor.getDate() - anchor.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      const s = `${start.getDate()} ${HEB_MONTHS[start.getMonth()]}`;
      const e = `${end.getDate()} ${HEB_MONTHS[end.getMonth()]}${start.getMonth() !== end.getMonth() ? '' : ''}`;
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
    const z = zimmers.find((z) => z.id === zimmerId);
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

  // --- cell renderers ---
  const renderCell = (date, opts = {}) => {
    const iso = toISO(date);
    const isToday = iso === todayISO();
    const isSelected = iso === selectedDate;
    const dayBookings = bookingsOn(iso);
    const block = dayBookings.find((b) => b.is_block || b.status === 'חסום');
    const regular = dayBookings.filter((b) => !(b.is_block || b.status === 'חסום'));
    const compact = opts.compact;

    if (compact) {
      const occupied = regular.length || (block ? 1 : 0);
      return (
        <button
          key={iso}
          onClick={(e) => { setSelectedDate(iso); if (view === 'year') setAnchor(new Date(date)); else openPopover(iso, e); }}
          className={`relative aspect-square text-[11px] rounded-lg flex flex-col items-center justify-center transition-all
            ${isSelected ? 'ring-2 ring-orange-400 bg-orange-400/15' : 'hover:bg-gray-100'}
            ${isToday ? 'bg-orange-400/15' : ''} ${block ? 'bg-[#e0dcd6]' : ''}`}
          style={{ border: '1px solid #E8E5E0', color: '#1A1A1A' }}
        >
          <span className={`font-bold ${isToday ? 'text-orange-500' : ''}`}>{date.getDate()}</span>
          {occupied > 0 && (
            <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
              style={{ background: block ? '#9CA3AF' : '#F97316', color: '#fff' }}>{occupied}</span>
          )}
        </button>
      );
    }

    return (
      <div
        key={iso}
        onClick={(e) => openPopover(iso, e)}
        className={`p-2 border-b border-r transition-colors relative flex flex-col cursor-pointer
          ${isSelected ? 'ring-2 ring-inset ring-orange-400' : isToday ? 'ring-1 ring-inset ring-orange-300' : ''}
          ${block ? 'bg-[#e0dcd6]' : regular.length ? 'hover:bg-gray-50' : 'hover:bg-gray-50'}`}
        style={{ minHeight: view === 'week' ? 150 : 104, borderColor: '#E8E5E0', background: block ? '#e0dcd6' : '#fff' }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-orange-500 text-white' : ''}`} style={{ color: isToday ? '#fff' : '#1A1A1A' }}>
            {date.getDate()}
          </span>
          <span className="text-[10px] font-medium" style={{ color: '#9CA3AF' }}>
            {block ? 'חסום' : regular.length === 0 ? (view === 'week' ? 'פנוי' : '') : `${regular.length} הזמנות`}
          </span>
        </div>
        <div className="space-y-1 flex-1">
          {block ? (
            <div className="text-[11px] font-semibold rounded-md px-1.5 py-1 truncate" style={{ background: '#c8c2b8', color: '#4b4030' }}>
              {block.block_reason || 'חסום'}
            </div>
          ) : regular.slice(0, view === 'week' ? 6 : 2).map((b) => {
            const c = zimmerColorMap[b.zimmer_id] || PASTELS[0];
            const pending = b.status === 'ממתינה';
            return (
              <div key={b.id} className="rounded-md px-1.5 py-1 leading-tight truncate flex items-center gap-1"
                style={{ background: pending ? '#fff59d' : c.bg, color: pending ? '#92400e' : c.text }}>
                {isCheckIn(b, iso) ? <span className="font-bold">▶</span> : isCheckOut(b, iso) ? <span className="font-bold">◀</span> : null}
                <span className="text-[11px] font-semibold truncate">{b.guest_name}</span>
              </div>
            );
          })}
          {regular.length > (view === 'week' ? 6 : 2) && (
            <div className="text-[10px] pr-1 pt-0.5" style={{ color: '#9CA3AF' }}>+{regular.length - (view === 'week' ? 6 : 2)} נוספים</div>
          )}
        </div>
      </div>
    );
  };

  const renderMonthGrid = (year, month, opts = {}) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

    if (opts.mini) {
      return (
        <div className="rounded-xl p-2.5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <div className="text-center text-xs font-bold mb-2" style={{ color: '#1A1A1A' }}>{HEB_MONTHS[month]}</div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {HEB_DAYS_SHORT.map((d, i) => <div key={i} className="text-center text-[9px] font-semibold" style={{ color: '#9CA3AF' }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => date ? renderCell(date, { compact: true }) : <div key={i} />)}
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <div className="grid grid-cols-7" style={{ borderBottom: '1.5px solid #F0EEE8', background: '#f9f9f9' }}>
          {HEB_DAYS.map((d, i) => (
            <div key={d} className="text-center text-xs font-semibold py-3 tracking-wide" style={{ color: i === 5 || i === 6 ? '#EA580C' : '#6B7280' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => date ? renderCell(date) : <div key={i} className="min-h-[104px] border-b border-r" style={{ borderColor: '#F0EEE8', background: '#fafafa' }} />)}
        </div>
      </div>
    );
  };

  const renderWeekGrid = () => {
    const start = new Date(anchor); start.setDate(anchor.getDate() - anchor.getDay());
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <div className="grid grid-cols-7" style={{ borderBottom: '1.5px solid #F0EEE8', background: '#f9f9f9' }}>
          {days.map((d, i) => (
            <div key={i} className="text-center text-xs font-semibold py-3 tracking-wide" style={{ color: i === 5 || i === 6 ? '#EA580C' : '#6B7280' }}>
              <span className="block opacity-70">{HEB_DAYS[i]}</span>
              <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px]"
                style={{ background: toISO(d) === todayISO() ? '#F97316' : 'transparent', color: toISO(d) === todayISO() ? '#fff' : '#1A1A1A' }}>{d.getDate()}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => renderCell(d))}
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

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

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

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }} className="flex gap-4 h-full">
      {/* Desktop actions sidebar */}
      <div className="hidden lg:block w-80 flex-shrink-0">{sidebar}</div>

      {/* Mobile drawer */}
      {showActions && (
        <div className="lg:hidden fixed inset-0 z-50 flex" onClick={() => setShowActions(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />
          <div className="relative w-80 max-w-[85vw] h-full" onClick={(e) => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}

      {/* Calendar area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowActions(true)} className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: '#0B1B2A', color: '#fff' }}>
              <Sliders size={14} /> פעולות
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => shift(-1)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-gray-100" style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}><ChevronRight size={18} /></button>
              <button onClick={goToday} className="px-3 h-9 rounded-xl text-xs font-semibold transition-all hover:bg-gray-100" style={{ border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}>היום</button>
              <span className="font-bold text-base min-w-44 text-center" style={{ color: '#1A1A1A' }}>{title()}</span>
              <button onClick={() => shift(1)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-gray-100" style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}><ChevronLeft size={18} /></button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Zimmer filter */}
            <select value={zimmerFilter} onChange={(e) => setZimmerFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl outline-none" style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}>
              <option value="all">כל הנכסים ({zimmers.length})</option>
              {zimmers.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>

            {/* View toggle */}
            <div className="flex items-center rounded-xl p-1" style={{ background: '#fff', border: '1.5px solid #E8E5E0' }}>
              {VIEWS.map((v) => (
                <button key={v.id} onClick={() => setView(v.id)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all"
                  style={view === v.id ? { background: '#0B1B2A', color: '#fff' } : { color: '#6B7280' }}>
                  {v.label}
                </button>
              ))}
            </div>

            <button onClick={() => openManual(selectedDate)}
              className="flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:opacity-90" style={{ background: '#F97316' }}>
              <Plus size={14} /> הוספת הזמנה
            </button>
          </div>
        </div>

        {/* Legend */}
        {zimmers.length > 0 && view !== 'year' && (
          <div className="flex flex-wrap gap-3 mb-4">
            {zimmers.map((z, i) => {
              const c = PASTELS[i % PASTELS.length];
              return (
                <div key={z.id} className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: c.bg }} /> {z.name}
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
              <div className="w-3 h-3 rounded" style={{ background: '#e0dcd6', border: '1px solid #c8c2b8' }} /> חסום
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
              <div className="w-3 h-3 rounded" style={{ background: '#fff59d' }} /> ממתין
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          {view === 'week' && renderWeekGrid()}
          {view === 'month' && renderMonthGrid(anchor.getFullYear(), anchor.getMonth())}
          {view === 'year' && renderYearGrid()}
        </div>
      </div>

      {/* Day popover */}
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

      {/* Quick actions floating menu */}
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

      {/* Manual booking modal (preserved) */}
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