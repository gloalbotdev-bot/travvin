import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, LogOut } from 'lucide-react';

export default function OwnerHamburger({ open, onClose, navItems, tab, onNav, notifCount, currentUser, onLogout }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const initials = currentUser?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2) || 'ZB';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onClose} />

          <motion.div key="panel" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 bottom-0 z-50 w-[300px] max-w-[85vw] flex flex-col" dir="rtl"
            style={{ right: 0, background: '#fff', boxShadow: '-10px 0 40px rgba(0,0,0,0.12)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 h-16 flex-shrink-0" style={{ borderBottom: '1px solid #F0EEE8' }}>
              <span className="font-black text-base" style={{ color: '#1A1A1A' }}>תפריט</span>
              <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-gray-50" style={{ background: '#F8F7F4', color: '#6B7280' }}>
                <X size={18} />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => onNav(id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={tab === id ? { background: 'rgba(249,115,22,0.1)', color: '#EA580C' } : { color: '#6B7280' }}>
                  <Icon size={17} /><span className="flex-1 text-right">{label}</span>
                  {id === 'updates' && notifCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#EF4444', color: '#fff' }}>{notifCount}</span>
                  )}
                </button>
              ))}
            </nav>

            {/* Footer actions */}
            <div className="px-3 py-3 space-y-0.5" style={{ borderTop: '1px solid #F0EEE8' }}>
              <a href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all hover:bg-gray-50" style={{ color: '#6B7280' }}>
                <ChevronRight size={17} /><span>חזרה לצ'אט</span>
              </a>
              <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all hover:bg-red-50" style={{ color: '#EF4444' }}>
                <LogOut size={17} /><span>התנתקות</span>
              </button>
            </div>

            {/* User */}
            <div className="px-4 py-4 flex items-center gap-3" style={{ borderTop: '1px solid #F0EEE8' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#F0EEE8', color: '#6B7280' }}>{initials}</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: '#1A1A1A' }}>{currentUser?.full_name || 'בעל מתחם'}</p>
                <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{currentUser?.email}</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}