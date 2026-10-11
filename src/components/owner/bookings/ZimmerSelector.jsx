import React, { useState, useRef, useEffect } from 'react';
import houseTeal from '@/assets/owner/bookings/selector-house.svg';
import chevronTeal from '@/assets/owner/bookings/selector-chevron.svg';
import houseBlack from '@/assets/owner/bookings/filter-house.svg';
import chevronBlack from '@/assets/owner/bookings/filter-chevron.svg';

const VARIANTS = {
  snapshot: { color: '#0B3838', house: houseTeal, chevron: chevronTeal, chevronW: 15, houseGap: 9.3, chevronGap: 9.3 },
  filter: { color: '#000000', house: houseBlack, chevron: chevronBlack, chevronW: 14, houseGap: 5.6, chevronGap: 12.8 },
};

// "כל הנכסים (N)" dropdown (Figma 1776:20394 / 1776:19972).
export default function ZimmerSelector({ zimmers, value, onChange, variant = 'snapshot' }) {
  const v = VARIANTS[variant];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const label = value === 'all' ? `כל הנכסים (${zimmers.length})` : (zimmers.find(z => z.id === value)?.name || 'נכס');
  const pick = (id) => { onChange(id); setOpen(false); };

  return (
    <div className="relative flex w-fit" ref={ref} dir="rtl">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="font-simona flex items-center transition-opacity hover:opacity-80"
        style={{ color: v.color, fontSize: 14, fontWeight: 400, lineHeight: 'normal' }}
      >
        <img src={v.house} alt="" width={13} height={13} className="block flex-shrink-0" style={{ width: 13, height: 13, marginLeft: v.houseGap }} />
        <span className="truncate max-w-[220px]">{label}</span>
        <img
          src={v.chevron}
          alt=""
          width={v.chevronW}
          height={9}
          className="block flex-shrink-0"
          style={{ width: v.chevronW, height: 9, marginRight: v.chevronGap, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-2 right-0 min-w-[200px] rounded-xl overflow-hidden bg-white py-1"
          style={{ border: '1px solid #EFEFEF', boxShadow: '0 4px 21.1px rgba(0,0,0,0.07)' }}
        >
          <button
            type="button"
            role="option"
            aria-selected={value === 'all'}
            onClick={() => pick('all')}
            className="font-simona w-full text-right px-4 py-2 hover:bg-[#FAFAFA]"
            style={{ color: '#0B3838', fontSize: 14, fontWeight: value === 'all' ? 700 : 400 }}
          >
            כל הנכסים ({zimmers.length})
          </button>
          {zimmers.map(z => (
            <button
              key={z.id}
              type="button"
              role="option"
              aria-selected={value === z.id}
              onClick={() => pick(z.id)}
              className="font-simona w-full text-right px-4 py-2 hover:bg-[#FAFAFA] truncate"
              style={{ color: '#0B3838', fontSize: 14, fontWeight: value === z.id ? 700 : 400 }}
            >
              {z.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
