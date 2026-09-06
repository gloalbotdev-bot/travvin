import React from 'react';
import { needsAttention, isUpcoming, isActive, isPast } from './bookingStatus';

// Tab strip with live counts (Figma).
export default function BookingsTabs({ active, onChange, bookings }) {
  const all = bookings.length;
  const upcoming = bookings.filter(isUpcoming).length;
  const activeNow = bookings.filter(isActive).length;
  const attention = bookings.filter(needsAttention).length;
  const old = bookings.filter(isPast).length;

  const tabs = [
    { id: 'all', label: 'הכול', count: all },
    { id: 'upcoming', label: 'הזמנות קרובות', count: upcoming },
    { id: 'active', label: 'הזמנות פעילות', count: activeNow },
    { id: 'attention', label: 'דורש טיפול', count: attention, danger: true },
    { id: 'old', label: 'הזמנות ישנות', count: old },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1" dir="rtl">
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors"
            style={on
              ? { color: t.danger ? '#E53935' : '#212121', background: t.danger ? '#FFEBEE' : '#F5F5F5' }
              : { color: '#616161' }}>
            <span>{t.label}</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={on
                ? { background: t.danger ? '#E53935' : '#212121', color: '#fff' }
                : { background: '#ECEFF1', color: '#616161' }}>
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}