import React from 'react';
import ZimmerSelector from './ZimmerSelector';
import { needsAttention, isActive, isToday } from './bookingStatus';
import statCheckin from '@/assets/owner/bookings/stat-checkin.svg';
import statPending from '@/assets/owner/bookings/stat-pending.svg';
import statCheckout from '@/assets/owner/bookings/stat-checkout.svg';
import statUsers from '@/assets/owner/bookings/stat-users.svg';

// Desktop "תמונת מצב" strip under the top bar (Figma 1776:20360).
export default function BookingsSnapshotStrip({ bookings, zimmers, zimmerFilter, onZimmerFilter }) {
  const list = zimmerFilter === 'all' ? bookings : bookings.filter(b => b.zimmer_id === zimmerFilter);

  const cards = [
    { key: 'checkin', label: "צ'ק אין להיום", value: list.filter(b => b.status === 'אושרה' && isToday(b.check_in)).length, icon: statCheckin },
    { key: 'pending', label: 'הזמנות לטיפול', value: list.filter(needsAttention).length, icon: statPending },
    { key: 'checkout', label: 'צ’ק אאוט להיום', value: list.filter(b => b.status === 'אושרה' && isToday(b.check_out)).length, icon: statCheckout },
    { key: 'active', label: 'אורחים פעילים', value: list.filter(isActive).length, icon: statUsers },
  ];

  return (
    <section
      className="relative bg-white flex-shrink-0"
      style={{ height: 70, borderRadius: '0 0 23px 23px', boxShadow: '0px 4px 21.1px 0px rgba(0,0,0,0.07)' }}
      dir="rtl"
      aria-label="תמונת מצב"
    >
      {/* Figma group is centered 54.7px right of the page center */}
      <div className="flex justify-center h-full" style={{ paddingLeft: 109.4, paddingTop: 13.6 }}>
        <div className="flex items-start">
          <div className="flex flex-col items-start" style={{ width: 166, paddingTop: 5 }}>
            <h2 className="font-simpler w-full text-right" style={{ color: '#0B3838', fontSize: 20, fontWeight: 400, lineHeight: 'normal' }}>
              תמונת מצב
            </h2>
            <div style={{ marginTop: 3 }}>
              <ZimmerSelector zimmers={zimmers} value={zimmerFilter} onChange={onZimmerFilter} variant="snapshot" />
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 16 }}>
            {cards.map(c => (
              <div key={c.key} className="flex items-center justify-center rounded-[8px]" style={{ width: 179, height: 50, padding: '12px 12px 14.6px' }}>
                <img src={c.icon} alt="" width={29} height={29} className="block flex-shrink-0" style={{ width: 28.4, height: 28.4 }} />
                <span
                  className="font-simpler text-right relative"
                  style={{ color: '#101828', fontSize: 25, fontWeight: 600, lineHeight: '27.7px', marginRight: 7.7, top: 3 }}
                >
                  {c.value}
                </span>
                <span
                  className="font-simona text-right whitespace-nowrap"
                  style={{ color: '#0B3838', fontSize: 14, fontWeight: 400, lineHeight: '18px', marginRight: 13.4 }}
                >
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        className="absolute rounded-[29px]"
        style={{ width: 114.17, height: 3.11, background: '#E8E8E8', bottom: -1.6, left: '50%', transform: 'translateX(-50%)' }}
        aria-hidden
      />
    </section>
  );
}
