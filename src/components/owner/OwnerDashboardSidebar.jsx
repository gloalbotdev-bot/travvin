import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { ChevronDown, Home, LogOut, LogIn, Bell, Users, ArrowLeft, Check } from 'lucide-react';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 18) return 'צהריים טובים';
  return 'ערב טוב';
}

const BADGE = {
  missing_info: { label: 'לטיפול', bg: '#FEE2E2', color: '#DC2626' },
  answer_question: { label: 'שאלה', bg: '#DBEAFE', color: '#1D4ED8' },
  approve_booking: { label: 'ניהול הזמנות', bg: '#DBEAFE', color: '#1D4ED8' },
  cancel_booking: { label: 'ביטול', bg: '#FED7AA', color: '#EA580C' },
  open_chat: { label: "צ'אט", bg: '#DCFCE7', color: '#16A34A' },
};

const ACTION_LABEL = {
  missing_info: 'להשלמה',
  answer_question: 'אשר תשובה',
  approve_booking: 'אישור הזמנה',
  cancel_booking: 'טפל עכשיו',
  open_chat: "פתח צ'אט",
};

export default function OwnerDashboardSidebar({ ownerId, zimmers, currentUser, tab, onAction, onNavigate, onEditZimmer }) {
  const [bookings, setBookings] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZimmer, setSelectedZimmer] = useState('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      try {
        const [b, q, c] = await Promise.all([
          api.entities.BookingRequest.filter({ owner_id: ownerId }),
          api.entities.UnansweredQuestion.filter({ owner_id: ownerId, status: 'ממתינה' }),
          api.entities.DirectChat.filter({ owner_id: ownerId }, '-updated_date'),
        ]);
        setBookings(b || []);
        setQuestions(q || []);
        setChats(c || []);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [ownerId]);

  useEffect(() => {
    const onClick = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const filterZ = (list) => selectedZimmer === 'all' ? list : list.filter(x => x.zimmer_id === selectedZimmer);

  const fb = filterZ(bookings);
  const fq = filterZ(questions);
  const checkoutsToday = fb.filter(b => b.check_out === today && b.status === 'אושרה');
  const checkinsToday = fb.filter(b => b.check_in === today && b.status === 'אושרה');
  const pending = fb.filter(b => b.status === 'ממתינה');
  const activeGuests = fb.filter(b => b.status === 'אושרה' && b.check_in <= today && b.check_out > today);

  const pendingApprovals = fb.filter(b => b.status === 'ממתינה' && !b.cancel_request_reason);
  const cancelRequests = fb.filter(b => b.cancel_request_reason);
  const chatAwaitReply = filterZ(chats).filter(t => (t.messages || []).length > 0 && (t.messages || []).slice(-1)[0]?.role === 'customer');
  const missingInfo = zimmers.filter(z => !z.info_summary && (!z.data_zones || z.data_zones.length === 0));

  const actions = [
    ...pendingApprovals.map(b => ({ id: b.id, type: 'approve_booking', title: 'הזמנה ממתינה לאישור', sub: `${b.guest_name} · ${b.zimmer_name} · ${b.check_in} → ${b.check_out}` })),
    ...missingInfo.slice(0, 3).map(z => ({ id: z.id, type: 'missing_info', title: 'חסר מידע בנכס', sub: `השלם מידע עבור "${z.name}" — תיאור, מתקנים, מדיניות ועוד.`, zimmer: z })),
    ...cancelRequests.map(b => ({ id: b.id, type: 'cancel_booking', title: 'בקשת ביטול', sub: `${b.guest_name} · ${b.zimmer_name} · ${b.cancel_request_reason || ''}` })),
    ...fq.map(q => ({ id: q.id, type: 'answer_question', title: `${q.customer_name ? q.customer_name + ': ' : ''}${q.question || ''}`, sub: `בנוגע ל-${q.zimmer_name || 'נכס'}` })),
    ...chatAwaitReply.map(t => ({ id: t.id, type: 'open_chat', title: `צ'אט מלקוח: ${t.customer_name || 'לקוח'}`, sub: `${t.zimmer_name} · ${(t.messages || []).slice(-1)[0]?.content || ''}` })),
  ];

  const metrics = [
    { key: 'checkout', label: "צ'ק אאוט להיום", value: checkoutsToday.length, Icon: LogOut, circle: '#C8F1F5' },
    { key: 'checkin', label: "צ'ק אין להיום", value: checkinsToday.length, Icon: LogIn, circle: '#F9DFF9' },
    { key: 'pending', label: 'הזמנות לטיפול', value: pending.length, Icon: Bell, circle: '#1A4D59', iconColor: '#fff' },
    { key: 'active', label: 'אורחים פעילים', value: activeGuests.length, Icon: Users, circle: '#FDFD96' },
  ];

  const handleAction = (a) => {
    if (a.type === 'missing_info') onEditZimmer?.(a.zimmer);
    else onAction?.(a.type, a.id);
  };

  const firstName = (currentUser?.full_name || '').split(' ')[0] || '';
  const selectedLabel = selectedZimmer === 'all' ? `כל הנכסים (${zimmers.length})` : (zimmers.find(z => z.id === selectedZimmer)?.name || 'נכס');

  return (
    <div dir="rtl" className="h-full flex flex-col" style={{ background: '#F9F9FB', fontFamily: 'Heebo, sans-serif' }}>
      <div className="px-5 py-5 overflow-y-auto flex-1">
        {/* Greeting — only on dashboard */}
        {tab === 'home' && (
          <>
            <h1 className="text-xl font-black" style={{ color: '#0B1B2A' }}>היי {firstName}, {greeting()}</h1>
            <h2 className="text-sm font-medium mt-1" style={{ color: '#6B7280' }}>מה קורה היום</h2>
          </>
        )}

        {/* Property filter dropdown */}
        <div className="relative mt-4" ref={dropRef}>
          <button onClick={() => setDropdownOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#0B1B2A' }}>
            <span className="flex items-center gap-2 min-w-0">
              <Home size={15} style={{ color: '#6B7280' }} />
              <span className="truncate">{selectedLabel}</span>
            </span>
            <ChevronDown size={15} style={{ color: '#6B7280', transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {dropdownOpen && (
            <div className="absolute z-30 mt-1 w-full rounded-xl overflow-hidden shadow-lg" style={{ background: '#fff', border: '1.5px solid #E8E5E0' }}>
              <button onClick={() => { setSelectedZimmer('all'); setDropdownOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-right hover:bg-gray-50" style={{ color: selectedZimmer === 'all' ? '#F97316' : '#0B1B2A' }}>
                {selectedZimmer === 'all' ? <Check size={14} /> : <span style={{ width: 14 }} />} כל הנכסים ({zimmers.length})
              </button>
              {zimmers.map(z => (
                <button key={z.id} onClick={() => { setSelectedZimmer(z.id); setDropdownOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-right hover:bg-gray-50 truncate" style={{ color: selectedZimmer === z.id ? '#F97316' : '#0B1B2A' }}>
                  {selectedZimmer === z.id ? <Check size={14} /> : <span style={{ width: 14 }} />} {z.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Metrics 2x2 */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          {metrics.map(m => (
            <div key={m.key} className="rounded-2xl p-3.5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center mb-2.5" style={{ background: m.circle }}>
                <m.Icon size={17} style={{ color: m.iconColor || '#0B1B2A' }} />
              </div>
              <div className="text-2xl font-black leading-none" style={{ color: '#0B1B2A' }}>{loading ? '—' : m.value}</div>
              <div className="text-xs mt-1.5 font-medium" style={{ color: '#6B7280' }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* לטיפול */}
        <div className="mt-6">
          <h3 className="text-sm font-bold mb-3" style={{ color: '#0B1B2A' }}>לטיפול</h3>
          {actions.length === 0 ? (
            <div className="rounded-2xl p-5 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>אין פעולות ממתינות 🎉</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {actions.slice(0, 8).map((a, i) => {
                const badge = BADGE[a.type] || BADGE.missing_info;
                return (
                  <div key={a.type + a.id + i} className="rounded-2xl p-3.5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                    <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: '#0B1B2A' }}>{a.title}</p>
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: '#6B7280' }}>{a.sub}</p>
                    <button onClick={() => handleAction(a)} className="mt-2.5 flex items-center gap-1 text-xs font-bold transition-all hover:opacity-70" style={{ color: '#0B1B2A' }}>
                      {ACTION_LABEL[a.type] || 'טפל'} <ArrowLeft size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}