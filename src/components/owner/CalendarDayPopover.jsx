import React, { useState } from 'react';
import { X, Plus, Trash2, LogIn, LogOut, Phone, Ban } from 'lucide-react';
import { getBookingTotal, formatILS } from '@/lib/bookingPrice';

const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const BLOCK_REASONS = ['תחזוקה', 'שימוש פרטי', 'חופשה', 'אחר'];

export default function CalendarDayPopover({ iso, bookings, zimmers, anchorRect, zimmerFilter, onClose, onAddBooking, onDeleteBlock, onBlockDay }) {
  const [blockReason, setBlockReason] = useState('');
  const [blockZimmerId, setBlockZimmerId] = useState(zimmerFilter && zimmerFilter !== 'all' ? zimmerFilter : (zimmers[0]?.id || ''));

  const date = new Date(iso + 'T00:00:00');
  const isCheckIn = (b) => b.check_in === iso;
  const isCheckOut = (b) => b.check_out === iso;

  let left = anchorRect ? anchorRect.left : 80;
  const width = 320;
  if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
  if (left < 12) left = 12;
  const top = anchorRect ? Math.min(anchorRect.bottom + 8, window.innerHeight - 320) : 100;

  return (
    <div className="fixed inset-0 z-50" dir="rtl" onClick={onClose} style={{ background: 'rgba(0,0,0,0.25)' }}>
      <div
        className="absolute rounded-2xl shadow-2xl"
        style={{ left, top, width, background: '#fff', border: '1.5px solid #F0EEE8', fontFamily: 'Heebo, sans-serif' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1.5px solid #F0EEE8' }}>
          <div>
            <p className="font-black text-sm" style={{ color: '#1A1A1A' }}>{HEB_DAYS[date.getDay()]} · {date.getDate()} {HEB_MONTHS[date.getMonth()]} {date.getFullYear()}</p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{bookings.length === 0 ? 'יום פנוי' : `${bookings.length} רשומות`}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F8F7F4', color: '#6B7280' }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 max-h-[260px] overflow-y-auto space-y-2.5">
          {bookings.length === 0 && <p className="text-sm text-center py-6" style={{ color: '#9CA3AF' }}>אין רשומות ביום זה</p>}
          {bookings.map(b => {
            const zimmer = zimmers.find(z => z.id === b.zimmer_id);
            const total = getBookingTotal(b, zimmer);
            const isBlock = b.is_block || b.status === 'חסום';
            if (isBlock) {
              return (
                <div key={b.id} className="rounded-xl p-3" style={{ background: '#F0EDE8', border: '1.5px solid #E0DBD2' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1" style={{ background: '#9CA3AF', color: '#fff' }}>חסום</span>
                      <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{b.block_reason || 'חסום'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{b.zimmer_name} · {b.check_in} → {b.check_out}</p>
                    </div>
                    <button onClick={() => onDeleteBlock?.(b)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={b.id} className="rounded-xl p-3" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{b.guest_name}</p>
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#6B7280' }}><Phone size={10} /> {b.guest_phone || '—'}</p>
                    <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{b.zimmer_name} · {b.check_in} → {b.check_out}</p>
                    {total > 0 && <p className="text-xs mt-1 font-semibold" style={{ color: '#16A34A' }}>{formatILS(total)}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      {isCheckIn(b) && <span className="text-[10px] font-bold flex items-center gap-0.5" style={{ color: '#16A34A' }}><LogIn size={10} /> צ'קאין</span>}
                      {isCheckOut(b) && <span className="text-[10px] font-bold flex items-center gap-0.5" style={{ color: '#EA580C' }}><LogOut size={10} /> צ'קאאוט</span>}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                    style={b.status === 'אושרה' ? { background: '#DCFCE7', color: '#16A34A' } : { background: '#FEF3C7', color: '#92400E' }}>
                    {b.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 space-y-2.5" style={{ borderTop: '1.5px solid #F0EEE8' }}>
          <button onClick={() => onAddBooking?.(iso)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90" style={{ background: '#F97316' }}>
            <Plus size={15} /> הוסף הזמנה ליום זה
          </button>

          {/* Block this day */}
          <div className="rounded-xl p-3" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Ban size={14} style={{ color: '#6B7280' }} />
              <p className="text-xs font-bold" style={{ color: '#1A1A1A' }}>חסימת יום זה</p>
            </div>

            {zimmerFilter === 'all' && zimmers.length > 1 && (
              <select value={blockZimmerId} onChange={e => setBlockZimmerId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg mb-2 outline-none" style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}>
                {zimmers.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            )}

            <div className="flex flex-wrap gap-1.5 mb-2">
              {BLOCK_REASONS.map(r => (
                <button key={r} type="button" onClick={() => setBlockReason(blockReason === r ? '' : r)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={blockReason === r ? { background: '#0B1B2A', color: '#fff' } : { background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
                  {r}
                </button>
              ))}
            </div>

            <p className="text-[10px] mb-2" style={{ color: '#9CA3AF' }}>אם לא תבחר סיבה — ירשם "חסום" בלבד.</p>

            <button onClick={() => onBlockDay?.({ zimmerId: blockZimmerId, reason: blockReason })} disabled={!blockZimmerId} type="button"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-white text-xs font-bold transition-all disabled:opacity-50" style={{ background: '#0B1B2A' }}>
              <Ban size={13} /> חסום יום זה
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}