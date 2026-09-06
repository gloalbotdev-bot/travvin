import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { statusDisplay, nightsBetween, formatRange } from './bookingStatus';
import { getBookingTotal, formatILS } from '@/lib/bookingPrice';

// Single table row (desktop). Mobile collapses to a card via BookingsTable.
export default function BookingRow({ booking, zimmer, onView, onMore }) {
  const st = statusDisplay(booking);
  const total = getBookingTotal(booking, zimmer);
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const img = zimmer?.images?.[0];

  return (
    <tr className="hover:bg-gray-50 transition-colors" style={{ borderBottom: '1px solid #F5F5F5' }}>
      {/* Thumbnail + name + guest + location */}
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ background: '#F5F5F5' }}>
            {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : null}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate" style={{ color: '#212121' }}>{booking.zimmer_name || zimmer?.name}</div>
            <div className="text-xs truncate" style={{ color: '#757575' }}>{booking.guest_name}</div>
            <div className="text-xs truncate" style={{ color: '#9e9e9e' }}>{zimmer?.location || ''}</div>
          </div>
        </div>
      </td>
      <td className="py-3 text-sm" style={{ color: '#424242' }}>{formatRange(booking.check_in, booking.check_out)}</td>
      <td className="py-3 text-sm" style={{ color: '#424242' }}>{nights} לילות</td>
      <td className="py-3 text-sm" style={{ color: '#424242' }}>{booking.num_guests || 1}</td>
      <td className="py-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
          {st.label}
        </span>
      </td>
      <td className="py-3">
        <div className="font-bold text-sm" style={{ color: '#212121' }}>{formatILS(total)}</div>
        <div className="text-xs" style={{ color: '#9e9e9e' }}>סה"כ לתשלום</div>
      </td>
      <td className="py-3 pl-4">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onView(booking)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white whitespace-nowrap"
            style={{ background: '#263238' }}>
            צפייה בהזמנה
          </button>
          <button onClick={() => onMore(booking)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: '#616161' }}>
            <MoreHorizontal size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}