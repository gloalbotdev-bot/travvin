import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';

const DAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const toISO = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Compact availability grid for the next ~6 weeks. Booked days come from approved
// BookingRequests for this zimmer. Sunday-anchored, RTL.
export default function MiniAvailabilityCalendar({ zimmerId, weeks = 6 }) {
  const [booked, setBooked] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const bookings = await api.entities.BookingRequest.filter({ zimmer_id: zimmerId, status: 'אושרה' });
        const set = new Set();
        for (const b of bookings) {
          if (!b.check_in || !b.check_out) continue;
          let cur = new Date(b.check_in + 'T00:00:00');
          const out = new Date(b.check_out + 'T00:00:00');
          while (cur < out) { set.add(toISO(cur)); cur = new Date(cur.getTime() + 86400000); }
        }
        if (active) setBooked(set);
      } catch { /* silent */ }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [zimmerId]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = today.getDay();
  const gridStart = new Date(today.getTime() - startDay * 86400000);
  const totalDays = weeks * 7;
  const days = [];
  for (let i = 0; i < totalDays; i++) {
    days.push(new Date(gridStart.getTime() + i * 86400000));
  }

  return (
    <div dir="rtl" className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#0B3838' }}>זמינות · {weeks} שבועות קרובים</h3>
        <div className="flex items-center gap-2 text-[10px]" style={{ color: '#6B7280' }}>
          <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#FFFF00', border: '1px solid #E0DA1A' }} />פנוי</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#0B3838' }} />תפוס</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {DAY_LABELS.map((d, i) => <div key={i} className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const iso = toISO(d);
          const past = d < today;
          const isBooked = booked.has(iso);
          let style;
          if (past) style = { background: '#F0EEE8', color: '#C9C5BE' };
          else if (isBooked) style = { background: '#0B3838', color: '#fff' };
          else style = { background: '#FFFF00', color: '#1A1A1A' };
          return (
            <div key={i} className="aspect-square rounded-lg flex items-center justify-center text-[10px] font-semibold" style={style}>
              {d.getDate()}
            </div>
          );
        })}
      </div>
      {loading && <p className="text-[10px] mt-2" style={{ color: '#9CA3AF' }}>טוען זמינות…</p>}
    </div>
  );
}