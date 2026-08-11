import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Search, UserPlus, X, ChevronRight, Phone, Mail, MapPin, MessageSquare, Calendar, Star, Trash2 } from 'lucide-react';

export default function CustomersPanel() {
  const [customers, setCustomers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', phone: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [deletingCustomer, setDeletingCustomer] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [users, profs, sess, books] = await Promise.all([
      api.entities.User.list(),
      api.entities.CustomerProfile.list(),
      api.entities.ChatSession.list('-created_date', 200),
      api.entities.BookingRequest.list('-created_date', 200),
    ]);
    // Only regular users (not owners/admins)
    const regularUsers = users.filter(u => u.role === 'user');
    setCustomers(regularUsers);
    setProfiles(profs);
    setSessions(sess);
    setBookings(books);
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) return;
    setInviting(true);
    setInviteMsg('');
    try {
      await api.users.inviteUser(inviteForm.email.trim(), 'user');
      // Pre-create profile if extra details given
      if (inviteForm.full_name || inviteForm.phone) {
        await api.entities.CustomerProfile.create({
          user_id: '__pending__' + inviteForm.email,
          user_name: inviteForm.full_name,
          user_email: inviteForm.email.trim(),
          phone: inviteForm.phone,
        });
      }
      setInviteMsg(`✅ הזמנה נשלחה ל-${inviteForm.email}`);
      setInviteForm({ email: '', full_name: '', phone: '' });
      setTimeout(() => { setShowInvite(false); setInviteMsg(''); loadAll(); }, 2000);
    } catch (e) {
      setInviteMsg('❌ שגיאה בשליחת ההזמנה');
    }
    setInviting(false);
  };

  const getProfile = (userId) => profiles.find(p => p.user_id === userId);
  const getUserSessions = (userId) => sessions.filter(s => s.user_id === userId);
  const getUserBookings = (userId, email) => {
    const profile = getProfile(userId);
    return bookings.filter(b =>
      b.guest_phone === profile?.phone ||
      (email && b.guest_name && customers.find(c => c.id === userId)?.full_name === b.guest_name)
    );
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q || c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const handleDeleteCustomer = async (customer) => {
    await api.entities.User.delete(customer.id);
    setDeletingCustomer(null);
    loadAll();
  };

  if (selected) {
    const profile = getProfile(selected.id);
    const userSessions = getUserSessions(selected.id);
    const userBookings = getUserBookings(selected.id, selected.email);

    return (
      <div>
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm transition-colors">
          <ChevronRight size={16} /> חזרה לרשימה
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/30 flex items-center justify-center text-2xl font-bold text-purple-300">
            {selected.full_name?.[0] || '?'}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{selected.full_name || 'ללא שם'}</h1>
            <p className="text-gray-400 text-sm">{selected.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><Star size={16} className="text-purple-400" /> פרופיל</h2>
            {profile ? (
              <div className="space-y-3 text-sm">
                {profile.phone && <div className="flex items-center gap-2 text-gray-300"><Phone size={14} className="text-gray-500" />{profile.phone}</div>}
                {profile.preferred_regions && <div className="flex items-center gap-2 text-gray-300"><MapPin size={14} className="text-gray-500" />{profile.preferred_regions}</div>}
                {profile.num_guests_usual && <div className="text-gray-400">בדרך כלל <span className="text-white font-medium">{profile.num_guests_usual}</span> אורחים</div>}
                {profile.vacation_preferences && (
                  <div className="mt-3 p-3 bg-gray-800 rounded-xl text-gray-300 text-xs leading-relaxed">
                    {profile.vacation_preferences}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">לא מילא פרופיל עדיין</p>
            )}
          </div>

          {/* Bookings */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><Calendar size={16} className="text-purple-400" /> הזמנות ({userBookings.length})</h2>
            {userBookings.length === 0 ? (
              <p className="text-gray-500 text-sm">אין הזמנות</p>
            ) : (
              <div className="space-y-3">
                {userBookings.map(b => (
                  <div key={b.id} className="p-3 bg-gray-800 rounded-xl text-xs">
                    <p className="text-white font-medium">{b.zimmer_name}</p>
                    <p className="text-gray-400 mt-0.5">{b.check_in} → {b.check_out}</p>
                    <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs ${b.status === 'אושרה' ? 'bg-green-400/10 text-green-400' : b.status === 'נדחתה' ? 'bg-red-400/10 text-red-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat Sessions */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><MessageSquare size={16} className="text-purple-400" /> שיחות ({userSessions.length})</h2>
            {userSessions.length === 0 ? (
              <p className="text-gray-500 text-sm">אין שיחות</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {userSessions.map(s => (
                  <div key={s.id} className="p-3 bg-gray-800 rounded-xl text-xs">
                    <p className="text-gray-400">{new Date(s.created_date).toLocaleDateString('he-IL')}</p>
                    {s.summary ? (
                      <p className="text-gray-300 mt-1 leading-relaxed">{s.summary}</p>
                    ) : (
                      <p className="text-gray-500 mt-1">{s.messages?.length || 0} הודעות</p>
                    )}
                    {s.booking_created && <span className="mt-1 inline-block bg-green-400/10 text-green-400 px-2 py-0.5 rounded-full">הזמנה נוצרה ✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-7 max-w-sm w-full mx-4 text-center bg-gray-900 border border-gray-700" dir="rtl">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-500/10">
              <Trash2 size={22} className="text-red-400" />
            </div>
            <h3 className="text-lg font-black mb-1 text-white">מחיקת לקוח</h3>
            <p className="text-sm mb-1 text-gray-400">האם למחוק את <strong className="text-white">{deletingCustomer.full_name || deletingCustomer.email}</strong>?</p>
            <p className="text-xs mb-6 text-red-400">פעולה זו אינה הפיכה</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingCustomer(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-700 text-gray-400">ביטול</button>
              <button onClick={() => handleDeleteCustomer(deletingCustomer)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600">מחק</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">לקוחות ({filtered.length})</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors w-full sm:w-auto"
        >
          <UserPlus size={16} /> הוסף לקוח חדש
        </button>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">הוספת לקוח חדש</h2>
              <button onClick={() => { setShowInvite(false); setInviteMsg(''); }} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">מייל *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">שם מלא (אופציונלי)</label>
                <input
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="שם הלקוח"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">טלפון (אופציונלי)</label>
                <input
                  value={inviteForm.phone}
                  onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="050-0000000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500"
                />
              </div>
              <p className="text-gray-500 text-xs">הלקוח יקבל הזמנה למייל ויוכל להתחבר עם גוגל. אם המייל שלו ב-Google תואם — הוא יכנס לדף האישי שלו מיד.</p>
              {inviteMsg && <p className="text-sm text-center">{inviteMsg}</p>}
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteForm.email.trim()}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {inviting ? 'שולח הזמנה...' : 'שלח הזמנה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם או מייל..."
          className="w-full bg-gray-900 border border-gray-800 rounded-xl pr-9 pl-4 py-2.5 text-white text-sm outline-none focus:border-purple-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-gray-700 border-t-purple-500 rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #EAD5FF 0%, #FFD4C2 100%)' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="11" cy="10" r="4" stroke="#9CA3AF" strokeWidth="1.8"/><circle cx="21" cy="10" r="4" stroke="#9CA3AF" strokeWidth="1.8"/><path d="M3 26c0-4.4 3.6-8 8-8h10c4.4 0 8 3.6 8 8" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <p style={{ color: '#9CA3AF' }}>אין לקוחות עדיין</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const profile = getProfile(c.id);
            const sessCount = getUserSessions(c.id).length;
            return (
              <div key={c.id} className="bg-gray-900 border border-gray-800 hover:border-purple-600/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                <button onClick={() => setSelected(c)} className="flex items-center gap-4 flex-1 text-right">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center font-bold text-purple-300 flex-shrink-0">
                    {c.full_name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{c.full_name || 'ללא שם'}</p>
                    <p className="text-gray-400 text-sm">{c.email}</p>
                    {profile?.phone && <p className="text-gray-500 text-xs mt-0.5">{profile.phone}</p>}
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-wrap text-sm text-gray-500">
                  <span>💬 {sessCount} שיחות</span>
                  <button onClick={() => setDeletingCustomer(c)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
                    <Trash2 size={12} /> מחק
                  </button>
                  <ChevronRight size={16} className="text-gray-600 cursor-pointer" onClick={() => setSelected(c)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}