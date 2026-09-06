import React from 'react';
import { Clock, Users, LogOut, LogIn } from 'lucide-react';
import { needsAttention, isActive, isToday } from './bookingStatus';

// 4 summary cards across the top of the bookings page (Figma).
export default function BookingsSummaryCards({ bookings }) {
  const toHandle = bookings.filter(needsAttention).length;
  const activeGuests = bookings.filter(isActive).length;
  const checkoutToday = bookings.filter(b => b.status === 'אושרה' && isToday(b.check_out)).length;
  const checkinToday = bookings.filter(b => b.status === 'אושרה' && isToday(b.check_in)).length;

  const cards = [
    { label: 'הזמנות לטיפול', value: toHandle, icon: Clock, color: '#F59E0B', bg: '#FFF8E1' },
    { label: 'אורחים פעילים', value: activeGuests, icon: Users, color: '#2E7D32', bg: '#E8F5E9' },
    { label: "צ'ק אאוט להיום", value: checkoutToday, icon: LogOut, color: '#1565C0', bg: '#E3F2FD' },
    { label: "צ'ק אין להיום", value: checkinToday, icon: LogIn, color: '#6A1B9A', bg: '#F3E5F5' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="bg-white rounded-2xl p-4 sm:p-5" style={{ border: '1px solid #ECEFF1' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: c.bg }}>
                <Icon size={16} style={{ color: c.color }} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black" style={{ color: '#212121' }}>{c.value}</div>
            <div className="text-xs sm:text-sm mt-0.5" style={{ color: '#616161' }}>{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}