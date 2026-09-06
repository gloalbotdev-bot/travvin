import React, { useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { addDays, isBefore, isAfter } from 'date-fns';
import { he } from 'date-fns/locale';

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/**
 * Single shared calendar range-picker: click a start date, immediately move
 * to end-date selection with a live highlighted/dimmed range preview.
 *
 * Props:
 *  - start: ISO string ('YYYY-MM-DD') or ''
 *  - end:   ISO string or ''
 *  - onChange(start, end): callback
 *  - min:   ISO string — earliest selectable day (inclusive)
 *  - max:   ISO string — latest selectable day (inclusive)
 *  - disabledRanges: [{ start, end }] — occupied nights; start inclusive, end exclusive
 *      (the checkout morning stays selectable so same-day turnover is allowed)
 *  - allowPast: boolean — when true, past days are selectable (default false)
 *  - numberOfMonths: number (default 1)
 */
export default function DateRangePicker({ start, end, onChange, min, max, disabledRanges = [], allowPast = false, numberOfMonths = 1 }) {
  const range = useMemo(() => {
    if (!start) return undefined;
    if (!end) return { from: new Date(start) };
    return { from: new Date(start), to: new Date(end) };
  }, [start, end]);

  const disabled = useMemo(() => {
    const list = [];
    if (!allowPast) list.push({ before: startOfToday() });
    if (min) list.push({ before: new Date(min) });
    if (max) {
      // 'after' disables strictly after the given date → max stays selectable
      list.push({ after: new Date(max) });
    }
    disabledRanges.forEach(r => {
      if (!r?.start || !r?.end) return;
      const ci = new Date(r.start); ci.setHours(0, 0, 0, 0);
      const last = new Date(r.end); last.setDate(last.getDate() - 1); last.setHours(0, 0, 0, 0);
      list.push(last.getTime() < ci.getTime() ? { from: ci, to: ci } : { from: ci, to: last });
    });
    return list;
  }, [min, max, disabledRanges, allowPast]);

  const isOccupied = (day) => {
    const t = new Date(day); t.setHours(0, 0, 0, 0);
    const ts = t.getTime();
    return disabledRanges.some(r => {
      if (!r?.start || !r?.end) return false;
      const ci = new Date(r.start); ci.setHours(0, 0, 0, 0);
      const co = new Date(r.end); co.setHours(0, 0, 0, 0);
      return ts >= ci.getTime() && ts < co.getTime();
    });
  };

  const handleSelect = (selected) => {
    if (!selected || !selected.from) { onChange('', ''); return; }
    const from = selected.from;
    if (selected.to) {
      const to = selected.to;
      if (to.getTime() <= from.getTime()) { onChange(toISO(from), ''); return; }
      // Reject any range that spans an occupied night
      let d = new Date(from);
      while (d.getTime() < to.getTime()) {
        if (isOccupied(d)) { onChange(toISO(from), ''); return; }
        d = addDays(d, 1);
      }
      onChange(toISO(from), toISO(to));
    } else {
      onChange(toISO(from), '');
    }
  };

  return (
    <div dir="rtl" className="flex flex-col items-center">
      <Calendar
        mode="range"
        numberOfMonths={numberOfMonths}
        selected={range}
        onSelect={handleSelect}
        disabled={disabled}
        dir="rtl"
        locale={he}
      />
      <div className="flex items-center justify-center gap-2 mt-1.5">
        <span className="text-xs" style={{ color: '#6B7280' }}>
          {end
            ? `${toISODate(start)} → ${toISODate(end)}`
            : start
              ? `${toISODate(start)} — בחר תאריך סיום`
              : 'בחר תאריך התחלה'}
        </span>
        {(start || end) && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="text-xs font-medium px-2 py-0.5 rounded-full transition-all hover:opacity-80"
            style={{ background: '#F0EEE8', color: '#6B7280' }}
          >
            איפוס
          </button>
        )}
      </div>
    </div>
  );
}

const toISODate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};