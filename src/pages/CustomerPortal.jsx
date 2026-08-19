import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { User, ClipboardList, MessageSquare, LogOut, ChevronRight, Bell, Search, Star, HelpCircle, MessageCircle, CheckCircle2 } from 'lucide-react';
import DesktopSearchTab from '@/components/customer/DesktopSearchTab';
import CustomerProfileTab from '@/components/customer/CustomerProfileTab';
import CustomerBookingsTab from '@/components/customer/CustomerBookingsTab';
import CustomerHistoryTab from '@/components/customer/CustomerHistoryTab';
import CustomerUpdatesTab from '@/components/customer/CustomerUpdatesTab';
import CustomerReviewsTab from '@/components/customer/CustomerReviewsTab';
import CustomerQuestionsTab from '@/components/customer/CustomerQuestionsTab';
import CustomerMessagesTab from '@/components/customer/CustomerMessagesTab';
import CustomerCheckoutTab from '@/components/customer/CustomerCheckoutTab';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';

const navItems = [
  { id: 'profile', label: 'פרופיל אישי', icon: User },
  { id: 'bookings', label: 'ההזמנות שלי', icon: ClipboardList },
  { id: 'checkout', label: "צ'ק-אאוט", icon: CheckCircle2 },
  { id: 'messages', label: 'הודעות', icon: MessageCircle },
  { id: 'reviews', label: 'הביקורות שלי', icon: Star },
  { id: 'questions', label: 'השאלות שלי', icon: HelpCircle },
  { id: 'history', label: 'היסטוריית חיפושים', icon: MessageSquare },
  { id: 'updates', label: 'עדכונים', icon: Bell },
  { id: 'desktop-search', label: 'חיפוש Desktop', icon: Search },
];

export default function CustomerPortal() {
  const [tab, setTab] = useState('profile');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => { api.auth.me().then(setCurrentUser); }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('updates') === '1') setTab('updates');
  }, []);

  const { count: notifCount, markRead: markNotifRead } = useUnreadNotifications('customer', currentUser?.id);
  useEffect(() => { if (tab === 'updates') markNotifRead(); }, [tab, markNotifRead]);

  const [focusQuestionId, setFocusQuestionId] = useState(null);
  const [focusChatId, setFocusChatId] = useState(null);
  const [focusReviewId, setFocusReviewId] = useState(null);
  const openNotificationAction = (actionType, entityId) => {
    if (!actionType) return;
    if (actionType === 'open_booking') setTab('bookings');
    else if (actionType === 'open_answer') { setFocusQuestionId(entityId); setTab('questions'); setTimeout(() => setFocusQuestionId(null), 200); }
    else if (actionType === 'open_chat') { setFocusChatId(entityId); setTab('updates'); setTimeout(() => setFocusChatId(null), 200); }
    else if (actionType === 'open_review') { setFocusReviewId(entityId); setTab('reviews'); setTimeout(() => setFocusReviewId(null), 500); }
  };

  const initials = currentUser?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2) || '??';

  const activeTab = navItems.find(n => n.id === tab);

  if (currentUser && tab === 'desktop-search') {
    return <DesktopSearchTab onExit={() => setTab('profile')} />;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" dir="rtl" style={{ background: '#F8F7F4', fontFamily: 'Heebo, sans-serif' }}>
      {/* === Mobile top header === */}
      <div className="lg:hidden sticky top-0 z-20 px-4 py-3 flex items-center justify-between" style={{ background: '#fff', borderBottom: '1px solid #F0EEE8' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white" style={{ background: '#F97316' }}>Z</div>
          <div>
            <div className="font-black text-xs leading-tight" style={{ color: '#1A1A1A' }}>ZimmerBot</div>
            <div className="text-[10px] leading-tight" style={{ color: '#F97316' }}>אזור אישי</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => api.auth.logout('/')} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: '#EF4444', background: 'rgba(239,68,68,0.06)' }}><LogOut size={15} /></button>
        </div>
      </div>

      {/* === Mobile horizontal tabs === */}
      <div className="lg:hidden sticky top-[57px] z-10 px-3 py-2 overflow-x-auto" style={{ background: '#fff', borderBottom: '1px solid #F0EEE8' }}>
        <div className="flex gap-2 min-w-max">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all"
              style={tab === id ? { background: '#F97316', color: '#fff' } : { background: '#F8F7F4', color: '#6B7280' }}>
              <Icon size={13} /><span>{label}</span>
              {id === 'updates' && notifCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#EF4444', color: '#fff' }}>{notifCount}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* === Desktop sidebar === */}
      <aside className="hidden lg:flex w-60 min-h-screen flex-col flex-shrink-0" style={{ background: '#fff', borderLeft: '1px solid #F0EEE8' }}>
        <div className="px-5 py-5" style={{ borderBottom: '1px solid #F0EEE8' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white" style={{ background: '#F97316' }}>Z</div>
            <div>
              <div className="font-black text-sm" style={{ color: '#1A1A1A' }}>ZimmerBot</div>
              <div className="text-xs" style={{ color: '#F97316' }}>אזור אישי</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={tab === id ? { background: 'rgba(249,115,22,0.1)', color: '#EA580C' } : { color: '#6B7280' }}
              onMouseEnter={e => { if (tab !== id) { e.currentTarget.style.background = '#F8F7F4'; e.currentTarget.style.color = '#1A1A1A'; } }}
              onMouseLeave={e => { if (tab !== id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280'; } }}>
              <Icon size={16} /><span>{label}</span>
              {id === 'updates' && notifCount > 0 && <span className="mr-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#EF4444', color: '#fff' }}>{notifCount}</span>}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 space-y-0.5" style={{ borderTop: '1px solid #F0EEE8' }}>
          <a href="/chat" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all" style={{ color: '#6B7280' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8F7F4'; e.currentTarget.style.color = '#1A1A1A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280'; }}>
            <ChevronRight size={16} /><span>חזרה לצ'אט</span>
          </a>
          <button onClick={() => api.auth.logout('/')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{ color: '#EF4444' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <LogOut size={16} /><span>התנתקות</span>
          </button>
        </div>

        <div className="px-4 py-4" style={{ borderTop: '1px solid #F0EEE8' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#F0EEE8', color: '#6B7280' }}>{initials}</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: '#1A1A1A' }}>{currentUser?.full_name || 'אורח'}</p>
              <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{currentUser?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* === Main content === */}
      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {/* Mobile: show user chip + back-to-chat link */}
        <div className="lg:hidden mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: '#F0EEE8', color: '#6B7280' }}>{initials}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{currentUser?.full_name || 'אורח'}</p>
              <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{currentUser?.email}</p>
            </div>
          </div>
          <a href="/chat" className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
            <ChevronRight size={13} /> לצ'אט
          </a>
        </div>

        {/* Active tab title (mobile) */}
        <div className="lg:hidden mb-3">
          <h1 className="text-xl font-black" style={{ color: '#1A1A1A' }}>{activeTab?.label}</h1>
        </div>

        {currentUser && tab === 'profile' && <CustomerProfileTab user={currentUser} />}
        {currentUser && tab === 'bookings' && <CustomerBookingsTab user={currentUser} />}
        {currentUser && tab === 'history' && <CustomerHistoryTab user={currentUser} />}
        {currentUser && tab === 'reviews' && <CustomerReviewsTab user={currentUser} focusReviewId={focusReviewId} />}
        {currentUser && tab === 'messages' && <CustomerMessagesTab user={currentUser} focusBookingId={focusChatId} />}
        {currentUser && tab === 'checkout' && <CustomerCheckoutTab user={currentUser} />}
        {currentUser && tab === 'questions' && <CustomerQuestionsTab user={currentUser} />}
        {currentUser && tab === 'updates' && <CustomerUpdatesTab user={currentUser} onAction={openNotificationAction} focusQuestionId={focusQuestionId} focusChatId={focusChatId} />}
      </main>
    </div>
  );
}