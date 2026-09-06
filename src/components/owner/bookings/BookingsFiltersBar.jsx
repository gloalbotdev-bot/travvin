import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import DateRangeField from '@/components/common/DateRangeField';

// Filter bar: property dropdown + free-text search + date-range picker (Figma).
export default function BookingsFiltersBar({ zimmers, zimmerFilter, onZimmerFilter, search, onSearch, dateRange, onDateRange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectedName = zimmerFilter === 'all' ? `כל הנכסים (${zimmers.length})` : (zimmers.find(z => z.id === zimmerFilter)?.name || 'נכס');

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
      {/* Property dropdown */}
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen(o => !o)}
          className="w-full sm:w-auto flex items-center justify-between gap-2 bg-white px-3 py-2.5 rounded-xl text-sm font-medium min-w-[150px]"
          style={{ border: '1px solid #ECEFF1', color: '#212121' }}>
          <span className="truncate">{selectedName}</span>
          <ChevronDown size={15} style={{ color: '#9e9e9e' }} />
        </button>
        {open && (
          <div className="absolute z-20 mt-1 bg-white rounded-xl py-1 w-full min-w-[200px] shadow-lg" style={{ border: '1px solid #ECEFF1' }}>
            <button onClick={() => { onZimmerFilter('all'); setOpen(false); }}
              className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-50 ${zimmerFilter === 'all' ? 'font-bold' : ''}`} style={{ color: '#212121' }}>
              כל הנכסים ({zimmers.length})
            </button>
            {zimmers.map(z => (
              <button key={z.id} onClick={() => { onZimmerFilter(z.id); setOpen(false); }}
                className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-50 truncate ${zimmerFilter === z.id ? 'font-bold' : ''}`} style={{ color: '#212121' }}>
                {z.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex-1 relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3" style={{ color: '#9e9e9e' }} />
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="חיפוש לפי אורח או נכס..."
          className="w-full bg-white rounded-xl pr-10 pl-3 py-2.5 text-sm outline-none"
          style={{ border: '1px solid #ECEFF1', color: '#212121' }}
        />
      </div>

      {/* Date range */}
      <div className="w-full sm:w-[230px] flex-shrink-0">
        <DateRangeField
          start={dateRange.start}
          end={dateRange.end}
          onChange={(s, e) => onDateRange({ start: s, end: e })}
          placeholder="סינון לפי תאריכים"
        />
      </div>
    </div>
  );
}