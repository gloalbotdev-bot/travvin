import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { X } from 'lucide-react';
import { calcBookingTotalForZimmer, formatILS, calcNights, promoStayTotal, clampDiscount } from '@/lib/bookingPrice';
import { getBookedRangesForZimmer } from '@/components/chat/DateSearchWidget';
import BookingDatePicker from '@/components/chat/BookingDatePicker';

export default function BookingForm({ zimmer, onSubmit, prefillDates, promo, onClose }) {
  const prefillAdults = prefillDates?.num_adults || prefillDates?.numGuests || 1;
  const prefillChildren = prefillDates?.num_children || 0;

  // For an exact search the chosen dates are concrete. For a flexible search
  // (range + number of nights) we preselect the first valid window so the
  // calendar opens with a concrete, editable range instead of empty.
  const computeFlexible = () => {
    if (prefillDates?.mode !== 'flexible') return { ci: '', co: '' };
    const rs = prefillDates?.rangeStart;
    if (!rs) return { ci: '', co: '' };
    const nights = prefillDates?.numNights || 2;
    const start = new Date(rs);
    const out = new Date(start.getTime() + nights * 86400000);
    const toISO = (d) => { const x = new Date(d); const y = x.getFullYear(); const m = String(x.getMonth() + 1).padStart(2, '0'); const day = String(x.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; };
    let ci = toISO(start);
    let co = toISO(out);
    // If the computed checkout falls past the range end, anchor checkout at the range end
    const re = prefillDates?.rangeEnd;
    if (re && new Date(co) > new Date(re)) {
      co = re;
      const shifted = new Date(new Date(re).getTime() - nights * 86400000);
      ci = toISO(shifted);
    }
    return { ci, co };
  };
  const flex = computeFlexible();
  const prefillCheckIn = promo?.check_in || prefillDates?.checkIn || flex.ci || '';
  const prefillCheckOut = promo?.check_out || prefillDates?.checkOut || flex.co || '';

  const [form, setForm] = useState({
    guest_name: '',
    guest_phone: '',
    check_in: prefillCheckIn,
    check_out: prefillCheckOut,
    num_adults: prefillAdults,
    num_children: prefillChildren,
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookedRanges, setBookedRanges] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingAvailability(true);
    getBookedRangesForZimmer(api, zimmer.id)
      .then(ranges => { if (active) { setBookedRanges(ranges); setLoadingAvailability(false); } })
      .catch(() => { if (active) setLoadingAvailability(false); });
    return () => { active = false; };
  }, [zimmer.id]);

  // Pre-fill name & phone from what we already know about the customer (profile / past bookings).
  // Dates and guest counts are already pre-filled from the search context; everything stays editable.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await api.auth.me();
        if (!me || !active) return;
        let phone = '';
        try {
          const profiles = await api.entities.CustomerProfile.filter({ user_id: me.id });
          if (profiles[0]?.phone) phone = profiles[0].phone;
        } catch {}
        if (!phone) {
          try {
            const bookings = await api.entities.BookingRequest.filter({ created_by_id: me.id }, '-created_date', 1);
            if (bookings[0]?.guest_phone) phone = bookings[0].guest_phone;
          } catch {}
        }
        if (!active) return;
        setForm(f => ({
          ...f,
          guest_name: f.guest_name || me.full_name || '',
          guest_phone: f.guest_phone || phone || '',
        }));
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  const totalGuests = (parseInt(form.num_adults) || 0) + (parseInt(form.num_children) || 0);
  const nights = calcNights(form.check_in, form.check_out);
  const estimatedTotal = (form.check_in && form.check_out && totalGuests > 0)
    ? promo
      ? promoStayTotal(zimmer, promo, parseInt(form.num_adults) || 0, parseInt(form.num_children) || 0)
      : calcBookingTotalForZimmer(zimmer, form.check_in, form.check_out, parseInt(form.num_adults) || 0, parseInt(form.num_children) || 0)
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalGuests < 1) return;
    setSubmitting(true);
    await onSubmit({
      ...form,
      num_guests: totalGuests,
      num_adults: parseInt(form.num_adults) || 0,
      num_children: parseInt(form.num_children) || 0,
      total_price: estimatedTotal
    }, zimmer);
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) return null;

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100" dir="rtl">
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-2">
        {onClose && (
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
            <X size={18} />
          </button>
        )}
        <div className="flex-1">
          <div className="font-semibold text-sm">📋 בקשת הזמנה</div>
          <div className="text-xs text-green-200">{zimmer.name}</div>
        </div>
        {promo && (
          <span className="text-xs font-black px-2 py-1 rounded-full flex-shrink-0" style={{ background: '#EF4444' }}>
            {clampDiscount(promo.discount_percent)}% מבצע
          </span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">שם מלא</label>
          <input
            required
            type="text"
            value={form.guest_name}
            onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))}
            placeholder="הכנס שם מלא"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">טלפון</label>
          <input
            required
            type="tel"
            value={form.guest_phone}
            onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))}
            placeholder="050-0000000"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">תאריכי שהייה</label>
          {promo ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
              🔒 מבצע: {form.check_in} → {form.check_out} <span className="text-xs text-gray-400">(קבוע)</span>
            </div>
          ) : (
            <BookingDatePicker
              bookedRanges={bookedRanges}
              checkIn={form.check_in}
              checkOut={form.check_out}
              onChange={({ check_in, check_out }) => setForm(f => ({ ...f, check_in, check_out }))}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">מבוגרים</label>
            <input
              required
              type="number"
              min={1}
              max={zimmer.max_guests || 20}
              value={form.num_adults}
              onChange={e => setForm(f => ({ ...f, num_adults: parseInt(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">ילדים</label>
            <input
              type="number"
              min={0}
              max={zimmer.max_guests || 20}
              value={form.num_children}
              onChange={e => setForm(f => ({ ...f, num_children: parseInt(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
            />
          </div>
        </div>
        {zimmer.partial_pricing_enabled && totalGuests < (zimmer.max_guests || 0) && totalGuests >= (zimmer.min_guests || 0) && !promo && (
          <div className="bg-green-50 text-green-700 text-xs rounded-lg px-3 py-2 leading-relaxed">
            ✓ תמחור חלקי פעיל: {formatILS(zimmer.price_per_adult || 0)}/מבוגר, {formatILS(zimmer.price_per_child || 0)}/ילד ללילה
          </div>
        )}
        {estimatedTotal > 0 && (
          <div className="rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: promo ? 'rgba(239,68,68,0.08)' : 'rgba(7,94,84,0.05)' }}>
            <span className="text-xs text-gray-600">סה"כ משוער{nights > 0 ? ` · ${nights} לילות` : ''}{promo ? ' · כולל מבצע' : ''}</span>
            <span className="text-sm font-bold" style={{ color: promo ? '#EF4444' : '#075E54' }}>{formatILS(estimatedTotal)}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || totalGuests < 1 || !form.check_in || !form.check_out}
          className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
        >
          {submitting ? 'שולח...' : 'שלח בקשת הזמנה ✓'}
        </button>
      </form>
    </div>
  );
}