import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CalendarRange } from 'lucide-react';
import DateRangePicker from './DateRangePicker';

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

/**
 * Compact trigger ("📅 12/09/2026 → 15/09/2026") that opens a popover with the
 * shared interactive range calendar. Closes automatically once both dates are
 * chosen. Use everywhere a from/to date pair is needed.
 */
export default function DateRangeField({
  start,
  end,
  onChange,
  min,
  max,
  disabledRanges,
  allowPast = false,
  numberOfMonths = 1,
  placeholder = 'בחר תאריכים',
  className = '',
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const hasValue = !!(start || end);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-full flex items-center gap-2 rounded-xl outline-none transition-all text-right ${className}`}
          style={{
            background: '#F8F7F4',
            border: `1.5px solid ${hasValue ? '#F97316' : '#E8E5E0'}`,
            color: hasValue ? '#1A1A1A' : '#9CA3AF',
            padding: compact ? '8px 10px' : '10px 12px',
            fontSize: 13,
          }}
        >
          <CalendarRange size={15} style={{ color: hasValue ? '#F97316' : '#9CA3AF', flexShrink: 0 }} />
          <span className="flex-1 truncate font-medium">
            {hasValue
              ? `${fmt(start)} → ${fmt(end)}`
              : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
        <DateRangePicker
          start={start}
          end={end}
          onChange={(s, e) => {
            onChange(s, e);
            if (s && e) setOpen(false);
          }}
          min={min}
          max={max}
          disabledRanges={disabledRanges}
          allowPast={allowPast}
          numberOfMonths={numberOfMonths}
        />
      </PopoverContent>
    </Popover>
  );
}