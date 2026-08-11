import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { CalendarDays, RefreshCw, AlertTriangle, X } from 'lucide-react';

const statusColors = {
  'ממתינה': 'bg-yellow-400/10 text-yellow-400',
  'אושרה': 'bg-green-400/10 text-green-400',
  'נדחתה': 'bg-red-400/10 text-red-400',
};

export default function CustomerBookingsTab({ user }) {
  const [bookings, setBookings] = useState([]);
  const [zimmers, setZimmers] = useState({});
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  const requestCancel = async (b) => {
    const reason = (prompt('סיבת ביטול ההזמנה (אופציונלי):', '') ?? '').trim();
    setCancelling(b.id);
    try {
      await api.entities.BookingRequest.update(b.id, {
        cancel_request_reason: reason || '—',
        cancel_request_at: new Date().toISOString(),
      });
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, cancel_request_reason: reason || '—', cancel_request_at: new Date().toISOString() } : x));
    } catch {}
    setCancelling(null);
  };

  useEffect(() => {
    const load = async () => {
      const myBookings = await api.entities.BookingRequest.filter({ created_by_id: user.id }, '-created_date', 500);

      setBookings(myBookings);

      // Fetch zimmer details
      const zimmerIds = [...new Set(myBookings.map(b => b.zimmer_id).filter(Boolean))];
      const zimmerMap = {};
      await Promise.all(zimmerIds.map(async id => {
        try {
          const z = await api.entities.Zimmer.get(id);
          if (z) zimmerMap[id] = z;
        } catch {}
      }));
      setZimmers(zimmerMap);
      setLoading(false);
    };
    load();
  }, [user.id]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-700 border-t-[#25D366] rounded-full animate-spin"></div></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">ההזמנות שלי</h1>
      <p className="text-gray-400 text-sm mb-8">{bookings.length} הזמנות</p>

      {bookings.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">📋</div>
          <p>אין הזמנות עדיין</p>
          <p className="text-xs mt-2 text-gray-600">הזמנות שתשלח דרך הצ'אט יופיעו כאן אוטומטית</p>
          <a href="/chat" className="inline-block mt-4 text-[#25D366] hover:underline text-sm">חפש צימר בצ'אט →</a>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(b => {
            const zimmer = zimmers[b.zimmer_id];
            return (
              <div key={b.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-white text-lg">{b.zimmer_name}</p>
                    {zimmer?.location && <p className="text-gray-400 text-sm">{zimmer.location}</p>}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[b.status] || 'bg-gray-700 text-gray-300'}`}>
                    {b.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1.5"><CalendarDays size={14} /> {b.check_in} → {b.check_out}</span>
                  {b.num_guests && <span>👥 {b.num_guests} אורחים</span>}
                </div>
                {zimmer && (
                  <div className="mt-4 pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-500 mb-1">פרטי בעל המתחם</p>
                    <p className="text-sm text-white">{zimmer.owner_name || 'בעל המתחם'}</p>
                  </div>
                )}
                {b.notes && <p className="text-xs text-gray-500 mt-2">הערות: {b.notes}</p>}

                <div className="mt-4 pt-3 border-t border-gray-800">
                  {b.status === 'נדחתה' ? null : b.cancel_request_reason ? (
                    <div className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-400/20 rounded-lg px-3 py-2">
                      <AlertTriangle size={14} /> ביטול מבוקש — ממתין לאישור בעל המתחם
                    </div>
                  ) : (
                    <button
                      onClick={() => requestCancel(b)}
                      disabled={cancelling === b.id}
                      className="flex items-center gap-1.5 text-xs text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-400/20 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <X size={14} /> {cancelling === b.id ? 'שולח...' : 'בקש ביטול הזמנה'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}