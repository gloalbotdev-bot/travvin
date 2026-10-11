import React from 'react';
import BookingRow from './BookingRow';
import { statusDisplay, nightsBetween, formatRange } from './bookingStatus';
import { getBookingTotal, formatILS } from '@/lib/bookingPrice';
import { Eye } from 'lucide-react';

// Desktop table + mobile card list (Figma table with responsive collapse).
export default function BookingsTable({ bookings, zimmers, onView, emptyText }) {
  const zimmerMap = React.useMemo(() => Object.fromEntries(zimmers.map(z => [z.id, z])), [zimmers]);

  if (bookings.length === 0) {
    return (
      <>
        <div className="lg:hidden bg-white rounded-2xl p-12 text-center" style={{ border: '1px solid #ECEFF1' }}>
          <p className="text-sm" style={{ color: '#9e9e9e' }}>{emptyText || 'אין הזמנות בקטגוריה זו'}</p>
        </div>
        <div className="hidden lg:block text-center font-simona" style={{ width: 1145, maxWidth: '100%', padding: '48px 0', background: '#FAFAFA', borderRadius: 23 }}>
          <p style={{ color: '#717171', fontSize: 16 }}>{emptyText || 'אין הזמנות בקטגוריה זו'}</p>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop card rows (Figma 1776:19980) */}
      <div className="hidden lg:block overflow-x-auto" style={{ margin: '-16px', padding: 16 }} dir="rtl">
        <div className="flex flex-col" style={{ gap: 16, width: 1145, marginRight: 6 }}>
          {bookings.map(b => (
            <BookingRow key={b.id} booking={b} zimmer={zimmerMap[b.zimmer_id]} onView={onView} />
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {bookings.map(b => {
          const z = zimmerMap[b.zimmer_id];
          const st = statusDisplay(b);
          const total = getBookingTotal(b, z);
          const img = z?.images?.[0];
          return (
            <div key={b.id} className="bg-white rounded-2xl p-4" style={{ border: '1px solid #ECEFF1' }}>
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0" style={{ background: '#F5F5F5' }}>
                  {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: '#212121' }}>{b.zimmer_name || z?.name}</div>
                  <div className="text-xs truncate" style={{ color: '#757575' }}>{b.guest_name}</div>
                  <div className="text-xs truncate" style={{ color: '#9e9e9e' }}>{z?.location}</div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full h-fit" style={{ background: st.bg, color: st.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />{st.label}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs" style={{ color: '#616161' }}>
                <span>{formatRange(b.check_in, b.check_out)} · {nightsBetween(b.check_in, b.check_out)} לילות</span>
                <span>👥 {b.num_guests || 1}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="font-bold" style={{ color: '#212121' }}>{formatILS(total)}</div>
                <button onClick={() => onView(b)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: '#263238' }}>
                  <Eye size={13} /> צפייה
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}