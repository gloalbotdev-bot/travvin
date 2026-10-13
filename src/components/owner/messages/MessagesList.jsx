import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import iconSearch from '@/assets/owner/messages/icon-search.svg';
import iconSettings from '@/assets/owner/messages/icon-settings.svg';

const CATS = [
  { id: 'questions', label: 'שאלות לקוחות' },
  { id: 'chats', label: "צ'אטים ישירים" },
  { id: 'system', label: 'הודעות מערכת' },
];

const CAT_LABEL = {
  questions: 'שאלות לקוחות',
  chats: "צ'אטים ישירים",
  system: 'הודעות מערכת',
};

const CHIP_BASE = 'font-simona inline-flex items-center justify-center gap-1.5 h-[28px] px-[12px] rounded-full text-[13px] whitespace-nowrap transition-colors';
const chipStyle = (active) => active
  ? { background: '#0B3838', color: '#fff', fontWeight: 500 }
  : { border: '1px solid rgba(11,56,56,0.21)', color: '#0B3838', fontWeight: 400 };

function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={CHIP_BASE} style={chipStyle(active)}>
      {children}
    </button>
  );
}

export default function MessagesList({ category, onCategory, subFilter, onSubFilter, subFilters, items, renderItem, search, setSearch, onOpenSettings, counts, totals }) {
  const [searchOpen, setSearchOpen] = useState(!!search);
  const searchRef = useRef(null);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const toggleSearch = () => {
    if (searchOpen) setSearch('');
    setSearchOpen(o => !o);
  };

  const otherHints = CATS
    .filter((c) => c.id !== category && (totals?.[c.id] || 0) > 0)
    .map((c) => ({ id: c.id, label: CAT_LABEL[c.id], n: totals[c.id] }));

  return (
    <div className="h-full flex flex-col bg-white pt-[42px] px-[20px] lg:pr-[clamp(20px,1.875vw,36px)] lg:pl-[clamp(20px,1.25vw,24px)] pb-[32px] gap-[20px]" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="font-simpler text-[24px] leading-normal" style={{ color: '#0B3838', fontWeight: 600 }}>הודעות</h2>
        <div className="flex items-center gap-[8px]">
          <button type="button" onClick={toggleSearch} aria-label="חיפוש בשיחות" aria-expanded={searchOpen} className="rounded-full">
            <img src={iconSearch} alt="" width={31} height={30} className="block" />
          </button>
          <button type="button" onClick={onOpenSettings} aria-label="הגדרות הודעות אוטומטיות" title="הגדרות הודעות אוטומטיות" className="rounded-full">
            <img src={iconSettings} alt="" width={31} height={30} className="block" />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="relative -mt-[8px]">
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') toggleSearch(); }}
            placeholder="חיפוש בשיחות"
            aria-label="חיפוש בשיחות"
            className="font-simona w-full h-[36px] pr-[14px] pl-[34px] rounded-full text-[13px] outline-none bg-white focus:border-[#0B3838] [&::-webkit-search-cancel-button]:appearance-none"
            style={{ border: '1px solid rgba(11,56,56,0.21)', color: '#0B3838' }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="נקה חיפוש"
              className="absolute top-1/2 -translate-y-1/2 left-[10px] p-0.5 rounded-full hover:opacity-70" style={{ color: '#6B7280' }}>
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-[8px]">
        <div className="flex flex-wrap gap-[8px]">
          {CATS.map(c => {
            const active = category === c.id;
            const cnt = counts?.[c.id] || 0;
            return (
              <Chip key={c.id} active={active} onClick={() => onCategory(c.id)}>
                {c.label}
                {cnt > 0 && (
                  <span className="text-[10px] leading-none rounded-full px-1.5 py-[3px]" style={active ? { background: '#FFFF00', color: '#0B3838', fontWeight: 700 } : { background: '#0B3838', color: '#fff', fontWeight: 700 }}>
                    {cnt > 99 ? '99+' : cnt}
                  </span>
                )}
              </Chip>
            );
          })}
        </div>
        {subFilters && subFilters.length > 0 && (
          <div className="flex flex-wrap gap-[8px]">
            {subFilters.map(f => (
              <Chip key={f.id} active={subFilter === f.id} onClick={() => onSubFilter(f.id)}>{f.label}</Chip>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto owner-hide-scrollbar flex flex-col gap-[4px]">
        {items.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <p className="font-simona text-[13px]" style={{ color: '#6B7280' }}>אין הודעות בקטגוריה זו</p>
            {otherHints.length > 0 && (
              <div className="space-y-2">
                {otherHints.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => onCategory(h.id)}
                    className="font-simona block w-full text-[13px] px-3 py-2 rounded-[12px] transition-colors hover:bg-[#EFEFEF]"
                    style={{ background: '#FAFAFA', color: '#0B3838', fontWeight: 500 }}
                  >
                    יש {h.n} ב«{h.label}» — לחצי כאן
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : items.map((it, i) => renderItem(it, i))}
      </div>
    </div>
  );
}
