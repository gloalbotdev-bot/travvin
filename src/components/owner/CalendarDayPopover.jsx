import React from 'react';
import { getBookingTotal, formatILS } from '@/lib/bookingPrice';
import { bookingNumber, figmaStatus, nightsBetween, nightsLabel, guestsLabel } from '@/components/owner/bookings/bookingStatus';
import iconUsers from '@/assets/owner/calendar/drawer-users.svg';
import iconHouse from '@/assets/owner/calendar/drawer-house.svg';
import iconInfo from '@/assets/owner/calendar/drawer-info.svg';
import iconCard from '@/assets/owner/calendar/drawer-card.svg';
import iconBlocked from '@/assets/owner/calendar/blocked.svg';

const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const INK = '#0B3838';
const GRAY = '#717171';
export const DRAWER_WIDTH = 380;

const longDate = (iso, time) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ב${HEB_MONTHS[d.getMonth()]} ${d.getFullYear()}${time ? ` ${time}` : ''}`;
};

function guestsText(b) {
  const children = Number(b.num_children) || 0;
  const adults = Number(b.num_adults) || (Number(b.num_guests) || 0) - children;
  if (!adults && !children) return '';
  return children ? `${guestsLabel(adults)}, ${children === 1 ? 'ילד אחד' : `${children} ילדים`}` : guestsLabel(adults);
}

function DetailRow({ icon, children }) {
  return (
    <div className="flex items-center" style={{ minHeight: 34, padding: 8, gap: 12 }}>
      <img src={icon} alt="" width={18} height={18} className="block flex-shrink-0" />
      <div className="flex-1 min-w-0 flex items-center justify-between font-simona" style={{ color: INK, fontSize: 15, gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

/** Figma 1776:19685 — booking details card shown next to a day that has records. */
export default function CalendarDayPopover({ bookings, zimmers, left, top, className = '', onDeleteBlock, onOpenBooking }) {
  return (
    <div
      dir="rtl"
      role="dialog"
      aria-label="פרטי הזמנה"
      className={`fixed z-[55] flex flex-col ${className}`}
      style={{
        left,
        top,
        width: DRAWER_WIDTH,
        maxHeight: 'calc(100dvh - 24px)',
        overflowY: 'auto',
        background: '#fff',
        border: `1px solid ${INK}`,
        borderRadius: 9,
        boxShadow: '-4px 0px 16px rgba(0,0,0,0.1)',
        padding: '32px 32px 0',
      }}
    >
      {bookings.map((b, i) => {
        const isBlock = b.is_block || b.status === 'חסום';
        const zimmer = zimmers.find((z) => z.id === b.zimmer_id);
        const zName = b.zimmer_name || zimmer?.name || '';
        const divider = i > 0 && <div style={{ height: 1, background: '#EFEFEF', margin: '0 0 24px' }} />;

        if (isBlock) {
          return (
            <React.Fragment key={b.id}>
              {divider}
              <section className="flex flex-col" style={{ gap: 12, paddingBottom: 24 }}>
                <div className="flex items-center" style={{ gap: 6 }}>
                  <img src={iconBlocked} alt="" width={12} height={12} className="block" />
                  <span className="font-simona" style={{ color: GRAY, fontSize: 18 }}>תאריך חסום</span>
                </div>
                <p className="font-simpler" style={{ color: INK, fontSize: 22, fontWeight: 600 }}>{b.block_reason || 'חסום'}</p>
                <DetailRow icon={iconHouse}><span className="truncate">{zName}</span></DetailRow>
                <div style={{ height: 1, background: '#EFEFEF' }} />
                <button
                  type="button"
                  onClick={() => onDeleteBlock?.(b)}
                  className="font-simona self-start transition-opacity hover:opacity-80"
                  style={{ height: 41, padding: '0 24px', borderRadius: 35, border: '1px solid rgba(11,56,56,0.2)', color: INK, fontSize: 16, fontWeight: 500 }}
                >
                  ביטול החסימה
                </button>
              </section>
            </React.Fragment>
          );
        }

        const status = figmaStatus(b);
        const nights = nightsBetween(b.check_in, b.check_out);
        const guests = guestsText(b);
        const total = getBookingTotal(b, zimmer);

        return (
          <React.Fragment key={b.id}>
            {divider}
            <section className="flex flex-col" style={{ gap: 12, paddingBottom: 24 }}>
              <div className="flex items-center justify-between" style={{ gap: 25 }}>
                <span className="font-simona" style={{ color: GRAY, fontSize: 18 }}>הזמנה #{bookingNumber(b)}</span>
                <span className="font-simona" style={{ background: '#D9F3F9', borderRadius: 4, padding: '4px 8px', color: INK, fontSize: 12, fontWeight: 700 }}>הזמנה</span>
              </div>
              <p className="font-simpler" style={{ color: INK, fontSize: 22, fontWeight: 600, lineHeight: 'normal' }}>{b.guest_name || 'אורח'}</p>
              <p className="font-simona" style={{ color: INK, fontSize: 14, padding: '8px 0' }}>
                {longDate(b.check_in, b.check_in_time)} - {longDate(b.check_out, b.check_out_time)}
              </p>
              <div className="flex flex-col">
                <DetailRow icon={iconUsers}>
                  <span className="truncate">{[nightsLabel(nights), guests].filter(Boolean).join(' · ')}</span>
                </DetailRow>
                <DetailRow icon={iconHouse}><span className="truncate">{zName}</span></DetailRow>
                <DetailRow icon={iconInfo}>
                  <span>סטטוס</span>
                  <span className="font-simona" style={{ background: status.bg, borderRadius: 999, padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>{status.label}</span>
                </DetailRow>
                {total > 0 && (
                  <DetailRow icon={iconCard}>
                    <span style={{ fontWeight: 500 }}>סה״כ</span>
                    <span style={{ fontSize: 14 }}>{formatILS(total)}</span>
                  </DetailRow>
                )}
              </div>
              <div style={{ height: 1, background: '#EFEFEF' }} />
              <button
                type="button"
                onClick={() => onOpenBooking?.(b)}
                className="font-simona self-start transition-colors duration-300 ease-out hover:!bg-[#0B3838] hover:!text-[#F5F5F5] hover:!border-[#0B3838] focus-visible:!bg-[#0B3838] focus-visible:!text-[#F5F5F5]"
                style={{ width: 172, height: 41, borderRadius: 35, border: '1px solid rgba(11,56,56,0.2)', color: INK, fontSize: 16, fontWeight: 500 }}
              >
                פתח הזמנה
              </button>
            </section>
          </React.Fragment>
        );
      })}
    </div>
  );
}
