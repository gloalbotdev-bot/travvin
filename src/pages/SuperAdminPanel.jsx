import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Users, Home, ClipboardList, LogOut, UserPlus, MessageSquare, Search, X, Menu, UserCheck, ChevronRight, Trash2, Plus, PenLine, ShieldCheck, Megaphone, LayoutDashboard, Bot, Star, Video } from 'lucide-react';
import ChatHistoryPanel from '@/components/superadmin/ChatHistoryPanel';
import CustomersPanel from '@/components/superadmin/CustomersPanel';
import AddOwnerPanel from '@/components/superadmin/AddOwnerPanel';
import ZimmerView from '@/components/admin/ZimmerView';
import ZimmerEditor from '@/components/admin/ZimmerEditor';
import ZimmerCreatorChat from '@/components/admin/ZimmerCreatorChat';
import EditOwnerModal from '@/components/superadmin/EditOwnerModal';
import AdminsPanel from '@/components/superadmin/AdminsPanel';
import MessagesPanel from '@/components/superadmin/MessagesPanel';
import BookingsList from '@/components/admin/BookingsList';
import SuperAdminReviewsPanel from '@/components/superadmin/SuperAdminReviewsPanel';
import SuperAdminDashboard from '@/components/superadmin/SuperAdminDashboard';
import BookingCreatorChat from '@/components/owner/BookingCreatorChat';
import SuperAdminVideos from '@/components/superadmin/SuperAdminVideos';

export default function SuperAdminPanel() {
  const [tab, setTab] = useState('dashboard');
  const [owners, setOwners] = useState([]);
  const [allZimmers, setAllZimmers] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [zimmerSearch, setZimmerSearch] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [viewingZimmer, setViewingZimmer] = useState(null);
  const [editingZimmer, setEditingZimmer] = useState(null);
  const [deletingOwner, setDeletingOwner] = useState(null);
  const [deletingZimmer, setDeletingZimmer] = useState(null);
  const [editingOwner, setEditingOwner] = useState(null);
  const [creatingZimmer, setCreatingZimmer] = useState(false);
  const [newZimmerOwnerId, setNewZimmerOwnerId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [adminPermission, setAdminPermission] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [showBookingCreator, setShowBookingCreator] = useState(false);

  useEffect(() => {
    api.auth.me().then(async (u) => {
      setCurrentUser(u);
      // Check if user email is in AdminPermission whitelist
      const admins = await api.entities.AdminPermission.filter({ email: u.email.toLowerCase() });
      const match = admins.find(a => a.is_active !== false);
      if (match) {
        setAdminPermission(match);
      } else if (u.role !== 'admin') {
        setAccessDenied(true);
      } else {
        // Existing admins (by role) get full access
        setAdminPermission({ allowed_pages: null }); // null = all pages
      }
    });
  }, []);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [users, zimmers, bookings] = await Promise.all([
      api.entities.User.list(),
      api.entities.Zimmer.list(),
      api.entities.BookingRequest.list('-created_date', 100),
    ]);
    // Include owners by role AND users who have zimmers (self-registered)
    const zimmerOwnerIds = new Set(zimmers.map(z => z.owner_id).filter(Boolean));
    const ownerList = users.filter(u =>
      u.role === 'owner' || u.role === 'admin' || zimmerOwnerIds.has(u.id)
    );
    setOwners(ownerList);
    setAllZimmers(zimmers);
    setAllBookings(bookings);
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg('');
    try {
      await api.users.inviteUser(inviteEmail.trim(), 'owner');
      setInviteMsg(`✅ הזמנה נשלחה ל-${inviteEmail}`);
      setInviteEmail('');
    } catch (e) {
      setInviteMsg('❌ שגיאה בשליחת ההזמנה');
    }
    setInviting(false);
  };

  const handleDeleteOwner = async (owner) => {
    await api.entities.User.delete(owner.id);
    setDeletingOwner(null);
    if (currentUser?.id === owner.id) {
      api.auth.logout('/');
    } else {
      loadAll();
    }
  };

  const zimmerCountForOwner = (ownerId) => allZimmers.filter(z => z.owner_id === ownerId).length;
  const bookingCountForOwner = (ownerId) => {
    const ids = allZimmers.filter(z => z.owner_id === ownerId).map(z => z.id);
    return allBookings.filter(b => ids.includes(b.zimmer_id)).length;
  };

  const handleZimmerSave = async (data) => {
    let saved;
    if (data.id) {
      saved = await api.entities.Zimmer.update(data.id, data);
    } else {
      saved = await api.entities.Zimmer.create(data);
    }
    const next = saved || data;
    setEditingZimmer(null);
    if (next?.id && viewingZimmer?.id === next.id) {
      setViewingZimmer(next);
    }
    setAllZimmers((prev) => {
      if (!next?.id) return prev;
      const exists = prev.some((z) => z.id === next.id);
      return exists ? prev.map((z) => (z.id === next.id ? next : z)) : [...prev, next];
    });
    await loadAll();
    return next;
  };

  if (accessDenied) return (
    <div className="min-h-screen flex items-center justify-center" dir="rtl" style={{ background: '#F8F7F4', fontFamily: 'Heebo, sans-serif' }}>
      <div className="text-center p-8 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <ShieldCheck size={40} className="mx-auto mb-4" style={{ color: '#EF4444' }} />
        <h2 className="text-xl font-black mb-2" style={{ color: '#1A1A1A' }}>אין גישה</h2>
        <p className="text-sm mb-4" style={{ color: '#9CA3AF' }}>האימייל שלך אינו מורשה לגישה לפאנל הניהול</p>
        <a href="/" className="text-sm font-semibold" style={{ color: '#F97316' }}>חזרה לדף הבית</a>
      </div>
    </div>
  );

  const allowedPages = adminPermission?.allowed_pages; // null = all pages allowed

  if (viewingZimmer) {
    return (
      <ZimmerView
        zimmer={viewingZimmer}
        onCancel={() => setViewingZimmer(null)}
        onSave={handleZimmerSave}
        onUpdated={(updated) => {
          setViewingZimmer(updated);
          setAllZimmers((prev) => prev.map((z) => (z.id === updated.id ? updated : z)));
        }}
      />
    );
  }
  if (editingZimmer) return <ZimmerEditor zimmer={editingZimmer} onSave={handleZimmerSave} onCancel={() => setEditingZimmer(null)} />;
  if (creatingZimmer) return <ZimmerCreatorChat onSave={async (data) => { await api.entities.Zimmer.create({ ...data, owner_id: newZimmerOwnerId, owner_name: owners.find(o => o.id === newZimmerOwnerId)?.full_name || '' }); setCreatingZimmer(false); setNewZimmerOwnerId(''); loadAll(); }} onCancel={() => { setCreatingZimmer(false); setNewZimmerOwnerId(''); }} />;

  const allNavItems = [
    { id: 'dashboard', label: 'דאשבורד', icon: LayoutDashboard },
    { id: 'owners', label: 'בעלי מתחמים', icon: Users },
    { id: 'zimmers', label: 'כל הצימרים', icon: Home },
    { id: 'bookings', label: 'כל ההזמנות', icon: ClipboardList },
    { id: 'videos', label: 'וידאו', icon: Video },
    { id: 'customers', label: 'לקוחות', icon: UserCheck },
    { id: 'add_owner', label: 'הוסף בעל מתחם', icon: UserPlus },
    { id: 'chat_history', label: 'היסטוריית התכתבויות', icon: MessageSquare },
    { id: 'messages', label: 'הודעות ועדכונים', icon: Megaphone },
    { id: 'reviews', label: 'ניהול ביקורות', icon: Star },
    { id: 'ai_bookings', label: 'עוזר AI להזמנות', icon: Bot },
    { id: 'admins', label: 'ניהול אדמינים', icon: ShieldCheck },
  ];
  // Filter nav by allowed_pages (null = all allowed); 'admins' tab only for primary or full-access
  const navItems = allNavItems.filter(item => {
    if (!allowedPages) return true;
    if (item.id === 'admins') return adminPermission?.is_primary || !allowedPages;
    if (item.id === 'dashboard') return true; // דאשבורד — זמין לכל מנהל
    if (item.id === 'messages') return true; // הודעות ועדכונים — זמין לכל מנהל
    if (item.id === 'reviews') return true; // ניהול ביקורות — זמין לכל מנהל
    if (item.id === 'ai_bookings') return true; // עוזר AI להזמנות — זמין לכל מנהל
    if (item.id === 'videos') return true; // וידאו — זמין לכל מנהל
    return allowedPages.includes(item.id);
  });

  const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A', outline: 'none', borderRadius: '12px' };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" dir="rtl" style={{ background: '#F8F7F4', fontFamily: 'Heebo, sans-serif' }}>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3" style={{ background: '#fff', borderBottom: '1px solid #F0EEE8' }}>
        <button onClick={() => setMobileNav(true)} aria-label="תפריט" className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0' }}>
          <Menu size={18} style={{ color: '#1A1A1A' }} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1A1A1A' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 13l2-6 3 3 2-5 2 5 3-3 2 6H2z" stroke="#F97316" strokeWidth="1.5" strokeLinejoin="round"/></svg>
          </div>
          <span className="font-black text-sm" style={{ color: '#1A1A1A' }}>ZimmerBot · אדמין-על</span>
        </div>
      </header>
      {/* Sidebar backdrop (mobile) */}
      {mobileNav && <div className="lg:hidden fixed inset-0 z-30" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setMobileNav(false)} />}
      {/* Delete Confirm Dialog */}
      {deletingOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-7 max-w-sm w-full mx-4 text-center" dir="rtl" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Trash2 size={22} style={{ color: '#EF4444' }} />
            </div>
            <h3 className="text-lg font-black mb-1" style={{ color: '#1A1A1A' }}>מחיקת משתמש</h3>
            <p className="text-sm mb-1" style={{ color: '#6B7280' }}>האם למחוק את <strong>{deletingOwner.full_name || deletingOwner.email}</strong>?</p>
            <p className="text-xs mb-6" style={{ color: '#EF4444' }}>פעולה זו אינה הפיכה</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingOwner(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
                ביטול
              </button>
              <button onClick={() => handleDeleteOwner(deletingOwner)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: '#EF4444' }}>
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Zimmer Dialog */}
      {deletingZimmer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-7 max-w-sm w-full mx-4 text-center" dir="rtl" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Trash2 size={22} style={{ color: '#EF4444' }} />
            </div>
            <h3 className="text-lg font-black mb-1" style={{ color: '#1A1A1A' }}>מחיקת צימר</h3>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>האם למחוק את <strong>{deletingZimmer.name}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingZimmer(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>ביטול</button>
              <button onClick={async () => { await api.entities.Zimmer.delete(deletingZimmer.id); setDeletingZimmer(null); loadAll(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90" style={{ background: '#EF4444' }}>מחק</button>
            </div>
          </div>
        </div>
      )}
      {editingOwner && <EditOwnerModal owner={editingOwner} onClose={() => setEditingOwner(null)} onSaved={loadAll} />}
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 right-0 z-40 w-72 lg:w-60 min-h-screen lg:min-h-0 flex flex-col flex-shrink-0 transform transition-transform duration-300 ${mobileNav ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`} style={{ background: '#fff', borderLeft: '1px solid #F0EEE8' }}>
        <div className="px-5 py-5" style={{ borderBottom: '1px solid #F0EEE8' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#1A1A1A' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13l2-6 3 3 2-5 2 5 3-3 2 6H2z" stroke="#F97316" strokeWidth="1.5" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div className="font-black text-sm" style={{ color: '#1A1A1A' }}>ZimmerBot</div>
              <div className="text-xs" style={{ color: '#F97316' }}>אדמין-על</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { if (id === 'ai_bookings') { setShowBookingCreator(true); setMobileNav(false); return; } setTab(id); setMobileNav(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={tab === id ? { background: 'rgba(249,115,22,0.1)', color: '#EA580C' } : { color: '#6B7280' }}
              onMouseEnter={e => { if (tab !== id) { e.currentTarget.style.background = '#F8F7F4'; e.currentTarget.style.color = '#1A1A1A'; } }}
              onMouseLeave={e => { if (tab !== id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280'; } }}>
              <Icon size={16} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 space-y-0.5" style={{ borderTop: '1px solid #F0EEE8' }}>
          <a href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all" style={{ color: '#6B7280' }}
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
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {tab === 'owners' && (
              <div>
                <h1 className="text-xl sm:text-2xl font-black mb-6" style={{ color: '#1A1A1A' }}>בעלי מתחמים ({owners.length})</h1>

                {/* Invite */}
                <div className="rounded-2xl p-5 mb-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                  <h2 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                    <UserPlus size={15} style={{ color: '#F97316' }} /> הזמן בעל מתחם חדש
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleInvite()}
                      placeholder="כתובת אימייל..." className="flex-1 px-4 py-2.5 text-sm" style={inputStyle} />
                    <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                      className="px-5 py-2.5 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 hover:opacity-90 w-full sm:w-auto"
                      style={{ background: '#F97316' }}>
                      {inviting ? 'שולח...' : 'שלח הזמנה'}
                    </button>
                  </div>
                  {inviteMsg && <p className="text-sm mt-2" style={{ color: '#6B7280' }}>{inviteMsg}</p>}
                </div>

                {/* Self-register link */}
                <div className="rounded-2xl p-5 mb-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                  <h2 className="font-bold text-sm mb-3" style={{ color: '#1A1A1A' }}>🔗 קישור הרשמה עצמית</h2>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 px-4 py-2.5 text-sm font-mono rounded-xl break-all" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
                      {window.location.origin}/join
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join`)}
                      className="px-4 py-2.5 text-white rounded-xl text-sm font-bold hover:opacity-90 w-full sm:w-auto" style={{ background: '#F97316' }}>
                      העתק
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {owners.map(owner => (
                    <div key={owner.id} className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#F0EEE8', color: '#6B7280' }}>
                          {owner.full_name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>{owner.full_name || 'ללא שם'}</p>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>{owner.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: '#9CA3AF' }}>
                        <span>🏠 {zimmerCountForOwner(owner.id)}</span>
                        <span>📋 {bookingCountForOwner(owner.id)}</span>
                        <button onClick={() => setEditingOwner(owner)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all"
                          style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.16)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.08)'}>
                          <PenLine size={12} /> עריכה
                        </button>
                        <button onClick={() => setDeletingOwner(owner)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all"
                          style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.16)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}>
                          <Trash2 size={12} /> מחק
                        </button>
                      </div>
                    </div>
                  ))}
                  {owners.length === 0 && (
                    <div className="text-center py-10 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #EAD5FF 0%, #FFD4C2 100%)' }}>
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="12" cy="10" r="4" stroke="#9CA3AF" strokeWidth="1.8"/><path d="M4 26c0-4.4 3.6-8 8-8" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round"/><path d="M20 16l2 2 4-4" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <p className="text-sm" style={{ color: '#9CA3AF' }}>אין בעלי מתחמים עדיין</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'dashboard' && <SuperAdminDashboard onNavigate={setTab} />}
            {tab === 'customers' && <CustomersPanel />}
            {tab === 'add_owner' && <AddOwnerPanel onInvited={loadAll} />}
            {tab === 'chat_history' && <ChatHistoryPanel />}
            {tab === 'messages' && <MessagesPanel />}
            {tab === 'reviews' && <SuperAdminReviewsPanel />}
            {tab === 'videos' && <SuperAdminVideos />}
            {tab === 'admins' && <AdminsPanel />}

            {tab === 'zimmers' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <h1 className="text-xl sm:text-2xl font-black" style={{ color: '#1A1A1A' }}>כל הצימרים ({allZimmers.length})</h1>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <select value={newZimmerOwnerId} onChange={e => setNewZimmerOwnerId(e.target.value)} className="px-4 py-2.5 text-sm w-full sm:w-auto" style={inputStyle}>
                      <option value="">בחר בעל מתחם לצימר חדש</option>
                      {owners.map(o => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}
                    </select>
                    <button onClick={() => { if (!newZimmerOwnerId) { alert('בחר בעל מתחם תחילה'); return; } setCreatingZimmer(true); }}
                      className="flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                      style={{ background: '#F97316' }}>
                      <Plus size={16} /> צימר חדש
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mb-6">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                    <input value={zimmerSearch} onChange={e => setZimmerSearch(e.target.value)} placeholder="חיפוש לפי שם..."
                      className="w-full pr-9 pl-4 py-2.5 text-sm" style={inputStyle} />
                  </div>
                  <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className="px-4 py-2.5 text-sm" style={inputStyle}>
                    <option value="">כל הבעלים</option>
                    {owners.map(o => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}
                  </select>
                  <input value={filterRegion} onChange={e => setFilterRegion(e.target.value)} placeholder="סינון לפי אזור..."
                    className="px-4 py-2.5 text-sm" style={inputStyle} />
                  {(zimmerSearch || filterOwner || filterRegion) && (
                    <button onClick={() => { setZimmerSearch(''); setFilterOwner(''); setFilterRegion(''); }}
                      className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl transition-all"
                      style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
                      <X size={13} /> נקה
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {allZimmers
                    .filter(z => {
                      const matchSearch = !zimmerSearch || z.name?.includes(zimmerSearch);
                      const matchOwner = !filterOwner || z.owner_id === filterOwner;
                      const matchRegion = !filterRegion || (z.location || '').includes(filterRegion);
                      return matchSearch && matchOwner && matchRegion;
                    })
                    .map(z => {
                      const ownerUser = owners.find(o => o.id === z.owner_id);
                      return (
                        <div key={z.id} className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl group"
                          style={{ background: '#fff', border: '1.5px solid #F0EEE8' }} onClick={() => setViewingZimmer(z)}>
                          <div className="h-44 relative overflow-hidden" style={{ background: '#F8F7F4' }}>
                            {z.images?.[0]
                              ? <img src={z.images[0]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={z.name} />
                              : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #EAD5FF 0%, #FFD4C2 100%)' }}>
                            <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M22 6L6 18v20h11v-10h10v10h11V18L22 6z" stroke="#9CA3AF" strokeWidth="2.2" strokeLinejoin="round"/></svg>
                          </div>
                            }
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 50%)' }} />
                            {z.price_per_night && (
                              <div className="absolute bottom-3 right-3 text-white text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#F97316' }}>
                                ₪{z.price_per_night}/לילה
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <p className="font-bold truncate" style={{ color: '#1A1A1A' }}>{z.name}</p>
                            <p className="text-xs mt-0.5 truncate" style={{ color: '#9CA3AF' }}>{z.location}</p>
                            {ownerUser && <p className="text-xs mt-1 font-medium" style={{ color: '#F97316' }}>👤 {ownerUser.full_name || ownerUser.email}</p>}
                            <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                              <button onClick={() => setEditingZimmer(z)}
                                className="flex-1 py-1.5 rounded-xl text-xs font-semibold"
                                style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}>
                                <PenLine size={12} className="inline ml-1" />עריכה
                              </button>
                              <button onClick={() => setDeletingZimmer(z)}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                                style={{ background: 'rgba(239,68,68,0.06)', color: '#EF4444' }}>
                                🗑
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {tab === 'bookings' && <BookingsList />}
          </>
        )}
      </main>

      {showBookingCreator && (
        <BookingCreatorChat
          zimmers={allZimmers}
          onSaved={() => { setShowBookingCreator(false); loadAll(); setTab('bookings'); }}
          onClose={() => setShowBookingCreator(false)}
        />
      )}
    </div>
  );
}