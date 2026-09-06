import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import DateRangeField from '@/components/common/DateRangeField';
import { AMENITY_LIST } from '@/components/chat/DateSearchWidget';

const SORTS = [
  { id: 'newest', label: 'חדשים ביותר' },
  { id: 'price_asc', label: 'מחיר: מהנמוך לגבוה' },
  { id: 'price_desc', label: 'מחיר: מהגבוה לנמוך' },
  { id: 'rating', label: 'דירוג גבוה' },
];

const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A', borderRadius: '12px' };

export default function ZimmerPageFilters({ filters, onChange, onReset, resultCount }) {
  const [expanded, setExpanded] = useState(false);
  const set = (patch) => onChange({ ...filters, ...patch });
  const activeCount =
    (filters.q ? 1 : 0) + (filters.start ? 1 : 0) + (filters.numGuests ? 1 : 0) +
    ((filters.minPrice || filters.maxPrice) ? 1 : 0) + (filters.amenities.length ? 1 : 0) + (filters.sort !== 'newest' ? 1 : 0);

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }} dir="rtl">
      {/* Row 1: free text + sort + expand toggle */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 rounded-xl" style={inputStyle}>
          <Search size={15} style={{ color: '#9CA3AF', flexShrink: 0 }} />
          <input value={filters.q} onChange={e => set({ q: e.target.value })}
            placeholder="חפש לפי שם או אזור..."
            className="flex-1 bg-transparent outline-none text-sm py-2.5" style={{ color: '#1A1A1A' }} />
        </div>
        <select value={filters.sort} onChange={e => set({ sort: e.target.value })}
          className="px-3 py-2.5 text-sm outline-none rounded-xl" style={inputStyle}>
          {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button onClick={() => setExpanded(v => !v)}
          className="px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 justify-center transition-all"
          style={expanded ? { background: '#0B3838', color: '#fff' } : { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
          <SlidersHorizontal size={14} /> סינון
          {activeCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#F97316', color: '#fff' }}>{activeCount}</span>}
        </button>
      </div>

      {/* Row 2: expanded filters */}
      {expanded && (
        <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid #F0EEE8' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>תאריכי שהייה</label>
              <DateRangeField start={filters.start} end={filters.end}
                onChange={(s, e) => set({ start: s, end: e })} placeholder="תאריכים לבדיקת זמינות" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מספר אורחים</label>
              <input type="number" min={0} value={filters.numGuests || ''} onChange={e => set({ numGuests: e.target.value === '' ? 0 : Number(e.target.value) })}
                placeholder="לא צוין"
                className="w-full px-3 py-2.5 text-sm outline-none rounded-xl" style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מחיר מינ׳ (₪)</label>
              <input type="number" min={0} value={filters.minPrice || ''} onChange={e => set({ minPrice: e.target.value === '' ? 0 : Number(e.target.value) })}
                placeholder="0" className="w-full px-3 py-2.5 text-sm outline-none rounded-xl" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מחיר מקס׳ (₪)</label>
              <input type="number" min={0} value={filters.maxPrice || ''} onChange={e => set({ maxPrice: e.target.value === '' ? 0 : Number(e.target.value) })}
                placeholder="ללא הגבלה" className="w-full px-3 py-2.5 text-sm outline-none rounded-xl" style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מתקנים ({filters.amenities.length})</label>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="w-full px-3 py-2.5 text-sm text-right rounded-xl flex items-center justify-between" style={inputStyle}>
                  <span className="truncate">{filters.amenities.length ? filters.amenities.join(', ') : 'בחר מתקנים'}</span>
                  <SlidersHorizontal size={14} style={{ color: '#9CA3AF' }} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 max-h-72 overflow-y-auto" align="start" sideOffset={6}>
                {AMENITY_LIST.map(a => {
                  const on = filters.amenities.includes(a);
                  return (
                    <button key={a} type="button" onClick={() => set({ amenities: on ? filters.amenities.filter(x => x !== a) : [...filters.amenities, a] })}
                      className="w-full flex items-center gap-2 px-3 py-2 text-right text-sm hover:bg-gray-50" style={{ borderBottom: '1px solid #F0EEE8' }}>
                      <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                        style={on ? { background: '#0B3838' } : { border: '1.5px solid #E8E5E0' }}>
                        {on && <X size={10} className="text-white" />}
                      </span>
                      <span style={{ color: on ? '#0B3838' : '#4B5563', fontWeight: on ? 600 : 400 }}>{a}</span>
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {/* Footer: count + reset */}
      <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: expanded ? 'none' : '1px solid #F0EEE8' }}>
        <span className="text-xs" style={{ color: '#9CA3AF' }}>{resultCount} צימרים</span>
        {activeCount > 0 && (
          <button onClick={onReset} className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#EA580C' }}>
            <RotateCcw size={12} /> איפוס
          </button>
        )}
      </div>
    </div>
  );
}