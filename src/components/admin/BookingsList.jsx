import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Check, X, Clock, Trash2, AlertTriangle } from 'lucide-react';

const STATUS_CONFIG = {
  'ממתינה': { color: 'text-amber-700 bg-amber-50', icon: Clock },
  'אושרה': { color: 'text-green-700 bg-green-50', icon: Check },
  'נדחתה': { color: 'text-red-700 bg-red-50', icon: X }
};

const cardStyle = { background: '#fff', border: '1.5px solid #F0EEE8' };
const chipStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0' };

export default function BookingsList() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    let data = await api.entities.BookingRequest.list('-created_date');
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
    await api.entities.BookingRequest.update(booking.id, { status });
    if (status === 'אושרה' && !booking.calendar_event_id) {
      setCalendarLoading(booking.id);
      try { await api.functions.invoke('addBookingToCalendar', { booking_id: booking.id }); } catch (e) { console.error('Calendar error:', e); }
      setCalendarLoading(null);
    }
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק את ההזמנה לצמיתות?')) return;
    setDeleting(id);
    try { await api.entities.BookingRequest.delete(id); } catch (e) {}
    setDeleting(null);
    load();
  };

  const dismissDeletion = async (booking) => {
    await api.entities.BookingRequest.update(booking.id, { deletion_request_reason: '', deletion_request_at: '' });
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  const deletionReqCount = bookings.filter(b => b.deletion_request_reason).length;

  return (
    <div dir="rtl">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-black" style={{ color: '#1A1A1A' }}>בקשות הזמנה</h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          {bookings.length} בקשות סה"כ
          {deletionReqCount > 0 && <span style={{ color: '#EF4444' }}> · {deletionReqCount} בקשות מחיקה מבעלי צימרים</span>}
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={cardStyle}>
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-bold mb-2" style={{ color: '#1A1A1A' }}>אין בקשות הזמנה</h3>
          <p style={{ color: '#9CA3AF' }}>כשלקוחות ישלחו בקשות, הן יופיעו כאן</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(b => {
            const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG['ממתינה'];
            const Icon = cfg.icon;
            const hasDelReq = !!b.deletion_request_reason;
            return (
              <div key={b.id} className={`rounded-2xl p-5 ${hasDelReq ? 'ring-1 ring-red-200' : ''}`} style={{ ...cardStyle, borderColor: hasDelReq ? 'rgba(239,68,68,0.35)' : '#F0EEE8' }}>
                {hasDelReq && (
                  <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-sm font-bold flex items-center gap-2 mb-1" style={{ color: '#EF4444' }}><AlertTriangle size={15} /> בקשת מחיקה מבעל הצימר</p>
                    {b.deletion_request_reason && b.deletion_request_reason !== '—' && (
                      <p className="text-xs whitespace-pre-wrap mb-3" style={{ color: '#6B7280' }}>{b.deletion_request_reason}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id} className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                        <Trash2 size={13} className="inline ml-1" /> {deleting === b.id ? 'מוחק...' : 'אשר מחיקה'}
                      </button>
                      <button onClick={() => dismissDeletion(b)} className="flex-1 py-2 rounded-lg text-sm" style={{ background: '#F8F7F4', color: '#6B7280' }}>דחה בקשה</button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="font-bold" style={{ color: '#1A1A1A' }}>{b.guest_name}</h3>
                    <p className="text-sm" style={{ color: '#6B7280' }}>{b.guest_phone}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id} title="מחק הזמנה" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
                      <Trash2 size={13} /> מחק
                    </button>
                    {b.calendar_event_id && <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#2563EB' }}>📅 ביומן</span>}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.color}`}>
                      <Icon size={12} />
                      <span>{b.status}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-xl p-3" style={chipStyle}>
                    <div className="text-xs mb-1" style={{ color: '#9CA3AF' }}>צימר</div>
                    <div className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{b.zimmer_name}</div>
                  </div>
                  <div className="rounded-xl p-3" style={chipStyle}>
                    <div className="text-xs mb-1" style={{ color: '#9CA3AF' }}>כניסה</div>
                    <div className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{b.check_in}</div>
                  </div>
                  <div className="rounded-xl p-3" style={chipStyle}>
                    <div className="text-xs mb-1" style={{ color: '#9CA3AF' }}>יציאה</div>
                    <div className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{b.check_out}</div>
                  </div>
                  <div className="rounded-xl p-3" style={chipStyle}>
                    <div className="text-xs mb-1" style={{ color: '#9CA3AF' }}>אורחים</div>
                    <div className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{b.num_guests}</div>
                  </div>
                </div>

                {b.status === 'ממתינה' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(b, 'אושרה')}
                      disabled={calendarLoading === b.id}
                      className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}
                    >
                      <Check size={14} /> {calendarLoading === b.id ? 'מוסיף ליומן...' : 'אשר הזמנה'}
                    </button>
                    <button
                      onClick={() => updateStatus(b, 'נדחתה')}
                      className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}
                    >
                      <X size={14} /> דחה הזמנה
                    </button>
                  </div>
                )}

                {b.cancel_request_reason && (
                  <div className="mt-3 text-xs rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.1)', color: '#B45309', border: '1px solid rgba(245,158,11,0.2)' }}>
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
