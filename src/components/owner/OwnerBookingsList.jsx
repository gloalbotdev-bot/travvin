import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { CheckCircle, XCircle, Clock, Eye, Trash2, PenLine, X, AlertTriangle, Plus } from 'lucide-react';
import { calcBookingTotal, getBookingTotal, formatILS } from '@/lib/bookingPrice';
import { bookingErrorMessage } from '@/lib/bookingErrors';

const STATUS_CONFIG = {
  'ממתינה': { color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: Clock, label: 'ממתינה' },
  'אושרה': { color: 'text-green-400 bg-green-400/10 border-green-400/20', icon: CheckCircle, label: 'אושרה' },
  'נדחתה': { color: 'text-red-400 bg-red-400/10 border-red-400/20', icon: XCircle, label: 'נדחתה' },
};

function BookingModal({ booking, zimmers, onClose, onSave, onRequestDeletion, onConfirmCancel, onDismissCancel, onStatusChange, calendarLoading }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...booking });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [delReason, setDelReason] = useState('');

  const handleSave = async () => {
    const z = zimmers?.find(zs => zs.id === form.zimmer_id);
    const total = calcBookingTotal(form.check_in, form.check_out, z?.price_per_night || booking.price_per_night);
    setSaving(true);
    await onSave({ ...form, total_price: total });
    setSaving(false);
    setEditing(false);
  };

  const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG['ממתינה'];
  const Icon = cfg.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h3 className="font-bold text-white text-lg">פרטי הזמנה</h3>
          <div className="flex items-center gap-2">
            {!editing && (
              <>
                <button onClick={() => setEditing(true)} className="p-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors">
                  <PenLine size={15} />
                </button>
                {booking.deletion_request_reason ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-400/10 text-yellow-300 border border-yellow-400/20">בקשת מחיקה נשלחה</span>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                    <Trash2 size={15} />
                  </button>
                )}
              </>
            )}
            <button onClick={onClose} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Deletion request confirm */}
        {confirmDelete && (
          <div className="p-5 border-b border-gray-800 bg-red-500/5">
            <p className="text-red-400 text-sm mb-1 flex items-center gap-2"><AlertTriangle size={15} /> בקשת מחיקת הזמנה</p>
            <p className="text-gray-400 text-xs mb-3">הבקשה תועבר לאישור האדמין. ההזמנה תישאר במערכת עד לאישור.</p>
            <textarea
              value={delReason}
              onChange={e => setDelReason(e.target.value)}
              placeholder="סיבת המחיקה (אופציונלי)"
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-500 resize-none mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => { onRequestDeletion(booking, delReason); setConfirmDelete(false); setDelReason(''); }} className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-500/30">שלח בקשה לאדמין</button>
              <button onClick={() => { setConfirmDelete(false); setDelReason(''); }} className="flex-1 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm hover:bg-gray-700">ביטול</button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-3">
          {editing ? (
            <>
              {[
                { label: 'שם האורח', field: 'guest_name', type: 'text' },
                { label: 'טלפון', field: 'guest_phone', type: 'tel' },
                { label: 'צ\'ק-אין', field: 'check_in', type: 'date' },
                { label: 'צ\'ק-אאוט', field: 'check_out', type: 'date' },
                { label: 'מספר אורחים', field: 'num_guests', type: 'number' },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[field] || ''}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-orange-500"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 block mb-1">הערות</label>
                <textarea
                  value={form.notes || ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-orange-500 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 disabled:opacity-50">
                  {saving ? 'שומר...' : 'שמור'}
                </button>
                <button onClick={() => { setEditing(false); setForm({ ...booking }); }} className="flex-1 py-2.5 bg-gray-800 text-gray-400 rounded-lg text-sm hover:bg-gray-700">
                  ביטול
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${cfg.color}`}>
                  <Icon size={12} /> {cfg.label}
                </span>
                {booking.calendar_event_id && <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">📅 ביומן</span>}
              </div>

              {booking.cancel_request_reason && (
                <div className="rounded-xl p-3 bg-red-500/10 border border-red-400/30 mb-3">
                  <p className="text-red-300 text-xs font-bold mb-1 flex items-center gap-1.5"><AlertTriangle size={13} /> בקשת ביטול מהלקוח</p>
                  <p className="text-gray-300 text-xs mb-2 whitespace-pre-wrap">{booking.cancel_request_reason}</p>
                  <div className="flex gap-2">
                    <button onClick={() => onConfirmCancel(booking)} className="flex-1 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-xs font-semibold hover:bg-red-500/30">אשר ביטול</button>
                    <button onClick={() => onDismissCancel(booking)} className="flex-1 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">דחה בקשה</button>
                  </div>
                </div>
              )}

              {[
                { label: 'שם האורח', value: booking.guest_name },
                { label: 'צימר', value: booking.zimmer_name },
                { label: 'טלפון', value: booking.guest_phone },
                { label: 'כניסה', value: booking.check_in },
                { label: 'יציאה', value: booking.check_out },
                { label: 'אורחים', value: `${booking.num_guests || 1} אנשים` },
                { label: 'סך תשלום', value: formatILS(getBookingTotal(booking, zimmers?.find(z => z.id === booking.zimmer_id))) },
                ...(booking.notes ? [{ label: 'הערות', value: booking.notes }] : []),
                ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                  <span className="text-gray-500 text-sm">{label}</span>
                  <span className="text-white text-sm font-medium">{value}</span>
                </div>
              ))}
              {booking.status === 'ממתינה' && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => onStatusChange(booking, 'אושרה')}
                    disabled={calendarLoading === booking.id}
                    className="flex-1 py-2.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {calendarLoading === booking.id ? '...' : '✓ אשר הזמנה'}
                  </button>
                  <button
                    onClick={() => onStatusChange(booking, 'נדחתה')}
                    className="flex-1 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-semibold transition-colors"
                  >
                    ✗ דחה
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingCard({ booking, zimmers, onClick }) {
  const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG['ממתינה'];
  const Icon = cfg.icon;
  const total = getBookingTotal(booking, zimmers?.find(z => z.id === booking.zimmer_id));
  const hasCancel = !!booking.cancel_request_reason;
  return (
    <div
      onClick={onClick}
      className={`bg-gray-900 border rounded-xl p-4 cursor-pointer hover:border-gray-600 transition-all hover:-translate-y-0.5 ${hasCancel ? 'border-red-400/50 ring-1 ring-red-400/30' : 'border-gray-800'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-semibold text-white text-sm">{booking.guest_name}</span>
        {hasCancel ? (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-400/30">
            <AlertTriangle size={11} /> בקשת ביטול
          </span>
        ) : (
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>
            <Icon size={11} /> {cfg.label}
          </span>
        )}
      </div>
      <p className="text-gray-400 text-xs mb-2">{booking.zimmer_name}</p>
      <div className="text-xs text-gray-500 space-y-1">
        <div>📅 {booking.check_in} → {booking.check_out}</div>
        <div className="flex items-center justify-between">
          <span>👥 {booking.num_guests || 1} | 📞 {booking.guest_phone}</span>
          {total > 0 && <span className="text-green-400 font-medium">₪{total.toLocaleString()}</span>}
        </div>
      </div>
    </div>
  );
}

// Detect duplicate bookings: same zimmer, overlapping dates, both active (not rejected)
function findAndCancelDuplicates(bookings, onCancelled) {
  const active = bookings.filter(b => b.status !== 'נדחתה');
  const toCancel = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      if (a.zimmer_id !== b.zimmer_id) continue;
      const aIn = new Date(a.check_in), aOut = new Date(a.check_out);
      const bIn = new Date(b.check_in), bOut = new Date(b.check_out);
      if (aIn < bOut && bIn < aOut) {
        // Overlap — cancel one randomly
        const cancelId = Math.random() < 0.5 ? a.id : b.id;
        if (!toCancel.includes(cancelId)) toCancel.push(cancelId);
      }
    }
  }
  if (toCancel.length > 0) onCancelled(toCancel);
}

export default function OwnerBookingsList({ ownerId, zimmers = [], onAddBooking, focusBookingId, refreshToken }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [duplicateCancelled, setDuplicateCancelled] = useState(0);

  useEffect(() => {
    if (ownerId) loadBookings();
  }, [ownerId, refreshToken]);

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

    // Auto-fix duplicates on load
    findAndCancelDuplicates(sorted, async (ids) => {
      try {
        await Promise.all(ids.map(id => api.entities.BookingRequest.update(id, { status: 'נדחתה' })));
        setDuplicateCancelled(ids.length);
        const updated = await api.entities.BookingRequest.filter({ owner_id: ownerId });
        setBookings(updated.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      } catch (e) {
        console.warn('Duplicate auto-cancel skipped:', e?.message || e);
      }
    });
  };

  const handleStatusChange = async (booking, newStatus) => {
    // Before approving, check for conflicts
    if (newStatus === 'אושרה') {
      const conflicts = bookings.filter(b =>
        b.id !== booking.id &&
        b.zimmer_id === booking.zimmer_id &&
        b.status === 'אושרה' &&
        new Date(b.check_in) < new Date(booking.check_out) &&
        new Date(booking.check_in) < new Date(b.check_out)
      );
      if (conflicts.length > 0) {
        alert(`⚠️ לא ניתן לאשר — קיימת כבר הזמנה מאושרת לצימר זה בתאריכים הנ"ל`);
        return;
      }
    }
    try {
      await api.entities.BookingRequest.update(booking.id, { status: newStatus });
    } catch (e) {
      alert(`⚠️ ${bookingErrorMessage(e, 'לא ניתן לעדכן את הסטטוס')}`);
      return;
    }
    if (newStatus === 'אושרה' && !booking.calendar_event_id) {
      setCalendarLoading(booking.id);
      try {
        await api.functions.invoke('addBookingToCalendar', { booking_id: booking.id });
      } catch (e) {
        console.error('Calendar error:', e);
      }
      setCalendarLoading(null);
    }
    setSelectedBooking(null);
    loadBookings();
  };

  const handleSave = async (form) => {
    try {
      await api.entities.BookingRequest.update(form.id, {
        guest_name: form.guest_name,
        guest_phone: form.guest_phone,
        check_in: form.check_in,
        check_out: form.check_out,
        num_guests: form.num_guests,
        notes: form.notes,
        total_price: form.total_price,
      });
      setSelectedBooking(null);
      loadBookings();
    } catch (e) {
      alert(`⚠️ ${bookingErrorMessage(e, 'לא ניתן לשמור את ההזמנה')}`);
    }
  };

  const handleDelete = async (id) => {
    await api.entities.BookingRequest.delete(id);
    setSelectedBooking(null);
    loadBookings();
  };

  const handleRequestDeletion = async (booking, reason) => {
    await api.entities.BookingRequest.update(booking.id, {
      deletion_request_reason: reason || '—',
      deletion_request_at: new Date().toISOString(),
    });
    setSelectedBooking(null);
    loadBookings();
  };

  const handleConfirmCancel = async (booking) => {
    await api.entities.BookingRequest.update(booking.id, {
      status: 'נדחתה',
      cancel_request_reason: '',
      cancel_request_at: '',
    });
    setSelectedBooking(null);
    loadBookings();
  };

  const handleDismissCancel = async (booking) => {
    await api.entities.BookingRequest.update(booking.id, {
      cancel_request_reason: '',
      cancel_request_at: '',
    });
    loadBookings();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-gray-700 border-t-[#25D366] rounded-full animate-spin"></div>
    </div>
  );

  const cancelFirst = (a, b) => (b.cancel_request_reason ? 1 : 0) - (a.cancel_request_reason ? 1 : 0) || new Date(b.created_date) - new Date(a.created_date);
  const pending = bookings.filter(b => b.status === 'ממתינה').sort(cancelFirst);
  const approved = bookings.filter(b => b.status === 'אושרה').sort(cancelFirst);

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">הזמנות</h1>
        <div className="flex items-center gap-3">
          {duplicateCancelled > 0 && (
            <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-3 py-1.5 rounded-full">
              <AlertTriangle size={13} /> בוטלו {duplicateCancelled} כפולות
            </div>
          )}
          {onAddBooking && (
            <button
              onClick={onAddBooking}
              className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
              style={{ background: '#F97316' }}
            >
              <Plus size={15} /> הוסף הזמנה בטקסט
            </button>
          )}
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-20 text-gray-500">אין הזמנות עדיין</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pending */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-yellow-400" />
              <h2 className="text-white font-semibold">ממתינות לאישור</h2>
              {pending.length > 0 && (
                <span className="bg-yellow-400/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full">{pending.length}</span>
              )}
            </div>
            {pending.length === 0 ? (
              <div className="text-center py-10 text-gray-600 text-sm border border-dashed border-gray-800 rounded-xl">אין הזמנות ממתינות</div>
            ) : (
              <div className="space-y-3">
                {pending.map(b => (
                  <BookingCard key={b.id} booking={b} zimmers={zimmers} onClick={() => setSelectedBooking(b)} />
                ))}
              </div>
            )}
          </div>

          {/* Approved */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={16} className="text-green-400" />
              <h2 className="text-white font-semibold">הזמנות מאושרות</h2>
              {approved.length > 0 && (
                <span className="bg-green-400/20 text-green-400 text-xs px-2 py-0.5 rounded-full">{approved.length}</span>
              )}
            </div>
            {approved.length === 0 ? (
              <div className="text-center py-10 text-gray-600 text-sm border border-dashed border-gray-800 rounded-xl">אין הזמנות מאושרות</div>
            ) : (
              <div className="space-y-3">
                {approved.map(b => (
                  <BookingCard key={b.id} booking={b} zimmers={zimmers} onClick={() => setSelectedBooking(b)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          zimmers={zimmers}
          onClose={() => setSelectedBooking(null)}
          onSave={handleSave}
          onRequestDeletion={handleRequestDeletion}
          onConfirmCancel={handleConfirmCancel}
          onDismissCancel={handleDismissCancel}
          onStatusChange={handleStatusChange}
          calendarLoading={calendarLoading}
        />
      )}
    </div>
  );
}