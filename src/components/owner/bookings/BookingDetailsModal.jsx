import React, { useState } from 'react';
import { X, PenLine, Trash2, CheckCircle, XCircle, AlertTriangle, LogOut as LogOutIcon, Loader2 } from 'lucide-react';
import { calcBookingTotal, getBookingTotal, formatILS } from '@/lib/bookingPrice';
import { statusDisplay } from './bookingStatus';

// Light-theme booking details modal — preserves all existing business logic
// (edit, approve/reject, deletion request, manual checkout, cancel request).
export default function BookingDetailsModal({ booking, zimmers, onClose, onSave, onRequestDeletion, onConfirmCancel, onDismissCancel, onStatusChange, calendarLoading, onManualCheckout }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...booking });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [delReason, setDelReason] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const handleSave = async () => {
    const z = zimmers?.find(zs => zs.id === form.zimmer_id);
    const total = calcBookingTotal(form.check_in, form.check_out, z?.price_per_night || booking.price_per_night);
    setSaving(true);
    await onSave({ ...form, total_price: total });
    setSaving(false);
    setEditing(false);
  };

  const st = statusDisplay(booking);
  const zimmer = zimmers?.find(z => z.id === booking.zimmer_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #ECEFF1' }}>
          <h3 className="font-bold text-lg" style={{ color: '#212121' }}>פרטי הזמנה</h3>
          <div className="flex items-center gap-1.5">
            {!editing && (
              <>
                <button onClick={() => setEditing(true)} className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors" style={{ background: '#FFF3E0', color: '#EA580C' }}>
                  <PenLine size={15} />
                </button>
                {booking.deletion_request_reason ? (
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#FFF8E1', color: '#92400E' }}>בקשת מחיקה נשלחה</span>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#FFEBEE', color: '#C62828' }}>
                    <Trash2 size={15} />
                  </button>
                )}
              </>
            )}
            <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#F5F5F5', color: '#616161' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div className="p-5" style={{ borderBottom: '1px solid #ECEFF1', background: '#FFEBEE' }}>
            <p className="text-sm mb-1 flex items-center gap-2" style={{ color: '#C62828' }}><AlertTriangle size={15} /> בקשת מחיקת הזמנה</p>
            <p className="text-xs mb-3" style={{ color: '#616161' }}>הבקשה תועבר לאישור האדמין. ההזמנה תישאר במערכת עד לאישור.</p>
            <textarea value={delReason} onChange={e => setDelReason(e.target.value)} placeholder="סיבת המחיקה (אופציונלי)" rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-3" style={{ border: '1px solid #ECEFF1', color: '#212121' }} />
            <div className="flex gap-2">
              <button onClick={() => { onRequestDeletion(booking, delReason); setConfirmDelete(false); setDelReason(''); }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#E53935' }}>שלח בקשה לאדמין</button>
              <button onClick={() => { setConfirmDelete(false); setDelReason(''); }}
                className="flex-1 py-2 rounded-lg text-sm" style={{ background: '#F5F5F5', color: '#616161' }}>ביטול</button>
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
                { label: "צ'ק-אין", field: 'check_in', type: 'date' },
                { label: "צ'ק-אאוט", field: 'check_out', type: 'date' },
                { label: 'מספר אורחים', field: 'num_guests', type: 'number' },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="text-xs block mb-1" style={{ color: '#9e9e9e' }}>{label}</label>
                  <input type={type} value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: '1px solid #ECEFF1', color: '#212121' }} />
                </div>
              ))}
              <div>
                <label className="text-xs block mb-1" style={{ color: '#9e9e9e' }}>הערות</label>
                <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ border: '1px solid #ECEFF1', color: '#212121' }} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" style={{ background: '#263238' }}>
                  {saving ? 'שומר...' : 'שמור'}
                </button>
                <button onClick={() => { setEditing(false); setForm({ ...booking }); }} className="flex-1 py-2.5 rounded-lg text-sm" style={{ background: '#F5F5F5', color: '#616161' }}>ביטול</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />{st.label}
                </span>
                {booking.calendar_event_id && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#E3F2FD', color: '#1565C0' }}>📅 ביומן</span>}
              </div>

              {booking.cancel_request_reason && (
                <div className="rounded-xl p-3 mb-1" style={{ background: '#FFEBEE', border: '1px solid #FFCDD2' }}>
                  <p className="text-xs font-bold mb-1 flex items-center gap-1.5" style={{ color: '#C62828' }}><AlertTriangle size={13} /> בקשת ביטול מהלקוח</p>
                  <p className="text-xs mb-2 whitespace-pre-wrap" style={{ color: '#616161' }}>{booking.cancel_request_reason}</p>
                  <div className="flex gap-2">
                    <button onClick={() => onConfirmCancel(booking)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#E53935' }}>אשר ביטול</button>
                    <button onClick={() => onDismissCancel(booking)} className="flex-1 py-1.5 rounded-lg text-xs" style={{ background: '#F5F5F5', color: '#616161' }}>דחה בקשה</button>
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
                { label: 'סך תשלום', value: formatILS(getBookingTotal(booking, zimmer)) },
                ...(booking.notes ? [{ label: 'הערות', value: booking.notes }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <span className="text-sm" style={{ color: '#9e9e9e' }}>{label}</span>
                  <span className="text-sm font-medium" style={{ color: '#212121' }}>{value}</span>
                </div>
              ))}

              {booking.status === 'ממתינה' && (
                <div className="flex gap-2 pt-2">
                  <button onClick={() => onStatusChange(booking, 'אושרה')} disabled={calendarLoading === booking.id}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50" style={{ background: '#2E7D32' }}>
                    {calendarLoading === booking.id ? '...' : '✓ אשר הזמנה'}
                  </button>
                  <button onClick={() => onStatusChange(booking, 'נדחתה')} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: '#FFEBEE', color: '#C62828' }}>✗ דחה</button>
                </div>
              )}
              {booking.status === 'אושרה' && booking.checked_out && (
                <div className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5" style={{ background: '#E8F5E9', color: '#2E7D32' }}>
                  <CheckCircle size={13} /> בוצע צ'ק-אאוט {booking.checked_out_at ? `· ${new Date(booking.checked_out_at).toLocaleDateString('he-IL')}` : ''}
                </div>
              )}
              {booking.status === 'אושרה' && !booking.checked_out && onManualCheckout && (
                <button onClick={async () => { setCheckoutBusy(true); await onManualCheckout(booking); setCheckoutBusy(false); }} disabled={checkoutBusy}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: '#FFF3E0', color: '#EA580C' }}>
                  {checkoutBusy ? <Loader2 size={14} className="animate-spin" /> : <LogOutIcon size={14} />} בצע צ'ק-אאוט ידני
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}