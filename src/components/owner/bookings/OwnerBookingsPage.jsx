import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/api/client';
import { Plus, AlertTriangle } from 'lucide-react';
import BookingsSummaryCards from './BookingsSummaryCards';
import BookingsFiltersBar from './BookingsFiltersBar';
import BookingsTabs from './BookingsTabs';
import BookingsTable from './BookingsTable';
import BookingDetailsModal from './BookingDetailsModal';
import BookingsAiSidebar from './BookingsAiSidebar';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullIndicator from '@/components/common/PullIndicator';
import { needsAttention, isUpcoming, isActive, isPast } from './bookingStatus';

// Replaces OwnerBookingsList with the Figma design. All business logic
// (load, approve/reject, deletion request, manual checkout, duplicate fix,
// calendar sync) is preserved — only the presentation layer changed.
export default function OwnerBookingsPage({ ownerId, zimmers = [], onAddBooking, focusBookingId, onQuickAction }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [duplicateCancelled, setDuplicateCancelled] = useState(0);

  // Filters
  const [tab, setTab] = useState('all');
  const [zimmerFilter, setZimmerFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const mainRef = useRef(null);

  useEffect(() => { if (ownerId) loadBookings(); }, [ownerId]);

  useEffect(() => {
    if (focusBookingId && bookings.length) {
      const b = bookings.find(x => x.id === focusBookingId);
      if (b) setSelectedBooking(b);
    }
  }, [focusBookingId, bookings]);

  const loadBookings = async () => {
    setLoading(true);
    const data = await api.entities.BookingRequest.filter({ owner_id: ownerId });
    const sorted = data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    setBookings(sorted);
    setLoading(false);
    findAndCancelDuplicates(sorted, async (ids) => {
      await Promise.all(ids.map(id => api.entities.BookingRequest.update(id, { status: 'נדחתה' })));
      setDuplicateCancelled(ids.length);
      const updated = await api.entities.BookingRequest.filter({ owner_id: ownerId });
      setBookings(updated.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    });
  };

  const { pull, refreshing } = usePullToRefresh(mainRef, loadBookings);

  const handleStatusChange = async (booking, newStatus) => {
    if (newStatus === 'אושרה') {
      const conflicts = bookings.filter(b =>
        b.id !== booking.id && b.zimmer_id === booking.zimmer_id && b.status === 'אושרה' &&
        new Date(b.check_in) < new Date(booking.check_out) && new Date(booking.check_in) < new Date(b.check_out)
      );
      if (conflicts.length > 0) {
        alert('⚠️ לא ניתן לאשר — קיימת כבר הזמנה מאושרת לצימר זה בתאריכים הנ"ל');
        return;
      }
    }
    await api.entities.BookingRequest.update(booking.id, { status: newStatus });
    if (newStatus === 'אושרה' && !booking.calendar_event_id) {
      setCalendarLoading(booking.id);
      try { await api.functions.invoke('addBookingToCalendar', { booking_id: booking.id }); } catch (e) { console.error('Calendar error:', e); }
      setCalendarLoading(null);
    }
    setSelectedBooking(null);
    loadBookings();
  };

  const handleSave = async (form) => {
    await api.entities.BookingRequest.update(form.id, {
      guest_name: form.guest_name, guest_phone: form.guest_phone,
      check_in: form.check_in, check_out: form.check_out, num_guests: form.num_guests,
      notes: form.notes, total_price: form.total_price,
    });
    setSelectedBooking(null);
    loadBookings();
  };

  const handleRequestDeletion = async (booking, reason) => {
    await api.entities.BookingRequest.update(booking.id, { deletion_request_reason: reason || '—', deletion_request_at: new Date().toISOString() });
    setSelectedBooking(null);
    loadBookings();
  };

  const handleConfirmCancel = async (booking) => {
    await api.entities.BookingRequest.update(booking.id, { status: 'נדחתה', cancel_request_reason: '', cancel_request_at: '' });
    setSelectedBooking(null);
    loadBookings();
  };

  const handleDismissCancel = async (booking) => {
    await api.entities.BookingRequest.update(booking.id, { cancel_request_reason: '', cancel_request_at: '' });
    loadBookings();
  };

  const handleManualCheckout = async (booking) => {
    if (!confirm("לבצע צ'ק-אאוט ידני להזמנה זו?")) return;
    try { await api.functions.invoke('performCheckout', { booking_id: booking.id, by: 'owner' }); setSelectedBooking(null); loadBookings(); }
    catch (e) { alert("צ'ק-אאוט נכשל: " + (e?.message || String(e))); }
  };

  // Apply all filters + active tab.
  const filtered = useMemo(() => {
    let list = [...bookings];
    if (tab === 'upcoming') list = list.filter(isUpcoming);
    else if (tab === 'active') list = list.filter(isActive);
    else if (tab === 'attention') list = list.filter(needsAttention);
    else if (tab === 'old') list = list.filter(isPast);

    if (zimmerFilter !== 'all') list = list.filter(b => b.zimmer_id === zimmerFilter);

    const q = search.trim();
    if (q) {
      const ql = q.toLowerCase();
      list = list.filter(b =>
        (b.guest_name || '').toLowerCase().includes(ql) ||
        (b.zimmer_name || '').toLowerCase().includes(ql)
      );
    }
    if (dateRange.start && dateRange.end) {
      list = list.filter(b => new Date(b.check_out) >= new Date(dateRange.start) && new Date(b.check_in) <= new Date(dateRange.end));
    }
    return list;
  }, [bookings, tab, zimmerFilter, search, dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#E53935] rounded-full animate-spin" />
      </div>
    );
  }

  const emptyText = bookings.length === 0 ? 'אין הזמנות עדיין' : 'אין הזמנות בקטגוריה/סינון זה';

  return (
    <div className="flex min-h-[calc(100vh-80px)]" dir="rtl" style={{ background: '#F9F9F9', fontFamily: 'Heebo, sans-serif' }}>
      {/* AI sidebar */}
      <BookingsAiSidebar
        bookings={bookings}
        zimmers={zimmers}
        onQuickAction={onQuickAction}
        onApproveQuick={(b) => setSelectedBooking(b)}
        onCreatePromo={() => onQuickAction('create_promo')}
      />

      {/* Main content */}
      <main ref={mainRef} className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-auto">
        <PullIndicator pull={pull} refreshing={refreshing} />
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#212121' }}>הזמנות</h1>
            <p className="text-sm mt-1" style={{ color: '#9e9e9e' }}>כל ההזמנות במקום אחד — מה שמגיע, מה שקורה עכשיו ומה שדורש טיפול</p>
          </div>
          <div className="flex items-center gap-3">
            {duplicateCancelled > 0 && (
              <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full" style={{ background: '#FFF8E1', color: '#92400E', border: '1px solid #FFE082' }}>
                <AlertTriangle size={13} /> בוטלו {duplicateCancelled} כפולות
              </div>
            )}
            {onAddBooking && (
              <button onClick={onAddBooking} className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-90" style={{ background: '#E53935' }}>
                <Plus size={15} /> הוסף הזמנה
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <BookingsSummaryCards bookings={bookings} />
          <BookingsFiltersBar zimmers={zimmers} zimmerFilter={zimmerFilter} onZimmerFilter={setZimmerFilter} search={search} onSearch={setSearch} dateRange={dateRange} onDateRange={setDateRange} />
          <BookingsTabs active={tab} onChange={setTab} bookings={bookings} />
          <BookingsTable bookings={filtered} zimmers={zimmers} onView={setSelectedBooking} onMore={setSelectedBooking} emptyText={emptyText} />
        </div>
      </main>

      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          zimmers={zimmers}
          onClose={() => setSelectedBooking(null)}
          onSave={handleSave}
          onRequestDeletion={handleRequestDeletion}
          onConfirmCancel={handleConfirmCancel}
          onDismissCancel={handleDismissCancel}
          onStatusChange={handleStatusChange}
          calendarLoading={calendarLoading}
          onManualCheckout={handleManualCheckout}
        />
      )}
    </div>
  );
}

// Detect duplicate bookings: same zimmer, overlapping dates, both active.
function findAndCancelDuplicates(bookings, onCancelled) {
  const active = bookings.filter(b => b.status !== 'נדחתה');
  const toCancel = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      if (a.zimmer_id !== b.zimmer_id) continue;
      if (new Date(a.check_in) < new Date(b.check_out) && new Date(b.check_in) < new Date(a.check_out)) {
        const id = Math.random() < 0.5 ? a.id : b.id;
        if (!toCancel.includes(id)) toCancel.push(id);
      }
    }
  }
  if (toCancel.length > 0) onCancelled(toCancel);
}