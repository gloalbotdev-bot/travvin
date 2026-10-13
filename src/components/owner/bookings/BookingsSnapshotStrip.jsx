import React, { useEffect, useState } from 'react';
import ZimmerSelector from './ZimmerSelector';
import { needsAttention, isActive, isToday } from './bookingStatus';
import statCheckin from '@/assets/owner/bookings/stat-checkin.svg';
import statPending from '@/assets/owner/bookings/stat-pending.svg';
import statCheckout from '@/assets/owner/bookings/stat-checkout.svg';
import statUsers from '@/assets/owner/bookings/stat-users.svg';
import iconIncrease from '@/assets/owner/today/increase.svg';

const DWELL_MS = 4000;
const shekel = (n) => `₪${Math.round(Math.abs(n)).toLocaleString('he-IL')}`;

/* Figma Frame 48099164 (1776:15338 / 15340 / 15366) — rotating month stat: occupancy → revenue → nights */
function StatRotatorCard({ stats }) {
  const slides = [
    stats.occupancy?.current != null && {
      key: 'occupancy', value: `${stats.occupancy.current}%`, label: ['תפוסה', 'החודש'],
      delta: stats.occupancy.delta, deltaText: `${Math.abs(stats.occupancy.delta ?? 0)}%`, badge: '#FFCEFF', padLeft: 55,
    },
    stats.revenue && {
      key: 'revenue', value: shekel(stats.revenue.current), label: ['הכנסות', 'החודש'],
      delta: stats.revenue.delta, deltaText: shekel(stats.revenue.delta ?? 0), badge: '#AAEFFD', padLeft: 10,
    },
    stats.nights && {
      key: 'nights', value: String(stats.nights.current), label: ['לילות הוזמנו', 'החודש'],
      delta: stats.nights.delta, deltaText: `${Math.abs(stats.nights.delta ?? 0)} לילות`, badge: '#FFFF00', padLeft: 57,
    },
  ].filter(Boolean);

  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), DWELL_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  const s = slides[index % Math.max(1, slides.length)];
  if (!s) return null;

  return (
    <div
      className="hidden min-[1360px]:block relative flex-shrink-0 overflow-hidden"
      style={{ width: 290, height: 50, background: '#FAFAFA', borderRadius: 13 }}
      aria-live="polite"
    >
      <div
        key={s.key}
        className="owner-stat-in absolute inset-0 flex items-center justify-between"
        style={{ padding: `0 18px 0 ${s.padLeft}px` }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <span className="font-simona text-right whitespace-nowrap" style={{ color: '#0B3838', fontSize: 14, lineHeight: '14px' }}>
            {s.label[0]}<br />{s.label[1]}
          </span>
          <span className="font-simpler whitespace-nowrap" style={{ color: '#0B3838', fontSize: 24, fontWeight: 600, lineHeight: '48px' }}>
            {s.value}
          </span>
        </div>
        {s.delta != null && s.delta !== 0 && (
          <div className="flex flex-col items-start" style={{ width: 82, gap: 0 }}>
            <span
              className="inline-flex items-center font-simona whitespace-nowrap"
              style={{ height: 14, background: s.badge, borderRadius: 13.15, padding: '0 6.575px', gap: 2, fontSize: 13.21, lineHeight: 1.2, color: '#0B3838' }}
            >
              {s.deltaText}
              <img src={iconIncrease} alt="" width={7} height={9} className="block" style={s.delta < 0 ? { transform: 'rotate(180deg)' } : undefined} />
            </span>
            <span className="font-simona whitespace-nowrap" style={{ color: '#0B3838', fontSize: 13.21, lineHeight: 1.2 }}>מהחודש שעבר</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Desktop "תמונת מצב" strip under the top bar (Bookings 1776:20360, Today 1776:18313).
export default function BookingsSnapshotStrip({
  bookings,
  zimmers,
  zimmerFilter,
  onZimmerFilter,
  values,
  offsetLeft = 109.4,
  titleGap = 0,
  numberColor = '#101828',
  stats,
}) {
  const list = zimmerFilter === 'all' ? bookings : bookings.filter(b => b.zimmer_id === zimmerFilter);

  const cards = [
    { key: 'checkin', label: "צ'ק אין להיום", value: values?.checkin ?? list.filter(b => b.status === 'אושרה' && isToday(b.check_in)).length, icon: statCheckin },
    { key: 'pending', label: 'הזמנות לטיפול', value: values?.pending ?? list.filter(needsAttention).length, icon: statPending },
    { key: 'checkout', label: 'צ’ק אאוט להיום', value: values?.checkout ?? list.filter(b => b.status === 'אושרה' && isToday(b.check_out)).length, icon: statCheckout },
    { key: 'active', label: 'אורחים פעילים', value: values?.active ?? list.filter(isActive).length, icon: statUsers },
  ];

  return (
    <section
      className="relative z-10 bg-white flex-shrink-0"
      style={{ height: 70, borderRadius: '0 0 23px 23px', boxShadow: '0px 4px 21.1px 0px rgba(0,0,0,0.07)' }}
      dir="rtl"
      aria-label="תמונת מצב"
    >
      {/* Figma group is centered 54.7px right of the page center */}
      <div className="flex justify-center h-full" style={{ paddingLeft: offsetLeft, paddingTop: 13.6 }}>
        <div className="flex items-start" style={{ gap: titleGap }}>
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
                  style={{ color: numberColor, fontSize: 25, fontWeight: 600, lineHeight: '27.7px', marginRight: 7.7, top: 3 }}
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
            {stats && <StatRotatorCard stats={stats} />}
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
