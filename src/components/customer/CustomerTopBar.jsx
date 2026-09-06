import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, ArrowRight, Flame } from 'lucide-react';
import { api } from '@/api/client';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import UpdatesPopover from '@/components/chat/UpdatesPopover';

// Fixed top bar for the customer home: hamburger (right, RTL) + logo + notifications bell.
// Replaces the old 3-dots menu and bell that lived inside the chat header.
export default function CustomerTopBar({ onOpenMenu, onBack, showPromotions, onOpenPromotions }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [promoCount, setPromoCount] = useState(0);
  const { count } = useUnreadNotifications('customer', user?.id);

  useEffect(() => {
    let alive = true;
    api.auth.me().then(u => { if (alive) setUser(u || null); }).catch(() => { if (alive) setUser(null); });
    return () => { alive = false; };
  }, []);

  // Fetch active promotions count for the emphasized badge (only on the index page).
  useEffect(() => {
    if (!showPromotions) { setPromoCount(0); return; }
    let alive = true;
    const today = new Date().toISOString().split('T')[0];
    api.entities.Promotion.filter({ status: 'פעיל' })
      .then(all => {
        if (!alive) return;
        setPromoCount(all.filter(p => p.check_out && p.check_out >= today).length);
      })
      .catch(() => { if (alive) setPromoCount(0); });
    return () => { alive = false; };
  }, [showPromotions]);

  const openUpdates = () => {
    if (user) setUpdatesOpen(true);
    else navigate('/login');
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between px-3 sm:px-4 h-[60px]"
        dir="rtl"
        style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid #F0EEE8' }}>
        <div className="flex items-center gap-1">
          <button onClick={onOpenMenu} aria-label="תפריט"
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors hover:bg-black/5"
            style={{ color: '#1A1A1A' }}>
            <Menu size={24} />
          </button>
          {onBack && (
            <button onClick={onBack}
              className="flex items-center gap-1.5 h-11 px-2.5 rounded-xl transition-colors hover:bg-black/5"
              style={{ color: '#1A1A1A' }}>
              <ArrowRight size={20} />
              <span className="text-sm font-bold whitespace-nowrap hidden sm:inline">חזרה לצ'אט חיפוש והאינדקס</span>
            </button>
          )}
          {showPromotions && (
            <button onClick={onOpenPromotions}
              className="relative flex items-center gap-1.5 h-11 px-3 rounded-xl transition-transform hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#fff', boxShadow: '0 3px 10px rgba(249,115,22,0.35)' }}>
              <Flame size={18} className="animate-pulse" />
              <span className="text-sm font-black whitespace-nowrap hidden sm:inline">מבצעים</span>
              {promoCount > 0 && (
                <span className="absolute -top-1 -left-1 bg-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center" style={{ color: '#EA580C', border: '2px solid #F97316' }}>
                  {promoCount}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 select-none">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-white" style={{ background: '#F97316' }}>T</div>
          <span className="font-black text-lg tracking-tight" style={{ color: '#1A1A1A' }}>TRAVVIN</span>
        </div>

        <button onClick={openUpdates} aria-label="עדכונים"
          className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors hover:bg-black/5"
          style={{ color: '#1A1A1A' }}>
          <Bell size={22} />
          {user && count > 0 && (
            <span className="absolute -top-0.5 -left-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center" style={{ border: '1.5px solid #fff' }}>{count > 99 ? '99+' : count}</span>
          )}
        </button>
      </header>

      {updatesOpen && (
        <div className="fixed inset-0 z-[70]" onClick={() => setUpdatesOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.28)' }} />
          <div className="absolute animate-in slide-in-from-top-2 duration-200"
            style={{ top: 70, left: '50%', transform: 'translateX(-50%)' }}
            onClick={e => e.stopPropagation()}>
            <UpdatesPopover
              userId={user?.id}
              fullUserName={user?.full_name}
              onGoAll={() => { setUpdatesOpen(false); navigate('/customer-portal?updates=1'); }}
            />
          </div>
        </div>
      )}
    </>
  );
}