import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageCircle, Tag, Bell, User } from 'lucide-react';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { api } from '@/api/client';

// Persistent bottom navigation for all customer-facing screens.
// variant="fixed"  → mobile-only fixed bar (lg:hidden), used on full pages (chat, promotions, portal).
// variant="absolute" → always-on absolute bar, used inside the Discover phone frame.
export default function CustomerBottomNav({ onNotifications, variant = 'fixed' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    api.auth.me().then(u => setUserId(u?.id || null)).catch(() => setUserId(null));
  }, []);

  const { count } = useUnreadNotifications('customer', userId);

  const items = [
    { label: 'פיד', icon: Home, path: '/discover' },
    { label: "צ'אט", icon: MessageCircle, path: '/chat' },
    { label: 'מבצעים', icon: Tag, path: '/promotions' },
    { label: 'התראות', icon: Bell, path: '/customer-portal', isNotifications: true },
    { label: 'אזור אישי', icon: User, path: '/customer-portal' },
  ];

  const go = (item) => {
    if (item.isNotifications && onNotifications) { onNotifications(); return; }
    const target = item.isNotifications ? '/customer-portal?updates=1' : item.path;
    // Compare full URL (path + search) so switching between "פורטל" and "התראות"
    // (same path, different query) is not treated as a no-op.
    if ((location.pathname + location.search) === target) return;
    navigate(target);
  };

  const isActive = (path, isNotifications) => {
    const onPortal = location.pathname === '/customer-portal';
    if (!onPortal) return location.pathname === path;
    const sp = new URLSearchParams(window.location.search);
    const isUpdates = sp.get('updates') === '1';
    return isNotifications ? isUpdates : !isUpdates;
  };

  const isFixed = variant === 'fixed';
  const positionClass = isFixed ? 'fixed left-3 right-3 bottom-3 lg:hidden' : 'absolute left-3 right-3 bottom-3';

  return (
    <div
      className={`${positionClass} z-40 flex items-stretch justify-around`}
      style={{
        background: 'rgba(20,20,24,0.32)',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 24,
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        overflow: 'hidden',
        paddingBottom: isFixed ? 'max(env(safe-area-inset-bottom), 0px)' : 0,
      }}
      dir="rtl"
    >
      {items.map(({ label, icon: Icon, path, isNotifications }) => {
        const active = isActive(path, isNotifications);
        return (
          <button
            key={label}
            onClick={() => go({ label, icon: Icon, path, isNotifications })}
            className="flex flex-col items-center gap-0.5 px-2 py-2 flex-1 transition-colors"
            style={{ minHeight: 56, color: active ? '#F97316' : 'rgba(255,255,255,0.72)' }}
          >
            <span className="relative inline-flex">
              <Icon size={22} />
              {isNotifications && count > 0 && (
                <span
                  className="absolute -top-1.5 -left-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center"
                  style={{ border: '1.5px solid rgba(12,12,14,0.9)' }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </span>
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}