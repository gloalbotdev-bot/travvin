import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/api/client';
import { normalizePhoneE164, formatPhoneDisplay } from '@/lib/rooms';
import { calcNights, getBookingTotal, formatILS } from '@/lib/bookingPrice';
import { Search, Users2, Home, Calendar, Wallet, Sparkles } from 'lucide-react';
import GuestProfileDetail from './GuestProfileDetail';

export default function OwnerGuests({ ownerId, embedded = false }) {
  const [guests, setGuests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [zimmers, setZimmers] = useState([]);
  const [openPhone, setOpenPhone] = useState(null);

  const load = async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const [bookings, profiles, zimList] = await Promise.all([
        api.entities.BookingRequest.filter({ owner_id: ownerId }),
        api.entities.GuestProfile.filter({ owner_id: ownerId }),
        api.entities.Zimmer.filter({ owner_id: ownerId }),
      ]);
      setZimmers(zimList);
      const checkedOut = (bookings || []).filter((b) => b.checked_out === true);

      const groups = {};
      checkedOut.forEach((b) => {
        const key = normalizePhoneE164(b.guest_phone);
        if (!key) return;
        (groups[key] ||= []).push(b);
      });

      const profileByPhone = {};
      (profiles || []).forEach((p) => { profileByPhone[p.phone_e164] = p; });

      const list = Object.entries(groups).map(([phone, stays]) => {
        stays.sort((a, b) => new Date(b.check_out) - new Date(a.check_out));
        const profile = profileByPhone[phone] || {};
        return {
          phone_e164: phone,
          guest_name: (stays[0]?.guest_name) || profile.guest_name || 'אורח',
          stays_count: stays.length,
          total_paid: stays.reduce((s, b) => s + (Number(b.total_price) || 0), 0),
          last: stays[0],
          first: stays[stays.length - 1],
          stays,
          ai_summary: profile.ai_summary || '',
          ai_summary_updated_at: profile.ai_summary_updated_at,
          notes: profile.notes || '',
          profile_id: profile.id,
        };
      });
      list.sort((a, b) => new Date(b.last.check_out) - new Date(a.last.check_out));
      setGuests(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [ownerId]);

  const filtered = useMemo(() => {
    if (!guests) return [];
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) =>
      g.guest_name.toLowerCase().includes(q) ||
      formatPhoneDisplay(g.phone_e164).includes(q) ||
      g.phone_e164.includes(q)
    );
  }, [guests, query]);

  const openGuest = openPhone ? guests?.find((g) => g.phone_e164 === openPhone) : null;

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      {/* Header — hidden in embedded mode (ContactsBook provides its own) */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>לקוחות</h1>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
              אורחים שסיימו צ'ק-אאוט אצלך — היסטוריית שהייה, הערות וסיכום AI לכל לקוח
            </p>
          </div>
        </div>
      )}
      <div className={`relative w-full ${embedded ? 'mb-5 sm:max-w-xs' : 'sm:w-72'} ${embedded ? '' : 'mb-6'}`}>
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם או טלפון..."
          className="w-full pr-9 pl-3 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{ background: '#fff', border: '1.5px solid #F0EEE8', color: '#1A1A1A' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#F97316'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#F0EEE8'; }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : !guests || guests.length === 0 ? (
        <div className="text-center py-24 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <div className="flex items-center justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #EAD5FF 0%, #FFD4C2 100%)' }}>
              <Users2 size={36} style={{ color: '#9CA3AF' }} />
            </div>
          </div>
          <h3 className="text-lg font-black mb-2" style={{ color: '#1A1A1A' }}>אין אורחים שסיימו צ'ק-אאוט עדיין</h3>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            לאחר שהזמנה תסומן כ'בוצע צ'ק-אאוט', האורח יופיע כאן עם פרופיל, היסטוריית שהייה וסיכום AI אוטומטי.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>לא נמצאו לקוחות תואמים לחיפוש "{query}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((g) => {
            const nights = calcNights(g.last.check_in, g.last.check_out);
            const amount = getBookingTotal(g.last, zimmers.find((z) => z.id === g.last.zimmer_id));
            return (
              <GuestCard key={g.phone_e164} guest={g} nights={nights} amount={amount} onOpen={() => setOpenPhone(g.phone_e164)} />
            );
          })}
        </div>
      )}

      {openGuest && (
        <GuestProfileDetail
          guest={openGuest}
          ownerId={ownerId}
          onClose={() => setOpenPhone(null)}
          onUpdated={(updated) => {
            setGuests((prev) => (prev || []).map((g) => (g.phone_e164 === updated.phone_e164 ? { ...g, ...updated } : g)));
          }}
        />
      )}
    </div>
  );
}

function GuestCard({ guest, nights, amount, onOpen }) {
  const updated = guest.ai_summary_updated_at ? new Date(guest.ai_summary_updated_at).toLocaleDateString('he-IL') : null;
  return (
    <button
      onClick={onOpen}
      className="text-right rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer w-full"
      style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white" style={{ background: 'linear-gradient(135deg, #F97316, #FB923C)' }}>
          {(guest.guest_name || '?').trim().charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-base truncate" style={{ color: '#1A1A1A' }}>{guest.guest_name}</h3>
          <p className="text-xs" style={{ color: '#9CA3AF' }} dir="ltr">{formatPhoneDisplay(guest.phone_e164)}</p>
        </div>
        <span className="text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
          {guest.stays_count}× אצלך
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs mb-3" style={{ color: '#6B7280' }}>
        <span className="inline-flex items-center gap-1"><Calendar size={12} /> {gDate(guest.last.check_in)}{nights > 0 ? ` · ${nights} לילות` : ''}</span>
        <span className="inline-flex items-center gap-1"><Wallet size={12} /> {formatILS(amount)}</span>
        {guest.last.zimmer_name && <span className="inline-flex items-center gap-1 truncate"><Home size={12} /> {guest.last.zimmer_name}</span>}
      </div>

      {guest.ai_summary ? (
        <div className="rounded-xl p-3 mb-1" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={12} style={{ color: '#6366F1' }} />
            <span className="text-[11px] font-bold" style={{ color: '#6366F1' }}>סיכום AI{updated ? ` · ${updated}` : ''}</span>
          </div>
          <p className="text-xs leading-relaxed line-clamp-3" style={{ color: '#4B5563' }}>{guest.ai_summary}</p>
        </div>
      ) : (
        <div className="rounded-xl p-3" style={{ background: '#F8F7F4' }}>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>הסיכום נבנה אוטומטית אחרי צ'ק-אאוט — פתח את הכרטיס לרענון ידני.</p>
        </div>
      )}
    </button>
  );
}

function gDate(s) { return s ? new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''; }