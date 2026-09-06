import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Home, ClipboardList, MessageSquare, CalendarDays, Users, Settings, Database, Star, Bot, Tag, Bell, Key, Video, Plus, BarChart3 } from 'lucide-react';
import OwnerStatistics from '@/pages/OwnerStatistics';
import AccountSettings from '@/pages/AccountSettings';
import BookingCreatorChat from '@/components/owner/BookingCreatorChat';
import ZimmerEditor from '@/components/admin/ZimmerEditor';
import ZimmerView from '@/components/admin/ZimmerView';
import ZimmerCreatorChat from '@/components/admin/ZimmerCreatorChat';
import AdminAssistantChat from '@/components/admin/AdminAssistantChat';
import OwnerBookingsPage from '@/components/owner/bookings/OwnerBookingsPage';
import OwnerCalendar from '@/components/owner/OwnerCalendar';
import ContactsBook from '@/components/owner/ContactsBook';
import ZimmerDatabase from '@/components/owner/ZimmerDatabase';
import ReviewsPanel from '@/components/owner/ReviewsPanel';
import QuestionsPanel from '@/components/owner/QuestionsPanel';
import PromotionsPanel from '@/components/owner/PromotionsPanel';
import OwnerInfoAssistant from '@/components/owner/OwnerInfoAssistant';
import OwnerUpdatesPanel from '@/components/owner/OwnerUpdatesPanel';
import OwnerCheckinSettings from '@/components/owner/OwnerCheckinSettings';
import OwnerVideos from '@/components/owner/OwnerVideos';
import OwnerTopBar from '@/components/owner/OwnerTopBar';
import OwnerHamburger from '@/components/owner/OwnerHamburger';
import OwnerAssistantHome from '@/components/owner/OwnerAssistantHome';
import OwnerDashboardSidebar from '@/components/owner/OwnerDashboardSidebar';
import { useOwnerSystemUnread } from '@/hooks/useOwnerSystemUnread';

export default function OwnerPanel() {
  const [tab, setTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [zimmers, setZimmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingZimmer, setEditingZimmer] = useState(null);
  const [viewingZimmer, setViewingZimmer] = useState(null);
  const [usingCreatorChat, setUsingCreatorChat] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showBookingCreator, setShowBookingCreator] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [focusBookingId, setFocusBookingId] = useState(null);
  const [focusQuestionId, setFocusQuestionId] = useState(null);
  const [focusChatId, setFocusChatId] = useState(null);
  const [focusReviewId, setFocusReviewId] = useState(null);

  useEffect(() => {
    api.auth.me().then(u => { setCurrentUser(u); loadZimmers(u.id); });
  }, []);

  const openNotificationAction = (actionType, entityId) => {
    if (!actionType || !entityId) { setTab('updates'); return; }
    if (actionType === 'answer_question') {
      setFocusQuestionId(entityId); setTab('updates'); setTimeout(() => setFocusQuestionId(null), 200);
    } else if (actionType === 'open_chat') {
      setFocusChatId(entityId); setTab('updates'); setTimeout(() => setFocusChatId(null), 200);
    } else if (actionType === 'open_review') {
      setFocusReviewId(entityId); setTab('reviews'); setTimeout(() => setFocusReviewId(null), 500);
    } else {
      setFocusBookingId(entityId); setTab('bookings'); setTimeout(() => setFocusBookingId(null), 200);
    }
  };

  const { count: notifCount, markAllRead: markSystemRead } = useOwnerSystemUnread(currentUser?.id);

  const loadZimmers = async (ownerId) => {
    setLoading(true);
    const data = await api.entities.Zimmer.filter({ owner_id: ownerId });
    setZimmers(data);
    setLoading(false);
  };

  const handleSave = async (data) => {
    if (data.id) {
      await api.entities.Zimmer.update(data.id, data);
    } else {
      await api.entities.Zimmer.create({ ...data, owner_id: currentUser?.id, owner_name: currentUser?.full_name, approval_status: 'אושר' });
    }
    setEditingZimmer(null);
    loadZimmers(currentUser?.id);
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק את הצימר?')) return;
    await api.entities.Zimmer.delete(id);
    setEditingZimmer(null);
    setViewingZimmer(null);
    loadZimmers(currentUser?.id);
  };

  if (usingCreatorChat) return <ZimmerCreatorChat onSave={async (data) => { await handleSave(data); setUsingCreatorChat(false); }} onCancel={() => setUsingCreatorChat(false)} />;
  if (viewingZimmer !== null) return <ZimmerView
    zimmer={viewingZimmer}
    onCancel={() => setViewingZimmer(null)}
    onUpdated={(updated) => { setViewingZimmer(updated); setZimmers(prev => prev.map(z => z.id === updated.id ? updated : z)); }}
    onDelete={handleDelete}
  />;
  if (editingZimmer !== null) return <ZimmerEditor zimmer={editingZimmer} onSave={handleSave} onCancel={() => setEditingZimmer(null)} onDelete={handleDelete} />;

  const navItems = [
    { id: 'home', label: 'היום', shortLabel: 'היום', icon: Home },
    { id: 'assistant', label: 'עוזר אישי AI', icon: Bot },
    { id: 'calendar', label: 'יומן', shortLabel: 'יומן', icon: CalendarDays },
    { id: 'zimmers', label: 'הצימרים שלי', shortLabel: 'נכסים', icon: Home },
    { id: 'videos', label: 'וידאו', icon: Video },
    { id: 'bookings', label: 'הזמנות', shortLabel: 'הזמנות', icon: ClipboardList },
    { id: 'contacts', label: 'אנשי קשר', icon: Users },
    { id: 'checkin', label: 'הודעות אוטומטיות', icon: Key },
    { id: 'database', label: 'דאטאבייס ידע', icon: Database },
    { id: 'reviews', label: 'ביקורות', icon: Star },
    { id: 'questions', label: 'שאלות לקוחות', icon: MessageSquare },
    { id: 'statistics', label: 'סטטיסטיקות', icon: BarChart3 },
    { id: 'updates', label: 'עדכונים והודעות', shortLabel: 'הודעות', icon: Bell },
    { id: 'promotions', label: 'מבצעים וקידומים', icon: Tag },
    { id: 'settings', label: 'הגדרות חשבון', icon: Settings },
  ];
  const primaryIds = ['home', 'calendar', 'zimmers', 'updates', 'bookings'];
  const primaryNav = navItems.filter(n => primaryIds.includes(n.id));

  const handleNav = (id) => { setTab(id); setSidebarOpen(false); };
  const handleHomeChat = (text) => { setAssistantPrompt(text); setTab('assistant'); };
  const handleCalendarAI = (iso, zimmerName) => {
    const z = zimmerName ? ` עבור הנכס "${zimmerName}"` : '';
    setAssistantPrompt(`הצעות מבוססות שוק לתאריך ${iso}${z}. אנא הצע המלצות מחיר וזמינות.`);
    setTab('assistant');
  };
  const handleQuickAction = (type) => {
    if (type === 'add_booking') setShowBookingCreator(true);
    else if (type === 'block_date') setTab('calendar');
    else if (type === 'update_price') { if (zimmers[0]) setEditingZimmer(zimmers[0]); }
    else if (type === 'create_promo') setTab('promotions');
  };

  return (
    <div className="min-h-screen flex flex-col" dir="rtl" style={{ background: '#F9FAFB', fontFamily: 'Heebo, sans-serif' }}>
      {showAssistant && <AdminAssistantChat onClose={() => setShowAssistant(false)} onRefresh={() => loadZimmers(currentUser?.id)} />}
      {showBookingCreator && <BookingCreatorChat onClose={() => setShowBookingCreator(false)} onSaved={() => { setShowBookingCreator(false); setTab('bookings'); }} zimmers={zimmers} ownerId={currentUser?.id} />}

      <OwnerTopBar
        tab={tab}
        primaryNav={primaryNav}
        onNav={handleNav}
        onAddBooking={() => setShowBookingCreator(true)}
        notifCount={notifCount}
        onBell={() => setTab('updates')}
        onSpark={() => setTab('assistant')}
        onHamburger={() => setSidebarOpen(true)}
      />

      <OwnerHamburger
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navItems={navItems}
        tab={tab}
        onNav={handleNav}
        notifCount={notifCount}
        currentUser={currentUser}
        onLogout={() => api.auth.logout('/')}
      />

      <div className="flex flex-1 overflow-hidden">
      <main className={`flex-1 overflow-auto ${tab === 'assistant' || tab === 'bookings' ? '' : 'p-4 sm:p-6 lg:p-8'}`}>
        {tab === 'home' && (
          <OwnerAssistantHome
            ownerId={currentUser?.id}
            zimmers={zimmers}
            loading={loading}
            onChat={handleHomeChat}
            onQuickAction={handleQuickAction}
            onNavigate={(t) => setTab(t)}
            onAddBooking={() => setShowBookingCreator(true)}
          />
        )}
        {tab === 'assistant' && (
          <OwnerInfoAssistant
            ownerId={currentUser?.id}
            initialPrompt={assistantPrompt}
            onPromptConsumed={() => setAssistantPrompt('')}
            onMutated={() => loadZimmers(currentUser?.id)}
            onNavigate={(target) => {
              if (target === 'booking_creator') setShowBookingCreator(true);
              else if (target === 'new_zimmer') setUsingCreatorChat(true);
              else setTab(target);
            }}
          />
        )}
        {tab === 'calendar' && <OwnerCalendar ownerId={currentUser?.id} zimmers={zimmers} onAddBookingText={() => setShowBookingCreator(true)} onZimmerUpdated={() => loadZimmers(currentUser?.id)} onOpenAI={handleCalendarAI} />}
        {tab === 'contacts' && <ContactsBook ownerId={currentUser?.id} />}
        {tab === 'checkin' && <OwnerCheckinSettings ownerId={currentUser?.id} />}
        {tab === 'database' && <ZimmerDatabase ownerId={currentUser?.id} />}
        {tab === 'reviews' && <ReviewsPanel ownerId={currentUser?.id} focusReviewId={focusReviewId} />}
        {tab === 'questions' && <QuestionsPanel ownerId={currentUser?.id} />}
        {tab === 'updates' && <OwnerUpdatesPanel user={currentUser} onAction={openNotificationAction} focusQuestionId={focusQuestionId} focusChatId={focusChatId} onMarkSystemRead={markSystemRead} onAddBooking={() => setShowBookingCreator(true)} onNavigate={(t) => setTab(t)} />}
        {tab === 'videos' && <OwnerVideos ownerId={currentUser?.id} />}
        {tab === 'promotions' && <PromotionsPanel ownerId={currentUser?.id} />}
        {tab === 'statistics' && <OwnerStatistics ownerId={currentUser?.id} onNavigate={(t) => setTab(t)} />}
        {tab === 'settings' && <AccountSettings embedded />}
        {tab === 'bookings' && (
          <OwnerBookingsPage ownerId={currentUser?.id} zimmers={zimmers} onAddBooking={() => setShowBookingCreator(true)} focusBookingId={focusBookingId} onQuickAction={handleQuickAction} />
        )}
        {tab === 'zimmers' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 lg:mb-8">
              <div>
                <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>הצימרים שלי</h1>
                <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>{zimmers.length} נכסים</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setShowAssistant(true)} className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C', border: '1.5px solid rgba(249,115,22,0.2)' }}>
                  <MessageSquare size={15} /><span className="hidden sm:inline">עוזר ניהול AI</span><span className="sm:hidden">עוזר AI</span>
                </button>
                <button onClick={() => setUsingCreatorChat(true)} className="flex items-center gap-2 text-white px-3 sm:px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90" style={{ background: '#F97316' }}>
                  <Plus size={16} /><span>צימר חדש</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
              </div>
            ) : zimmers.length === 0 ? (
              <div className="text-center py-24 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <div className="flex items-center justify-center mb-4">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#EAD5FF 0%,#FFD4C2 100%)' }}>
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M20 5L5 16v19h10v-9h10v9h10V16L20 5z" stroke="#9CA3AF" strokeWidth="2" strokeLinejoin="round" /></svg>
                  </div>
                </div>
                <h3 className="text-lg font-black mb-2" style={{ color: '#1A1A1A' }}>אין צימרים עדיין</h3>
                <p className="mb-6 text-sm" style={{ color: '#9CA3AF' }}>התחל על ידי הוספת הצימר הראשון שלך</p>
                <button onClick={() => setUsingCreatorChat(true)} className="text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90" style={{ background: '#F97316' }}>
                  הוסף צימר ראשון
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {zimmers.map(z => (
                  <ZimmerListCard key={z.id} zimmer={z} onView={() => setViewingZimmer(z)} onEdit={() => setEditingZimmer(z)} onDelete={() => handleDelete(z.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      {tab === 'home' && (
        <aside className="hidden lg:block w-72 flex-shrink-0" style={{ borderRight: '1px solid #F0EEE8' }}>
          <OwnerDashboardSidebar ownerId={currentUser?.id} zimmers={zimmers} currentUser={currentUser} tab={tab} onAction={openNotificationAction} onNavigate={(t) => setTab(t)} onEditZimmer={(z) => setEditingZimmer(z)} />
        </aside>
      )}
      </div>
    </div>
  );
}

function ZimmerListCard({ zimmer, onView, onEdit, onDelete }) {
  const img = zimmer.images?.[0];
  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer group"
      style={{ background: '#fff', border: '1.5px solid #F0EEE8' }} onClick={onView}>
      <div className="h-52 relative overflow-hidden" style={{ background: '#F8F7F4' }}>
        {img
          ? <img src={img} alt={zimmer.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #EAD5FF 0%, #FFD4C2 100%)' }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none"><path d="M28 8L8 22v26h14V34h12v14h14V22L28 8z" stroke="#9CA3AF" strokeWidth="2.5" strokeLinejoin="round" fill="none" /></svg>
          </div>
        }
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 50%)' }} />
        {zimmer.price_per_night && (
          <div className="absolute bottom-3 right-3 text-white text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#F97316' }}>
            ₪{zimmer.price_per_night}/לילה
          </div>
        )}
        {zimmer.approval_status && (
          <div className="absolute top-3 left-3">
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={zimmer.approval_status === 'אושר'
                ? { background: 'rgba(34,197,94,0.15)', color: '#16A34A' }
                : { background: 'rgba(249,115,22,0.15)', color: '#EA580C' }}>
              {zimmer.approval_status}
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-base mb-1 truncate" style={{ color: '#1A1A1A' }}>{zimmer.name}</h3>
        <p className="text-sm mb-3 truncate" style={{ color: '#9CA3AF' }}>{zimmer.location || 'מיקום לא צוין'}</p>
        <div className="flex gap-3 text-xs mb-4" style={{ color: '#9CA3AF' }}>
          {zimmer.num_rooms && <span>🛏 {zimmer.num_rooms} חדרים</span>}
          {zimmer.max_guests && <span>👤 עד {zimmer.max_guests}</span>}
          <span>📋 {(zimmer.data_zones || []).length} אזורים</span>
        </div>
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.16)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.08)'}>
            עריכה
          </button>
          <button onClick={onDelete}
            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(239,68,68,0.06)', color: '#EF4444' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}>
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}
