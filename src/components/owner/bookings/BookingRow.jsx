import React from 'react';
import { figmaStatus, needsAttention, nightsBetween, formatRangeLong, nightsLabel, guestsLabel, bookingNumber } from './bookingStatus';
import { getBookingTotal, formatILS } from '@/lib/bookingPrice';
import iconAmount from '@/assets/owner/bookings/icon-amount.svg';
import iconProperty from '@/assets/owner/bookings/icon-property.svg';
import iconGuests from '@/assets/owner/bookings/icon-guests.svg';
import iconHouse from '@/assets/owner/bookings/icon-house.svg';
import iconUserRound from '@/assets/owner/bookings/icon-user-round.svg';

const TEXT = '#0B3838';

function Divider() {
  return <div className="flex-shrink-0" style={{ width: 1, height: 48, background: '#EFEFEF' }} aria-hidden />;
}

function DetailLine({ icon, children }) {
  return (
    <div className="flex items-center w-full" style={{ gap: 12 }}>
      <img src={icon} alt="" width={18} height={18} className="block flex-shrink-0" style={{ width: 18, height: 18 }} />
      <p className="font-simona flex-1 min-w-0 truncate text-right" style={{ color: TEXT, fontSize: 15, fontWeight: 400, lineHeight: 'normal' }} dir="auto">
        {children}
      </p>
    </div>
  );
}

// Desktop booking card row (Figma 1776:19981).
export default function BookingRow({ booking, zimmer, onView }) {
  const st = figmaStatus(booking);
  const total = getBookingTotal(booking, zimmer);
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const img = zimmer?.images?.[0];
  const propertyName = booking.zimmer_name || zimmer?.name || '';
  const isBlock = booking.status === 'חסום' || booking.is_block;

  return (
    <div
      className="bg-white flex items-center justify-between overflow-hidden flex-shrink-0"
      style={{ width: 1145, height: 112, padding: '24px 33px', borderRadius: 9, boxShadow: '0px 0px 16px 0px rgba(0,0,0,0.1)' }}
      dir="rtl"
    >
      {/* Property + guest preview */}
      <div className="relative flex-shrink-0" style={{ width: 83, height: 64 }}>
        {img ? (
          <img
            src={img}
            alt=""
            className="absolute object-cover"
            style={{ right: 0, top: 0, width: 72.34, height: 63.43, borderRadius: 9.51, border: '0.793px solid #E5E7EB' }}
          />
        ) : (
          <div className="absolute flex items-center justify-center overflow-hidden" style={{ right: 0, top: 0, width: 72.34, height: 63.43, borderRadius: 9.51, background: '#FAFAFA' }}>
            <img src={iconHouse} alt="" width={27} height={27} className="block" style={{ width: 27, height: 27 }} />
          </div>
        )}
        <div
          className="absolute flex items-center justify-center overflow-hidden rounded-full"
          style={{ left: 0, top: 18, width: 46, height: 46, background: '#EFEFEF', border: '1.89px solid #FFFFFF' }}
        >
          <img src={iconUserRound} alt="" width={23} height={23} className="block" style={{ width: 23, height: 23 }} />
        </div>
      </div>

      <Divider />

      {/* Reservation identity */}
      <div className="flex flex-col items-start flex-shrink-0 overflow-hidden" style={{ width: 210, gap: 3 }}>
        <div className="flex items-center justify-between w-full" style={{ height: 25 }}>
          <span className="font-simona" style={{ background: '#D9F3F9', color: TEXT, fontSize: 12, fontWeight: 700, lineHeight: 'normal', padding: '4px 8px', borderRadius: 4 }}>
            {isBlock ? 'חסימה' : 'הזמנה'}
          </span>
          <span className="font-simona whitespace-nowrap" style={{ color: '#717171', fontSize: 18, fontWeight: 400, lineHeight: 'normal' }} dir="auto">
            הזמנה #{bookingNumber(booking)}
          </span>
        </div>
        <div className="flex items-center w-full" style={{ height: 30 }}>
          <p className="font-simona truncate text-right w-full" style={{ color: TEXT, fontSize: 22, fontWeight: 500, lineHeight: 'normal' }} dir="auto">
            {booking.guest_name || (isBlock ? 'חסימת תאריכים' : '')}
          </p>
        </div>
      </div>

      <Divider />

      {/* Stay details */}
      <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 190, gap: 8 }}>
        <DetailLine icon={iconProperty}>{propertyName} · {formatRangeLong(booking.check_in, booking.check_out)}</DetailLine>
        <DetailLine icon={iconGuests}>{nightsLabel(nights)} · {guestsLabel(booking.num_guests || 1)}</DetailLine>
      </div>

      <Divider />

      {/* Status */}
      <div className="flex flex-col items-center flex-shrink-0 overflow-hidden" style={{ width: 200, gap: 8 }}>
        <span className="font-simona whitespace-nowrap" style={{ background: st.bg, color: TEXT, fontSize: 13, fontWeight: 700, lineHeight: 'normal', padding: '4px 10px', borderRadius: 999 }} dir="auto">
          {st.label}
        </span>
        {st.sub && (
          <p className="font-simona w-full truncate text-center" style={{ color: TEXT, fontSize: 14, fontWeight: 500, lineHeight: 'normal' }} dir="auto">
            {st.sub}
          </p>
        )}
      </div>

      <Divider />

      {/* Payment */}
      <div className="flex flex-col items-start flex-shrink-0 overflow-hidden" style={{ width: 100 }}>
        <div className="flex items-center" style={{ gap: 12 }}>
          <img src={iconAmount} alt="" width={18} height={18} className="block flex-shrink-0" style={{ width: 18, height: 18 }} />
          <span className="font-simona whitespace-nowrap" style={{ color: TEXT, fontSize: 15, fontWeight: 500, lineHeight: 'normal' }}>
            {formatILS(total)}
          </span>
        </div>
      </div>

      <Divider />

      {/* Action */}
      <div className="relative flex-shrink-0" style={{ width: 166, height: 41 }}>
        <button
          type="button"
          onClick={() => onView(booking)}
          className="font-simona w-full h-full flex items-center justify-center transition-colors hover:bg-[#FAFAFA]"
          style={{ border: '1px solid #CCD8D8', borderRadius: 35, color: TEXT, fontSize: 16, fontWeight: 700, lineHeight: 'normal' }}
        >
          פתח הזמנה
        </button>
        {needsAttention(booking) && (
          <span className="absolute rounded-full pointer-events-none" style={{ left: 0, top: 0, width: 11.58, height: 11.58, background: '#FFFF00' }} aria-label="דורש טיפול" />
        )}
      </div>
    </div>
  );
}
