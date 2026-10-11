import React from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import DateRangeField from '@/components/common/DateRangeField';
import { needsAttention, isUpcoming, isActive } from './bookingStatus';
import btnSearch from '@/assets/owner/bookings/btn-search.svg';

// Desktop filter chips + search/date popover (Figma 1776:19955, 1776:19976).
export default function BookingsFilterChips({ active, onChange, bookings, search, onSearch, dateRange, onDateRange }) {
  const chips = [
    { id: 'all', label: 'הכול' },
    { id: 'upcoming', label: 'הזמנות קרובות', count: bookings.filter(isUpcoming).length },
    { id: 'active', label: 'הזמנות פעילות', count: bookings.filter(isActive).length },
    { id: 'attention', label: 'דורש טיפול', count: bookings.filter(needsAttention).length, highlight: true },
    { id: 'old', label: 'הזמנות ישנות' },
  ];
  const hasQuery = !!search.trim() || !!(dateRange.start && dateRange.end);

  return (
    <div className="flex items-end justify-between gap-4" dir="rtl">
      <div className="flex flex-wrap items-start" style={{ gap: 8 }} role="tablist">
        {chips.map(c => {
          const on = active === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(c.id)}
              className="font-simona flex items-center justify-center whitespace-nowrap transition-colors"
              style={{
                height: 31,
                gap: 6,
                padding: '0 12px',
                borderRadius: on ? 100 : 35,
                border: on ? '1px solid #0B3838' : '1px solid rgba(11,56,56,0.21)',
                background: on ? '#0B3838' : 'transparent',
                color: on ? '#FFFFFF' : '#0B3838',
                fontSize: 16,
                fontWeight: on ? 500 : 400,
                lineHeight: 'normal',
              }}
            >
              {c.label}
              {c.count !== undefined && (
                <span
                  className="flex items-start"
                  style={{
                    padding: '2px 6px',
                    borderRadius: 99,
                    background: c.highlight ? '#FFFF00' : '#FAFAFA',
                    color: '#0B3838',
                    fontFamily: 'Rubik, Heebo, sans-serif',
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 'normal',
                  }}
                >
                  {c.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="חיפוש וסינון לפי תאריכים"
            className="flex-shrink-0 transition-opacity hover:opacity-80"
            style={{ width: 58, height: 41, marginLeft: -2.7 }}
          >
            <img src={btnSearch} alt="" width={58} height={41} className="block" style={{ width: 58, height: 41 }} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-[320px] rounded-[23px] p-4 font-simona" dir="rtl">
          <div className="flex flex-col gap-3">
            <input
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="חיפוש לפי אורח או נכס..."
              aria-label="חיפוש לפי אורח או נכס"
              className="w-full bg-white rounded-xl px-3 py-2.5 outline-none text-right"
              style={{ border: '1px solid #E5E5E5', color: '#0B3838', fontSize: 14 }}
            />
            <DateRangeField
              start={dateRange.start}
              end={dateRange.end}
              onChange={(s, e) => onDateRange({ start: s, end: e })}
              placeholder="סינון לפי תאריכים"
            />
            {hasQuery && (
              <button
                type="button"
                onClick={() => { onSearch(''); onDateRange({ start: '', end: '' }); }}
                className="self-start underline"
                style={{ color: '#0B3838', fontSize: 13 }}
              >
                ניקוי סינון
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
