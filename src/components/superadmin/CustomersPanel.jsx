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
      await api.users.inviteUser(inviteForm.email.trim(), 'user', {
        full_name: inviteForm.full_name.trim(),
        phone: inviteForm.phone.trim(),
      });
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
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 mb-6 text-sm transition-colors" style={{ color: '#6B7280' }}>
          <ChevronRight size={16} /> חזרה לרשימה
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold" style={{ background: 'rgba(249,115,22,0.12)', color: '#EA580C' }}>
            {selected.full_name?.[0] || '?'}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black" style={{ color: '#1A1A1A' }}>{selected.full_name || 'ללא שם'}</h1>
            <p className="text-sm" style={{ color: '#6B7280' }}>{selected.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#1A1A1A' }}><Star size={16} style={{ color: '#F97316' }} /> פרופיל</h2>
            {profile ? (
              <div className="space-y-3 text-sm">
                {profile.phone && <div className="flex items-center gap-2" style={{ color: '#4B5563' }}><Phone size={14} style={{ color: '#9CA3AF' }} />{profile.phone}</div>}
                {profile.preferred_regions && <div className="flex items-center gap-2" style={{ color: '#4B5563' }}><MapPin size={14} style={{ color: '#9CA3AF' }} />{profile.preferred_regions}</div>}
                {profile.num_guests_usual && <div style={{ color: '#6B7280' }}>בדרך כלל <span className="font-medium" style={{ color: '#1A1A1A' }}>{profile.num_guests_usual}</span> אורחים</div>}
                {profile.vacation_preferences && (
                  <div className="mt-3 p-3 rounded-xl text-xs leading-relaxed" style={{ background: '#F8F7F4', color: '#4B5563' }}>
                    {profile.vacation_preferences}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm" style={{ color: '#9CA3AF' }}>לא מילא פרופיל עדיין</p>
            )}
          </div>

          {/* Bookings */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#1A1A1A' }}><Calendar size={16} style={{ color: '#F97316' }} /> הזמנות ({userBookings.length})</h2>
            {userBookings.length === 0 ? (
              <p className="text-sm" style={{ color: '#9CA3AF' }}>אין הזמנות</p>
            ) : (
              <div className="space-y-3">
                {userBookings.map(b => (
                  <div key={b.id} className="p-3 rounded-xl text-xs" style={{ background: '#F8F7F4' }}>
                    <p className="font-medium" style={{ color: '#1A1A1A' }}>{b.zimmer_name}</p>
                    <p className="mt-0.5" style={{ color: '#6B7280' }}>{b.check_in} → {b.check_out}</p>
                    <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs ${b.status === 'אושרה' ? 'bg-green-50 text-green-700' : b.status === 'נדחתה' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat Sessions */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#1A1A1A' }}><MessageSquare size={16} style={{ color: '#F97316' }} /> שיחות ({userSessions.length})</h2>
            {userSessions.length === 0 ? (
              <p className="text-sm" style={{ color: '#9CA3AF' }}>אין שיחות</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {userSessions.map(s => (
                  <div key={s.id} className="p-3 rounded-xl text-xs" style={{ background: '#F8F7F4' }}>
                    <p style={{ color: '#6B7280' }}>{new Date(s.created_date).toLocaleDateString('he-IL')}</p>
                    {s.summary ? (
                      <p className="mt-1 leading-relaxed" style={{ color: '#4B5563' }}>{s.summary}</p>
                    ) : (
                      <p className="mt-1" style={{ color: '#9CA3AF' }}>{s.messages?.length || 0} הודעות</p>
                    )}
                    {s.booking_created && <span className="mt-1 inline-block bg-green-50 text-green-700 px-2 py-0.5 rounded-full">הזמנה נוצרה ✓</span>}
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
          <div className="rounded-2xl p-7 max-w-sm w-full mx-4 text-center" dir="rtl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Trash2 size={22} style={{ color: '#EF4444' }} />
            </div>
            <h3 className="text-lg font-black mb-1" style={{ color: '#1A1A1A' }}>מחיקת לקוח</h3>
            <p className="text-sm mb-1" style={{ color: '#6B7280' }}>האם למחוק את <strong style={{ color: '#1A1A1A' }}>{deletingCustomer.full_name || deletingCustomer.email}</strong>?</p>
            <p className="text-xs mb-6" style={{ color: '#EF4444' }}>פעולה זו אינה הפיכה</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingCustomer(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>ביטול</button>
              <button onClick={() => handleDeleteCustomer(deletingCustomer)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#EF4444' }}>מחק</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-black" style={{ color: '#1A1A1A' }}>לקוחות ({filtered.length})</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 w-full sm:w-auto"
          style={{ background: '#F97316' }}
        >
          <UserPlus size={16} /> הוסף לקוח חדש
        </button>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-md" dir="rtl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg" style={{ color: '#1A1A1A' }}>הוספת לקוח חדש</h2>
              <button onClick={() => { setShowInvite(false); setInviteMsg(''); }} style={{ color: '#9CA3AF' }}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#6B7280' }}>מייל *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#6B7280' }}>שם מלא (אופציונלי)</label>
                <input
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="שם הלקוח"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#6B7280' }}>טלפון (אופציונלי)</label>
                <input
                  value={inviteForm.phone}
                  onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="050-0000000"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}
                />
              </div>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>הלקוח יקבל הזמנה למייל ויוכל להתחבר עם גוגל. אם המייל שלו ב-Google תואם — הוא יכנס לדף האישי שלו מיד.</p>
              {inviteMsg && <p className="text-sm text-center" style={{ color: '#6B7280' }}>{inviteMsg}</p>}
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteForm.email.trim()}
                className="w-full py-3 text-white rounded-xl font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: '#F97316' }}
              >
                {inviting ? 'שולח הזמנה...' : 'שלח הזמנה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם או מייל..."
          className="w-full rounded-xl pr-9 pl-4 py-2.5 text-sm outline-none"
          style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
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
              <div key={c.id} className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <button onClick={() => setSelected(c)} className="flex items-center gap-4 flex-1 text-right">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0" style={{ background: 'rgba(249,115,22,0.12)', color: '#EA580C' }}>
                    {c.full_name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: '#1A1A1A' }}>{c.full_name || 'ללא שם'}</p>
                    <p className="text-sm" style={{ color: '#6B7280' }}>{c.email}</p>
                    {profile?.phone && <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{profile.phone}</p>}
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-wrap text-sm" style={{ color: '#9CA3AF' }}>
                  <span>💬 {sessCount} שיחות</span>
                  <button onClick={() => setDeletingCustomer(c)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
                    <Trash2 size={12} /> מחק
                  </button>
                  <ChevronRight size={16} className="cursor-pointer" style={{ color: '#9CA3AF' }} onClick={() => setSelected(c)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}