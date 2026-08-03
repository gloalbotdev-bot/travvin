import React, { useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { addDays } from 'date-fns';
import { he } from 'date-fns/locale';

const toISO = (d) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// Disabled matcher list: past days + each booking's occupied nights [check_in, check_out)
// (checkout day itself stays selectable so same-day turnover on departure is allowed).
export default function BookingDatePicker({ bookedRanges = [], checkIn, checkOut, onChange }) {
  const range = useMemo(() => {
    if (!checkIn) return undefined;
    if (!checkOut) return { from: new Date(checkIn) };
    return { from: new Date(checkIn), to: new Date(checkOut) };
  }, [checkIn, checkOut]);

  const disabled = useMemo(() => {
    const list = [{ before: startOfToday() }];
    bookedRanges.forEach(r => {
      if (!r.check_in || !r.check_out) return;
      const ci = new Date(r.check_in); ci.setHours(0, 0, 0, 0);
      const last = new Date(r.check_out); last.setDate(last.getDate() - 1); last.setHours(0, 0, 0, 0);
      list.push(last.getTime() < ci.getTime() ? { from: ci, to: ci } : { from: ci, to: last });
    });
    return list;
  }, [bookedRanges]);

  const isBookedNight = (day) => {
    const t = new Date(day); t.setHours(0, 0, 0, 0);
    const ts = t.getTime();
    return bookedRanges.some(r => {
      if (!r.check_in || !r.check_out) return false;
      const ci = new Date(r.check_in); ci.setHours(0, 0, 0, 0);
      const co = new Date(r.check_out); co.setHours(0, 0, 0, 0);
      return ts >= ci.getTime() && ts < co.getTime();
    });
  };

  const handleSelect = (selected) => {
    if (!selected || !selected.from) { onChange({ check_in: '', check_out: '' }); return; }
    const from = selected.from;
    if (selected.to) {
      const to = selected.to;
      if (to.getTime() <= from.getTime()) { onChange({ check_in: toISO(from), check_out: '' }); return; }
      // Backstop: reject any range that spans an occupied night
      let d = new Date(from);
      while (d.getTime() < to.getTime()) {
        if (isBookedNight(d)) { onChange({ check_in: toISO(from), check_out: '' }); return; }
        d = addDays(d, 1);
      }
      onChange({ check_in: toISO(from), check_out: toISO(to) });
    } else {
      onChange({ check_in: toISO(from), check_out: '' });
    }
  };

  return (
    <div dir="rtl" className="flex flex-col items-center">
      <Calendar
        mode="range"
        numberOfMonths={1}
        selected={range}
        onSelect={handleSelect}
        disabled={disabled}
        dir="rtl"
        locale={he}
      />
      <div className="text-xs text-gray-500 mt-1 text-center">
        {checkOut
          ? `כניסה ${checkIn} · יציאה ${checkOut}`
          : checkIn
            ? `כניסה ${checkIn} — בחר תאריך יציאה`
            : 'בחר תאריכים (הימים התפוסים מבוטלים)'}
      </div>
    </div>
  );
}