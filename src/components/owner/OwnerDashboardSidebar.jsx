import React, { useState, useEffect, useRef } from 'react';
import useOwnerTodayData from '@/components/owner/useOwnerTodayData';
import { ChevronDown, Home, Check } from 'lucide-react';
import iconLogout from '@/assets/owner/home/icon-logout.svg';
import iconLogin from '@/assets/owner/home/icon-login.svg';
import iconBell from '@/assets/owner/home/icon-bell-stat.svg';
import iconUsers from '@/assets/owner/home/icon-users.svg';
import iconChevron from '@/assets/owner/calendar/chevron-action.svg';
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
  const { loading, selectedZimmer, setSelectedZimmer, checkoutsToday, checkinsToday, pending, activeGuests, actions, handleAction } = useOwnerTodayData({ ownerId, zimmers, onAction, onNavigate, onEditZimmer });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const metrics = [
    { key: 'checkout', label: "צ'ק אאוט להיום", value: checkoutsToday.length, iconSrc: iconLogout, circle: '#AAEFFD' },
    { key: 'checkin', label: "צ'ק אין להיום", value: checkinsToday.length, iconSrc: iconLogin, circle: '#FFCEFF' },
    { key: 'pending', label: 'הזמנות לטיפול', value: pending.length, iconSrc: iconBell, circle: '#0F4D4D', invert: true },
    { key: 'active', label: 'אורחים פעילים', value: activeGuests.length, iconSrc: iconUsers, circle: '#FFFF00' },
  ];

  const firstName = (currentUser?.full_name || '').split(' ')[0] || '';
  const selectedLabel = selectedZimmer === 'all' ? `כל הנכסים (${zimmers.length})` : (zimmers.find(z => z.id === selectedZimmer)?.name || 'נכס');

  return (
    <div className="h-full min-h-0 flex flex-col font-simona" style={{ background: '#FAFAFA' }}>
      {/*
        Figma 1011:209 — scrollbar on physical RIGHT of left sidebar.
        dir=ltr on the scrollport puts the thumb on the right; inner stays RTL.
      */}
      <div
        className="owner-sidebar-scroll overflow-y-auto flex-1 min-h-0 overscroll-contain"
        dir="ltr"
        style={{ paddingTop: 46, paddingBottom: 20 }}
      >
        <div dir="rtl" className="px-5 font-simona">
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
                        dir="rtl"
                      >
                        {/* Figma: icon on the RIGHT of the label */}
                        <span className="overflow-hidden flex-shrink-0" style={{ width: 14, height: 14 }}>
                          <img src={badge.icon} alt="" width={14} height={14} className="block w-full h-full" />
                        </span>
                        {badge.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAction(a)}
                        className="font-simona inline-flex items-center gap-2 transition-all hover:opacity-70 flex-shrink-0"
                        style={{ color: '#0B3838', fontSize: 16, fontWeight: 400 }}
                        dir="rtl"
                      >
                        {ACTION_LABEL[a.type] || 'טפל'}
                        {/* Full chevron — no overflow clip (stroke was cut at 6×12) */}
                        <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 12, height: 16 }}>
                          <img src={iconChevron} alt="" width={12} height={16} className="block" style={{ width: 12, height: 16 }} />
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
    </div>
  );
}
