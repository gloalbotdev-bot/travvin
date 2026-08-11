import React, { useState, useMemo } from 'react';
import { api } from '@/api/client';
import { X, Calendar, User, Phone, Users, Home, MessageSquare, Check } from 'lucide-react';
import { calcNights, calcBookingTotalForZimmer, formatILS } from '@/lib/bookingPrice';
import { bookingErrorMessage } from '@/lib/bookingErrors';

export default function ManualBookingForm({ zimmers, ownerId, onClose, onSaved, onSwitchToText, initialDate }) {
  const [form, setForm] = useState({
    zimmer_id: zimmers[0]?.id || '',
    guest_name: '',
    guest_phone: '',
    check_in: initialDate || '',
    check_out: '',
    num_guests: 2,
    notes: '',
    status: 'אושרה',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedZimmer = zimmers.find(z => z.id === form.zimmer_id);
  const nights = useMemo(() => calcNights(form.check_in, form.check_out), [form.check_in, form.check_out]);
  const total = useMemo(
    () => calcBookingTotalForZimmer(selectedZimmer, form.check_in, form.check_out, 0, 0),
    [form.check_in, form.check_out, selectedZimmer]
  );

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const valid = form.zimmer_id && form.guest_name.trim() && form.guest_phone.trim() && form.check_in && form.check_out && nights > 0;

  const handleSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      zimmer_name: selectedZimmer?.name || '',
      owner_id: ownerId,
      total_price: total,
    };
    try {
      await api.entities.BookingRequest.create(payload);
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(bookingErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} dir="rtl"
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()} style={{ fontFamily: 'Heebo, sans-serif' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-white z-10" style={{ borderBottom: '1px solid #F0EEE8' }}>
          <h2 className="font-black text-lg" style={{ color: '#1A1A1A' }}>הוספת הזמנה ידנית</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F8F7F4', color: '#6B7280' }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Switch to text */}
          <button
            onClick={onSwitchToText}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(249,115,22,0.06)', color: '#EA580C', border: '1.5px dashed rgba(249,115,22,0.3)' }}
          >
            <MessageSquare size={14} /> מעדיף להוסיף בטקסט חופשי
          </button>

          {/* Zimmer */}
          <Field label="צימר" icon={Home}>
            <select value={form.zimmer_id} onChange={e => update('zimmer_id', e.target.value)}
              className="w-full px-3 py-2.5 text-sm outline-none rounded-xl" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}>
              {zimmers.length === 0 && <option value="">אין צימרים</option>}
              {zimmers.map(z => <option key={z.id} value={z.id}>{z.name}{z.price_per_night ? ` — ₪${z.price_per_night}/לילה` : ''}</option>)}
            </select>
          </Field>

          {/* Guest name + phone */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="שם הלקוח" icon={User}>
              <input value={form.guest_name} onChange={e => update('guest_name', e.target.value)} placeholder="שם מלא"
                className="w-full px-3 py-2.5 text-sm outline-none rounded-xl" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }} />
            </Field>
            <Field label="טלפון" icon={Phone}>
              <input value={form.guest_phone} onChange={e => update('guest_phone', e.target.value)} placeholder="050-0000000" type="tel"
                className="w-full px-3 py-2.5 text-sm outline-none rounded-xl" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }} />
            </Field>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="כניסה" icon={Calendar}>
              <input type="date" value={form.check_in} onChange={e => update('check_in', e.target.value)}
                className="w-full px-3 py-2.5 text-sm outline-none rounded-xl" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }} />
            </Field>
            <Field label="יציאה" icon={Calendar}>
              <input type="date" value={form.check_out} onChange={e => update('check_out', e.target.value)} min={form.check_in || undefined}
                className="w-full px-3 py-2.5 text-sm outline-none rounded-xl" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }} />
            </Field>
          </div>

          {/* Guests */}
          <Field label="מספר אורחים" icon={Users}>
            <input type="number" min={1} value={form.num_guests} onChange={e => update('num_guests', Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm outline-none rounded-xl" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }} />
          </Field>

          {/* Status */}
          <Field label="סטטוס">
            <select value={form.status} onChange={e => update('status', e.target.value)}
              className="w-full px-3 py-2.5 text-sm outline-none rounded-xl" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}>
              <option value="אושרה">אושרה</option>
              <option value="ממתינה">ממתינה לאישור</option>
            </select>
          </Field>

          {/* Notes */}
          <Field label="הערות (אופציונלי)">
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} placeholder="בקשות מיוחדות..."
              className="w-full px-3 py-2.5 text-sm outline-none rounded-xl resize-none" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }} />
          </Field>

          {/* Price summary */}
          {nights > 0 && (
            <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'rgba(249,115,22,0.06)', border: '1.5px solid rgba(249,115,22,0.2)' }}>
              <div>
                <div className="text-xs" style={{ color: '#6B7280' }}>חישוב תשלום</div>
                <div className="text-sm font-medium" style={{ color: '#1A1A1A' }}>
                  {nights} לילות × ₪{selectedZimmer?.price_per_night || 0}
                </div>
              </div>
              <div className="text-xl font-black" style={{ color: '#EA580C' }}>{formatILS(total)}</div>
            </div>
          )}
          {form.check_in && form.check_out && nights <= 0 && (
            <p className="text-xs text-red-500">תאריך היציאה חייב להיות אחרי תאריך הכניסה</p>
          )}
          {error && (
            <p className="text-sm font-semibold text-center" style={{ color: '#EF4444' }}>⚠️ {error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ border: '1.5px solid #E8E5E0', color: '#6B7280', background: 'transparent' }}>
              ביטול
            </button>
            <button onClick={handleSubmit} disabled={!valid || saving}
              className="flex-1 text-white py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#F97316' }}>
              <Check size={16} /> {saving ? 'שומר...' : 'צור הזמנה'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5 flex items-center gap-1.5" style={{ color: '#6B7280' }}>
        {Icon && <Icon size={12} />}{label}
      </label>
      {children}
    </div>
  );
}