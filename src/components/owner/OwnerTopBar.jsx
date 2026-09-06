import React from 'react';
import { Plus, Bell, Sparkles } from 'lucide-react';

export default function OwnerTopBar({ tab, primaryNav, onNav, onAddBooking, notifCount, onBell, onSpark, onHamburger }) {
  return (
    <header dir="rtl" className="sticky top-0 z-30" style={{ background: '#fff', borderBottom: '1.5px solid #F0EEE8' }}>
      <div className="flex items-center justify-between px-4 lg:px-6 h-16">
        {/* Right (RTL start): hamburger + logo + primary nav */}
        <div className="flex items-center gap-4">
          <button onClick={onHamburger} title="תפריט"
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
            style={{ background: '#0B3838', color: '#fff' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>

          <div className="flex items-center gap-2.5">
            <span className="font-black text-lg" style={{ color: '#1A1A1A', letterSpacing: '-0.02em' }}>Travvin</span>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {primaryNav.map(({ id, shortLabel, icon: Icon }) => (
              <button key={id} onClick={() => onNav(id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
                style={tab === id ? { background: '#0B3838', color: '#fff' } : { color: '#6B7280' }}>
                <Icon size={15} /><span>{shortLabel}</span>
                {id === 'updates' && notifCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#EF4444', color: '#fff' }}>{notifCount}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Left (RTL end): actions */}
        <div className="flex items-center gap-2">
          <button onClick={onAddBooking}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: '#F97316', color: '#fff' }}>
            <Plus size={15} /> הוספת הזמנה
          </button>

          <button onClick={onBell} title="הודעות ועדכונים"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-gray-50"
            style={{ background: '#F8F7F4', color: '#6B7280' }}>
            <Bell size={18} />
            {notifCount > 0 && (
              <span className="absolute -top-1 -left-1 text-[10px] font-bold rounded-full flex items-center justify-center"
                style={{ background: '#EF4444', color: '#fff', minWidth: 18, height: 18, padding: '0 4px' }}>
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </button>

          <button onClick={onSpark} title="עוזר AI"
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-gray-50"
            style={{ background: '#F8F7F4' }}>
            <Sparkles size={18} style={{ color: '#F97316' }} />
          </button>
        </div>
      </div>
    </header>
  );
}