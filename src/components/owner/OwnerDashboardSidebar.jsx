import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { ChevronDown, Home, Check } from 'lucide-react';
import iconLogout from '@/assets/owner/home/icon-logout.svg';
import iconLogin from '@/assets/owner/home/icon-login.svg';
import iconBell from '@/assets/owner/home/icon-bell-stat.svg';
import iconUsers from '@/assets/owner/home/icon-users.svg';
import iconChevron from '@/assets/owner/home/icon-chevron.svg';
import badgeAlert from '@/assets/owner/home/badge-alert.svg';
import badgeQuestion from '@/assets/owner/home/badge-question.svg';
import badgeMail from '@/assets/owner/home/badge-mail.svg';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 18) return 'צהריים טובים';
  return 'ערב טוב';
}

const BADGE = {
  missing_info: { label: 'לטיפול', icon: badgeAlert },
  answer_question: { label: 'שאלה', icon: badgeQuestion },
  approve_booking: { label: 'ניהול הזמנות', icon: badgeMail },
  cancel_booking: { label: 'ביטול', icon: badgeMail },
  open_chat: { label: "צ'אט", icon: badgeMail },
  send_directions: { label: 'ניהול הזמנות', icon: badgeMail },
};

const ACTION_LABEL = {
  missing_info: 'להשלמה',
  answer_question: 'אשר תשובה',
  approve_booking: 'אישור הזמנה',
  cancel_booking: 'טפל עכשיו',
  open_chat: "פתח צ'אט",
  send_directions: 'שלח הוראות הגעה',
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
    ...pendingApprovals.map(b => ({
      id: b.id,
      type: 'approve_booking',
      title: 'הזמנה ממתינה לאישור',
      sub: `${b.guest_name || 'אורחים'} · ${b.zimmer_name || ''} · ${b.check_in} → ${b.check_out}`,
    })),
    ...missingInfo.slice(0, 3).map(z => ({
      id: z.id,
      type: 'missing_info',
      title: 'חסר מידע בנכס',
      sub: `בצימר "${z.name}" חסר מידע על חניה, צ׳ק־אין והתאמה לשבת. המידע הזה יכול לעזור למערכת להתאים את הנכס ללקוחות.`,
      zimmer: z,
    })),
    ...cancelRequests.map(b => ({
      id: b.id,
      type: 'cancel_booking',
      title: 'בקשת ביטול',
      sub: `${b.guest_name} · ${b.zimmer_name} · ${b.cancel_request_reason || ''}`,
    })),
    ...fq.map(q => ({
      id: q.id,
      type: 'answer_question',
      title: `${q.customer_name ? q.customer_name + ' שאלה: ' : ''}${q.question ? `"${q.question}"` : ''}`,
      sub: q.suggested_answer
        ? `הצעה לתשובה: "${q.suggested_answer}"`
        : `בנוגע ל-${q.zimmer_name || 'נכס'}`,
    })),
    ...chatAwaitReply.map(t => ({
      id: t.id,
      type: 'open_chat',
      title: `צ'אט מלקוח: ${t.customer_name || 'לקוח'}`,
      sub: `${t.zimmer_name} · ${(t.messages || []).slice(-1)[0]?.content || ''}`,
    })),
    ...checkinsToday.slice(0, 3).map(b => ({
      id: b.id,
      type: 'send_directions',
      title: 'אורחים נכנסים היום',
      sub: `${b.guest_name || 'אורחים'} נכנסים היום לצימר "${b.zimmer_name || ''}"${b.check_in_time ? ` בשעה ${b.check_in_time}` : ''}. כדאי לוודא שהניקיון והוראות ההגעה מוכנים.`,
    })),
  ];

  const metrics = [
    { key: 'checkout', label: "צ'ק אאוט להיום", value: checkoutsToday.length, iconSrc: iconLogout, circle: '#AAEFFD' },
    { key: 'checkin', label: "צ'ק אין להיום", value: checkinsToday.length, iconSrc: iconLogin, circle: '#FFCEFF' },
    { key: 'pending', label: 'הזמנות לטיפול', value: pending.length, iconSrc: iconBell, circle: '#0F4D4D', invert: true },
    { key: 'active', label: 'אורחים פעילים', value: activeGuests.length, iconSrc: iconUsers, circle: '#FFFF00' },
  ];

  const handleAction = (a) => {
    if (a.type === 'missing_info') onEditZimmer?.(a.zimmer);
    else if (a.type === 'send_directions') onNavigate?.('checkin');
    else onAction?.(a.type, a.id);
  };

  const firstName = (currentUser?.full_name || '').split(' ')[0] || '';
  const selectedLabel = selectedZimmer === 'all' ? `כל הנכסים (${zimmers.length})` : (zimmers.find(z => z.id === selectedZimmer)?.name || 'נכס');

  return (
    <div dir="rtl" className="h-full flex flex-col font-simona" style={{ background: '#FAFAFA' }}>
      <div className="px-5 py-5 overflow-y-auto flex-1">
        {tab === 'home' && (
          <>
            <h1 className="font-simpler leading-tight" style={{ color: '#0B3838', fontSize: 29, fontWeight: 600 }}>
              היי {firstName}{firstName ? ', ' : ''}{greeting()}
            </h1>
            <div className="flex items-center justify-between gap-2 mt-3">
              <h2 className="font-simpler" style={{ color: '#0B3838', fontSize: 20, fontWeight: 600 }}>מה קורה היום</h2>
              <div className="relative" ref={dropRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(o => !o)}
                  className="font-simona flex items-center gap-1.5 transition-all"
                  style={{ color: '#0B3838', fontSize: 14, fontWeight: 400 }}
                >
                  <Home size={14} style={{ color: '#0B3838' }} />
                  <span className="truncate max-w-[120px]">{selectedLabel}</span>
                  <ChevronDown size={12} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {dropdownOpen && (
                  <div className="absolute z-30 mt-1 left-0 min-w-[180px] rounded-xl overflow-hidden shadow-lg" style={{ background: '#fff', border: '1.5px solid #E8E5E0' }}>
                    <button
                      type="button"
                      onClick={() => { setSelectedZimmer('all'); setDropdownOpen(false); }}
                      className="font-simona w-full flex items-center gap-2 px-3 py-2.5 text-right hover:bg-gray-50"
                      style={{ color: selectedZimmer === 'all' ? '#F97316' : '#0B1B2A', fontSize: 14, fontWeight: 400 }}
                    >
                      {selectedZimmer === 'all' ? <Check size={14} /> : <span style={{ width: 14 }} />} כל הנכסים ({zimmers.length})
                    </button>
                    {zimmers.map(z => (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => { setSelectedZimmer(z.id); setDropdownOpen(false); }}
                        className="font-simona w-full flex items-center gap-2 px-3 py-2.5 text-right hover:bg-gray-50 truncate"
                        style={{ color: selectedZimmer === z.id ? '#F97316' : '#0B1B2A', fontSize: 14, fontWeight: 400 }}
                      >
                        {selectedZimmer === z.id ? <Check size={14} /> : <span style={{ width: 14 }} />} {z.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Metrics 2x2 — Figma absolute order: checkout TL, checkin TR, pending BL, active BR */}
        <div className="grid grid-cols-2 gap-4 mt-5" dir="ltr">
          {metrics.map(m => (
            <div
              key={m.key}
              className="rounded-xl bg-white flex items-center gap-[22px] px-5 overflow-visible"
              style={{ height: 100 }}
              dir="rtl"
            >
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ width: 50, height: 50, background: m.circle }}
              >
                <span className="overflow-hidden" style={{ width: 25, height: 25 }}>
                  <img
                    src={m.iconSrc}
                    alt=""
                    width={25}
                    height={25}
                    className="block w-full h-full"
                    style={m.invert ? { filter: 'brightness(0) invert(1)' } : undefined}
                  />
                </span>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-simpler leading-none" style={{ color: '#101828', fontSize: 25, fontWeight: 600 }}>
                  {loading ? '—' : m.value}
                </div>
                <div
                  className="font-simona mt-[5px] whitespace-nowrap"
                  style={{ color: '#0B3838', fontSize: 14, fontWeight: 400, lineHeight: '18px' }}
                >
                  {m.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* לטיפול */}
        <div className="mt-8">
          <h3 className="font-simpler mb-4" style={{ color: '#0B3838', fontSize: 20, fontWeight: 600 }}>לטיפול</h3>
          {actions.length === 0 ? (
            <div className="rounded-xl p-5 text-center bg-white">
              <p className="font-simona" style={{ color: '#9CA3AF', fontSize: 14, fontWeight: 400 }}>אין פעולות ממתינות</p>
            </div>
          ) : (
            <div className="space-y-[18px]">
              {actions.slice(0, 8).map((a, i) => {
                const badge = BADGE[a.type] || BADGE.missing_info;
                return (
                  <div
                    key={a.type + a.id + i}
                    className="rounded-[9px] bg-white px-6 py-6"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span
                        className="font-simona inline-flex items-center gap-1.5 px-2 py-1 rounded"
                        style={{ background: '#D9F3F9', color: '#0B3838', fontSize: 12, fontWeight: 700 }}
                      >
                        {badge.label}
                        <span className="overflow-hidden" style={{ width: 14, height: 14 }}>
                          <img src={badge.icon} alt="" width={14} height={14} className="block w-full h-full" />
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAction(a)}
                        className="font-simona flex items-center gap-1.5 transition-all hover:opacity-70 flex-shrink-0"
                        style={{ color: '#0B3838', fontSize: 16, fontWeight: 400 }}
                      >
                        {ACTION_LABEL[a.type] || 'טפל'}
                        <span className="overflow-hidden" style={{ width: 6, height: 12 }}>
                          <img src={iconChevron} alt="" width={6} height={12} className="block w-full h-full" />
                        </span>
                      </button>
                    </div>
                    <p className="font-simpler leading-snug text-right mb-1" style={{ color: '#0B3838', fontSize: 18, fontWeight: 600 }}>{a.title}</p>
                    <p className="font-simona leading-relaxed text-right" style={{ color: '#0B3838', fontSize: 16, fontWeight: 400 }}>{a.sub}</p>
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
