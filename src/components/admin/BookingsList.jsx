import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Check, X, Clock, Trash2, AlertTriangle } from 'lucide-react';

const STATUS_CONFIG = {
  'ממתינה': { color: 'text-yellow-400 bg-yellow-400/10', icon: Clock },
  'אושרה': { color: 'text-green-400 bg-green-400/10', icon: Check },
  'נדחתה': { color: 'text-red-400 bg-red-400/10', icon: X }
};

export default function BookingsList() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    let data = await base44.entities.BookingRequest.list('-created_date');
    // Deletion requests jump to the top of the list
    data = data.sort((a, b) => {
      const ad = a.deletion_request_reason ? 1 : 0;
      const bd = b.deletion_request_reason ? 1 : 0;
      if (bd - ad !== 0) return bd - ad;
      return new Date(b.created_date) - new Date(a.created_date);
    });
    setBookings(data);
    setLoading(false);
  };

  const updateStatus = async (booking, status) => {
    await base44.entities.BookingRequest.update(booking.id, { status });
    if (status === 'אושרה' && !booking.calendar_event_id) {
      setCalendarLoading(booking.id);
      try { await base44.functions.invoke('addBookingToCalendar', { booking_id: booking.id }); } catch (e) { console.error('Calendar error:', e); }
      setCalendarLoading(null);
    }
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק את ההזמנה לצמיתות?')) return;
    setDeleting(id);
    try { await base44.entities.BookingRequest.delete(id); } catch (e) {}
    setDeleting(null);
    load();
  };

  const dismissDeletion = async (booking) => {
    await base44.entities.BookingRequest.update(booking.id, { deletion_request_reason: '', deletion_request_at: '' });
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-gray-700 border-t-[#25D366] rounded-full animate-spin"></div>
    </div>
  );

  const deletionReqCount = bookings.filter(b => b.deletion_request_reason).length;

  return (
    <div dir="rtl">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-white">בקשות הזמנה</h1>
        <p className="text-gray-400 text-sm mt-1">
          {bookings.length} בקשות סה"כ
          {deletionReqCount > 0 && <span className="text-red-400"> · {deletionReqCount} בקשות מחיקה מבעלי צימרים</span>}
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-bold text-white mb-2">אין בקשות הזמנה</h3>
          <p className="text-gray-400">כשלקוחות ישלחו בקשות, הן יופיעו כאן</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(b => {
            const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG['ממתינה'];
            const Icon = cfg.icon;
            const hasDelReq = !!b.deletion_request_reason;
            return (
              <div key={b.id} className={`bg-gray-900 border rounded-2xl p-5 ${hasDelReq ? 'border-red-400/50 ring-1 ring-red-400/20' : 'border-gray-800'}`}>
                {/* Deletion request banner (jumps to top via sort) */}
                {hasDelReq && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-400/30">
                    <p className="text-red-300 text-sm font-bold flex items-center gap-2 mb-1"><AlertTriangle size={15} /> בקשת מחיקה מבעל הצימר</p>
                    {b.deletion_request_reason && b.deletion_request_reason !== '—' && (
                      <p className="text-gray-300 text-xs whitespace-pre-wrap mb-3">{b.deletion_request_reason}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id} className="flex-1 py-2 bg-red-500/20 text-red-300 rounded-lg text-sm font-semibold hover:bg-red-500/30 disabled:opacity-50">
                        <Trash2 size={13} className="inline ml-1" /> {deleting === b.id ? 'מוחק...' : 'אשר מחיקה'}
                      </button>
                      <button onClick={() => dismissDeletion(b)} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700">דחה בקשה</button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-white">{b.guest_name}</h3>
                    <p className="text-gray-400 text-sm">{b.guest_phone}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id} title="מחק הזמנה" className="flex items-center gap-1 text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50">
                      <Trash2 size={13} /> מחק
                    </button>
                    {b.calendar_event_id && <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">📅 ביומן</span>}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.color}`}>
                      <Icon size={12} />
                      <span>{b.status}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">צימר</div>
                    <div className="text-sm font-medium text-white">{b.zimmer_name}</div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">כניסה</div>
                    <div className="text-sm font-medium text-white">{b.check_in}</div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">יציאה</div>
                    <div className="text-sm font-medium text-white">{b.check_out}</div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">אורחים</div>
                    <div className="text-sm font-medium text-white">{b.num_guests}</div>
                  </div>
                </div>

                {b.status === 'ממתינה' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(b, 'אושרה')}
                      disabled={calendarLoading === b.id}
                      className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Check size={14} /> {calendarLoading === b.id ? 'מוסיף ליומן...' : 'אשר הזמנה'}
                    </button>
                    <button
                      onClick={() => updateStatus(b, 'נדחתה')}
                      className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <X size={14} /> דחה הזמנה
                    </button>
                  </div>
                )}

                {b.cancel_request_reason && (
                  <div className="mt-3 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-400/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <AlertTriangle size={13} /> בקשת ביטול מהלקוח: {b.cancel_request_reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}