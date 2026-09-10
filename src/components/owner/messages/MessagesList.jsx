import React from 'react';
import { Search, Settings, MessageCircleQuestion, MessageCircle, Bell } from 'lucide-react';

const CATS = [
  { id: 'questions', label: 'שאלות לקוחות', icon: MessageCircleQuestion },
  { id: 'chats', label: "צ'אטים ישירים", icon: MessageCircle },
  { id: 'system', label: 'הודעות מערכת', icon: Bell },
];

const CAT_LABEL = {
  questions: 'שאלות לקוחות',
  chats: "צ'אטים ישירים",
  system: 'הודעות מערכת',
};

export default function MessagesList({ category, onCategory, subFilter, onSubFilter, subFilters, items, renderItem, search, setSearch, onOpenSettings, counts, totals }) {
  const otherHints = CATS
    .filter((c) => c.id !== category && (totals?.[c.id] || 0) > 0)
    .map((c) => ({ id: c.id, label: CAT_LABEL[c.id], n: totals[c.id] }));

  return (
    <div className="h-full flex flex-col bg-white" dir="rtl">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-lg font-black" style={{ color: '#1A1A1A' }}>הודעות</h2>
        <button onClick={onOpenSettings} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#F8F7F4' }} title="הגדרות הודעות אוטומטיות">
          <Settings size={18} style={{ color: '#6B7280' }} />
        </button>
      </div>
      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3" style={{ color: '#9CA3AF' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש בשיחות"
            className="w-full pr-9 pl-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8', color: '#1A1A1A' }} />
        </div>
      </div>
      {/* Category pills */}
      <div className="px-4 pb-2 flex gap-2 flex-wrap">
        {CATS.map(c => {
          const active = category === c.id;
          const cnt = counts?.[c.id] || 0;
          return (
            <button key={c.id} onClick={() => onCategory(c.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
              style={active ? { background: '#1A1A1A', color: '#fff' } : { background: '#F8F7F4', color: '#6B7280' }}>
              <c.icon size={13} /> {c.label}
              {cnt > 0 && <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={active ? { background: '#fff', color: '#1A1A1A' } : { background: '#EF4444', color: '#fff' }}>{cnt > 99 ? '99+' : cnt}</span>}
            </button>
          );
        })}
      </div>
      {/* Sub filters */}
      {subFilters && subFilters.length > 0 && (
        <div className="px-4 pb-3 flex gap-2 flex-wrap">
          {subFilters.map(f => (
            <button key={f.id} onClick={() => onSubFilter(f.id)}
              className="px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
              style={subFilter === f.id ? { background: '#EAEBFF', color: '#4338CA' } : { background: '#fff', color: '#9CA3AF', border: '1px solid #F0EEE8' }}>
              {f.label}
            </button>
          ))}
        </div>
      )}
      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {items.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <p className="text-sm" style={{ color: '#9CA3AF' }}>אין הודעות בקטגוריה זו</p>
            {otherHints.length > 0 && (
              <div className="space-y-2">
                {otherHints.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => onCategory(h.id)}
                    className="block w-full text-sm font-semibold px-3 py-2 rounded-xl transition-all"
                    style={{ background: '#F8F7F4', color: '#EA580C' }}
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
