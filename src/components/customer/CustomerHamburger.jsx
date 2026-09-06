import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Home, Compass, ClipboardList, Bell, MessageCircle, User, History, Tag, Settings, LogOut } from 'lucide-react';
import { api } from '@/api/client';

// Slide-in drawer from the right (RTL start) — the customer's navigation hub.
// Replaces the old 3-dots menu that was inside the chat header.
const SECTIONS = [
  {
    title: 'ניווט',
    items: [
      { label: 'דף הבית', icon: Home, path: '/' },
      { label: 'פיד וידאו', icon: Compass, path: '/discover' },
    ],
  },
  {
    title: 'אזור אישי',
    items: [
      { label: 'ההזמנות שלי', icon: ClipboardList, path: '/customer-portal' },
      { label: 'עדכונים', icon: Bell, path: '/customer-portal?updates=1' },
      { label: 'הודעות', icon: MessageCircle, path: '/customer-portal' },
      { label: 'פרופיל אישי', icon: User, path: '/customer-portal' },
      { label: 'היסטוריית חיפושים', icon: History, path: '/customer-portal' },
    ],
  },
  {
    title: 'עוד',
    items: [
      { label: 'מבצעים', icon: Tag, path: '/promotions' },
      { label: 'הגדרות חשבון', icon: Settings, path: '/account-settings' },
    ],
  },
];

export default function CustomerHamburger({ open, onClose, user }) {
  const navigate = useNavigate();
  const go = (path) => { onClose(); navigate(path); };
  const logout = async () => { onClose(); await api.auth.logout('/welcome'); };

  return (
    <div className={`fixed inset-0 z-[80] ${open ? '' : 'pointer-events-none'}`} dir="rtl" aria-hidden={!open}>
      <div className={`absolute inset-0 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <aside className={`absolute top-0 right-0 bottom-0 w-[300px] max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ fontFamily: 'Heebo, sans-serif' }}>
        <div className="flex items-center justify-between px-5 h-[60px] flex-shrink-0" style={{ borderBottom: '1px solid #F0EEE8' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-white" style={{ background: '#F97316' }}>T</div>
            <span className="font-black text-base" style={{ color: '#1A1A1A' }}>TRAVVIN</span>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#F8F7F4', color: '#6B7280' }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {SECTIONS.map(sec => (
            <div key={sec.title}>
              <div className="px-2 mb-1.5 text-[11px] font-bold tracking-wide" style={{ color: '#9CA3AF' }}>{sec.title}</div>
              <div className="space-y-0.5">
                {sec.items.map(it => (
                  <button key={it.label} onClick={() => go(it.path)}
                    className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium text-right transition-colors hover:bg-[#F8F7F4]"
                    style={{ color: '#1A1A1A' }}>
                    <it.icon size={18} style={{ color: '#6B7280' }} />
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-3 py-4 flex-shrink-0" style={{ borderTop: '1px solid #F0EEE8' }}>
          {user ? (
            <button onClick={logout}
              className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-bold text-right transition-colors hover:bg-red-50"
              style={{ color: '#EF4444' }}>
              <LogOut size={18} /> התנתקות
            </button>
          ) : (
            <button onClick={() => go('/login')} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#F97316' }}>התחברות</button>
          )}
        </div>
      </aside>
    </div>
  );
}