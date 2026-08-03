import React, { useState } from 'react';
import { Search, Check, X } from 'lucide-react';

// Multi-select recipient picker from a list of users.
export default function RecipientPicker({ users, selected, onToggle, onClear, accent = '#F97316' }) {
  const [q, setQ] = useState('');
  const list = users.filter(u => {
    const s = q.toLowerCase();
    return !s || (u.full_name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s);
  });

  return (
    <div className="rounded-xl p-3" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>רשימת נמענים ({users.length})</span>
        {selected.size > 0 && (
          <button type="button" onClick={onClear} className="text-xs flex items-center gap-1" style={{ color: accent }}>
            {selected.size} נבחרו <X size={12} />
          </button>
        )}
      </div>
      <div className="relative mb-2">
        <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש לפי שם או מייל..."
          className="w-full pr-8 pl-3 py-1.5 text-xs"
          style={{ background: '#fff', border: '1.5px solid #E8E5E0', borderRadius: '10px', outline: 'none', direction: 'rtl' }} />
      </div>
      <div className="max-h-44 overflow-y-auto space-y-1">
        {list.length === 0
          ? <p className="text-xs text-center py-4" style={{ color: '#9CA3AF' }}>אין משתמשים רשומים</p>
          : list.map(u => {
            const on = selected.has(u.id);
            return (
              <button key={u.id} type="button" onClick={() => onToggle(u.id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-right transition-all"
                style={{ background: on ? `${accent}14` : '#fff', border: `1.5px solid ${on ? accent + '55' : '#F0EEE8'}` }}>
                <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: on ? accent : '#E8E5E0' }}>
                  {on && <Check size={11} color="#fff" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate" style={{ color: '#1A1A1A' }}>{u.full_name || 'ללא שם'}</p>
                  <p className="text-[10px] truncate" style={{ color: '#9CA3AF' }}>{u.email}</p>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}