import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronRight, ChevronLeft, Plus } from 'lucide-react';
import { getBookingTotal, formatILS } from '@/lib/bookingPrice';
import ManualBookingForm from '@/components/owner/ManualBookingForm';

const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEB_DAYS_SHORT = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''];

const COLORS = [
'bg-[#25D366]/80', 'bg-blue-500/80', 'bg-purple-500/80',
'bg-orange-500/80', 'bg-pink-500/80', 'bg-cyan-500/80'];


const VIEWS = [
{ id: 'week', label: 'שבועי' },
{ id: 'month', label: 'חודשי' },
{ id: 'quarter', label: 'תלת-חודשי' }];


const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());

export default function OwnerCalendar({ ownerId, zimmers, onAddBooking, onAddBookingText }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => {const d = new Date();d.setHours(0, 0, 0, 0);return d;});
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState('');

  useEffect(() => {
    if (!ownerId) return;
    base44.entities.BookingRequest.filter({ owner_id: ownerId }).then((data) => {
      setBookings(data.filter((b) => b.status !== 'נדחתה'));
      setLoading(false);
    });
  }, [ownerId]);

  const zimmerColorMap = useMemo(() => {
    const m = {};
    zimmers.forEach((z, i) => {m[z.id] = COLORS[i % COLORS.length];});
    return m;
  }, [zimmers]);

  const byDate = useMemo(() => {
    const map = {};
    for (const b of bookings) {
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
  }, [bookings]);

  const bookingsOn = (iso) => byDate[iso] || [];
  const occupiedUnitsOn = (iso) => new Set(bookingsOn(iso).map((b) => b.zimmer_id)).size;

  const isCheckIn = (b, iso) => b.check_in === iso;
  const isCheckOut = (b, iso) => b.check_out === iso;

  const shift = (delta) => {
    const d = new Date(anchor);
    if (view === 'week') d.setDate(d.getDate() + delta * 7);else
    if (view === 'month') d.setMonth(d.getMonth() + delta);else
    d.setMonth(d.getMonth() + delta * 3);
    setAnchor(d);
  };

  const title = () => {
    if (view === 'week') {
      const start = new Date(anchor);start.setDate(anchor.getDate() - anchor.getDay());
      const end = new Date(start);end.setDate(start.getDate() + 6);
      const s = `${start.getDate()} ${HEB_MONTHS[start.getMonth()]}`;
      const e = `${end.getDate()} ${HEB_MONTHS[end.getMonth()]}${start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth() ? ' ' + end.getFullYear() : ''}`;
      return `${s} – ${e} ${start.getFullYear()}`;
    }
    if (view === 'month') return `${HEB_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    const m0 = anchor.getMonth();
    const y = anchor.getFullYear();
    const m2 = m0 + 2;
    if (m2 <= 11) return `${HEB_MONTHS[m0]} – ${HEB_MONTHS[m2]} ${y}`;
    return `${HEB_MONTHS[m0]} ${y} – ${HEB_MONTHS[m2 - 12]} ${y + 1}`;
  };

  const openManual = (dateStr) => {
    setManualDate(dateStr || selectedDate || '');
    setShowManual(true);
  };

  // --- cell renderers ---
  const renderCell = (date, opts = {}) => {
    const iso = toISO(date);
    const isToday = iso === todayISO();
    const isSelected = iso === selectedDate;
    const dayBookings = bookingsOn(iso);
    const dow = date.getDay();
    const isWeekend = dow === 5 || dow === 6;
    const compact = opts.compact;

    if (compact) {
      const occupied = occupiedUnitsOn(iso);
      return (
        <button
          key={iso}
          onClick={() => setSelectedDate(iso)}
          className={`relative aspect-square text-[11px] rounded-lg flex flex-col items-center justify-center transition-all
            ${isSelected ? 'ring-2 ring-orange-400 bg-orange-400/15' : 'hover:bg-gray-800/40'}
            ${isToday ? 'bg-[#25D366]/15' : ''}`}
          style={{ border: '1px solid #374151' }}>
          
          <span className={`font-bold ${isToday ? 'text-[#25D366]' : 'text-gray-300'}`}>{date.getDate()}</span>
          {occupied > 0 &&
          <span className="absolute -top-1.5 -left-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
          style={{ background: '#EF4444', color: '#fff' }}>
              {occupied}
            </span>
          }
        </button>);

    }

    return (
      <div
        key={iso}
        onClick={() => setSelectedDate(iso)}
        className={`p-2 border-b border-r border-gray-800 transition-colors relative flex flex-col cursor-pointer
          ${isWeekend ? 'bg-gray-950/30' : ''}
          ${isSelected ? 'ring-2 ring-inset ring-orange-400' : isToday ? 'ring-2 ring-inset ring-[#25D366]' : ''}
          ${dayBookings.length ? 'hover:bg-gray-800/40' : 'hover:bg-gray-800/20'}`}
        style={{ minHeight: view === 'week' ? 160 : 110 }}>
        
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-[#25D366] text-black' : 'text-gray-300'}`}>
            {date.getDate()}
          </span>
          <span className="text-[10px] text-gray-500 font-medium">
            {dayBookings.length === 0 ? view === 'week' ? 'פנוי' : '' : `${dayBookings.length} הזמנות`}
          </span>
        </div>
        <div className="space-y-1 flex-1">
          {dayBookings.slice(0, view === 'week' ? 6 : 2).map((b) =>
          <div
            key={b.id}
            className={`${zimmerColorMap[b.zimmer_id] || 'bg-gray-600/80'} text-white rounded-md px-1.5 py-1 leading-tight truncate`}
            title={`${b.guest_name} — ${b.zimmer_name}`}>
            
              <div className="flex items-center gap-1 truncate">
                {isCheckIn(b, iso) ? <span className="font-bold text-white/90">▶</span> :
              isCheckOut(b, iso) ? <span className="font-bold text-white/90">◀</span> : null}
                <span className="text-[11px] font-semibold truncate">{b.guest_name}</span>
              </div>
              <div className="text-[10px] opacity-90 truncate">{b.zimmer_name}</div>
              {view === 'week' &&
            <div className="text-[9px] opacity-75 truncate">{b.guest_phone}{b.status === 'אושרה' ? ' · ✓' : ' · ⏳'}</div>
            }
            </div>
          )}
          {dayBookings.length > (view === 'week' ? 6 : 2) &&
          <div className="text-[10px] text-gray-400 pr-1 pt-0.5">
              +{dayBookings.length - (view === 'week' ? 6 : 2)} נוספים
            </div>
          }
        </div>
      </div>);

  };

  const renderMonthGrid = (year, month, opts = {}) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

    if (opts.mini) {
      return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-2.5">
          <div className="text-center text-xs font-bold text-gray-200 mb-2">{HEB_MONTHS[month]}</div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {HEB_DAYS_SHORT.map((d, i) =>
            <div key={i} className={`text-center text-[9px] font-semibold ${i === 5 || i === 6 ? 'text-orange-400/70' : 'text-gray-500'}`}>{d}</div>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => date ? renderCell(date, { compact: true }) : <div key={i} />)}
          </div>
        </div>);

    }

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-950/40">
          {HEB_DAYS.map((d, i) =>
          <div key={d} className={`text-center text-xs font-semibold py-3 tracking-wide ${i === 5 || i === 6 ? 'text-orange-400/80' : 'text-gray-400'}`}>{d}</div>
          )}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => date ? renderCell(date) : <div key={i} className="min-h-[110px] border-b border-r border-gray-800 bg-gray-950/40" />)}
        </div>
      </div>);

  };

  const renderWeekGrid = () => {
    const start = new Date(anchor);start.setDate(anchor.getDate() - anchor.getDay());
    const days = Array.from({ length: 7 }, (_, i) => {const d = new Date(start);d.setDate(start.getDate() + i);return d;});
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-950/40">
          {days.map((d, i) =>
          <div key={i} className={`text-center text-xs font-semibold py-3 tracking-wide ${i === 5 || i === 6 ? 'text-orange-400/80' : 'text-gray-400'}`}>
              <span className="block opacity-70">{HEB_DAYS[i]}</span>
              <span className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] ${toISO(d) === todayISO() ? 'bg-[#25D366] text-black' : 'text-gray-300'}`}>{d.getDate()}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => renderCell(d))}
        </div>
      </div>);

  };

  const renderQuarterGrid = () => {
    const months = [0, 1, 2].map((i) => {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() + i, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {months.map(({ year, month }) =>
        <div key={`${year}-${month}`}>
            {renderMonthGrid(year, month, { mini: true })}
          </div>
        )}
      </div>);

  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-gray-700 border-t-[#25D366] rounded-full animate-spin"></div>
    </div>);


  const sel = new Date(selectedDate + 'T00:00:00');
  const selBookings = bookingsOn(selectedDate);

  return (
    <div dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl font-bold text-white">יומן הזמנות</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-1">
            {VIEWS.map((v) =>
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${view === v.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              style={view === v.id ? { background: '#F97316' } : {}}>
              
                {v.label}
              </button>
            )}
          </div>
          <button
            onClick={() => openManual(selectedDate)}
            className="flex items-center gap-1.5 text-white text-sm font-bold px-3 py-2 rounded-xl transition-all hover:opacity-90"
            style={{ background: '#F97316' }}>
            
            <Plus size={14} /> הוסף הזמנה
          </button>
          <div className="flex items-center gap-2 bg-[hsl(var(--foreground))]">
            <button onClick={() => shift(-1)} className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={18} />
            </button>
            <button onClick={() => {const d = new Date();d.setHours(0, 0, 0, 0);setAnchor(d);setSelectedDate(todayISO());}} className="px-2 h-9 rounded-xl bg-gray-800 text-gray-400 hover:text-white text-xs font-semibold transition-colors">היום</button>
            <span className="text-white font-semibold min-w-40 text-center text-sm">{title()}</span>
            <button onClick={() => shift(1)} className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      {zimmers.length > 0 && view !== 'quarter' &&
      <div className="flex flex-wrap gap-3 mb-4">
          {zimmers.map((z, i) =>
        <div key={z.id} className="flex items-center gap-1.5 text-xs text-gray-300">
              <div className={`w-3 h-3 rounded-full ${COLORS[i % COLORS.length].replace('/80', '')}`}></div>
              {z.name}
            </div>
        )}
        </div>
      }
      {view === 'quarter' &&
      <p className="text-xs text-gray-500 mb-4">מספר בכל יום = כמות יחידות תפוסות באותו יום · לחץ על יום לפרטים</p>
      }

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar — 2/3 */}
        <div className="lg:w-2/3 min-w-0">
          {view === 'week' && renderWeekGrid()}
          {view === 'month' && renderMonthGrid(anchor.getFullYear(), anchor.getMonth())}
          {view === 'quarter' && renderQuarterGrid()}
        </div>

        {/* Day details — 1/3 */}
        <div className="lg:w-1/3">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 lg:sticky lg:top-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-bold text-base">
                  {HEB_DAYS[sel.getDay()]} · {sel.getDate()} {HEB_MONTHS[sel.getMonth()]} {sel.getFullYear()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{selBookings.length === 0 ? 'יום פנוי' : `${selBookings.length} הזמנות`}</p>
              </div>
              <button
                onClick={() => openManual(selectedDate)}
                className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all hover:opacity-90"
                style={{ background: '#F97316' }}>
                
                <Plus size={13} /> הוסף
              </button>
            </div>

            {selBookings.length === 0 ?
            <div className="text-center py-10 text-gray-500 text-sm">אין הזמנות ביום זה</div> :

            selBookings.map((b) => {
              const total = getBookingTotal(b, zimmers.find((z) => z.id === b.zimmer_id));
              const iso = selectedDate;
              return (
                <div key={b.id} className="flex items-start justify-between py-3 border-b border-gray-800 last:border-0">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{b.guest_name}</p>
                      <p className="text-gray-400 text-sm">{b.guest_phone}</p>
                      <p className="text-gray-500 text-xs mt-1">{b.zimmer_name} · {b.check_in} → {b.check_out}</p>
                      {total > 0 && <p className="text-green-400 text-xs mt-1">💳 {formatILS(total)}</p>}
                      {isCheckIn(b, iso) && <span className="text-xs text-green-400 mt-1 inline-block">✓ צ'קאין היום</span>}
                      {isCheckOut(b, iso) && <span className="text-xs text-orange-400 mt-1 inline-block">↩ צ'קאאוט היום</span>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${b.status === 'אושרה' ? 'bg-green-400/10 text-green-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                      {b.status}
                    </span>
                  </div>);

            })
            }

            {/* Occupancy summary */}
            {view === 'quarter' && selBookings.length > 0 &&
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-800">
                יחידות תפוסות ביום זה: <span className="font-bold text-white">{occupiedUnitsOn(selectedDate)}</span> / {zimmers.length}
              </p>
            }
          </div>
        </div>
      </div>

      {showManual &&
      <ManualBookingForm
        zimmers={zimmers}
        ownerId={ownerId}
        initialDate={manualDate}
        onClose={() => setShowManual(false)}
        onSaved={() => {
          setShowManual(false);
          setLoading(true);
          base44.entities.BookingRequest.filter({ owner_id: ownerId }).then((data) => {
            setBookings(data.filter((b) => b.status !== 'נדחתה'));
            setLoading(false);
          });
        }}
        onSwitchToText={() => {
          setShowManual(false);
          onAddBookingText?.();
        }} />

      }
    </div>);

}