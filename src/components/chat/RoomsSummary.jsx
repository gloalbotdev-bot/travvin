import React from 'react';
import { BedDouble, Bath, Users } from 'lucide-react';
import { totalBeds, bathroomsCount, roomsCapacity, roomBedsLabel } from '@/lib/rooms';

// Rich per-room breakdown + a computed summary (total beds / total baths / capacity).
export default function RoomsSummary({ zimmer }) {
  const rooms = Array.isArray(zimmer.rooms_detail) ? zimmer.rooms_detail : [];
  if (rooms.length === 0) return null;

  const beds = totalBeds(rooms);
  const baths = bathroomsCount(rooms, zimmer.additional_bathrooms_count);
  const capacity = roomsCapacity(rooms) || zimmer.max_guests || null;

  return (
    <div dir="rtl">
      <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: '#0B3838' }}>פירוט חדרים</h3>

      {/* Computed summary */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {beds != null && <Summary icon={BedDouble} label="סה״כ מיטות" value={beds} />}
        {baths > 0 && <Summary icon={Bath} label="סה״כ רחצה" value={baths} />}
        {capacity != null && <Summary icon={Users} label="קיבולת" value={capacity} />}
      </div>

      {/* Per-room cards */}
      <div className="space-y-2">
        {rooms.map((r, i) => (
          <div key={i} className="rounded-xl p-3 flex gap-3" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8' }}>
            {r.room_photo && (
              <img src={r.room_photo} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold truncate" style={{ color: '#1A1A1A' }}>{r.room_name || `חדר ${i + 1}`}</span>
                {(r.max_guests_in_room != null) && (
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#0B3838' }}>עד {r.max_guests_in_room} אורחים</span>
                )}
              </div>
              <p className="text-xs mb-1.5" style={{ color: '#4B5563' }}>{roomBedsLabel(r)}</p>
              <div className="flex flex-wrap gap-1.5">
                {(r.has_bathroom || r.has_private_bathroom) && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}>
                    <Bath size={11} /> רחצה צמוד
                  </span>
                )}
                {(r.amenities || []).map((a, ai) => (
                  <span key={ai} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(11,56,56,0.06)', color: '#0B3838' }}>{a}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Summary({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl p-2.5 text-center" style={{ background: '#fff', border: '1px solid #F0EEE8' }}>
      <Icon size={14} className="mx-auto mb-0.5" style={{ color: '#0B3838' }} />
      <div className="text-sm font-black" style={{ color: '#1A1A1A' }}>{value}</div>
      <div className="text-[10px]" style={{ color: '#9CA3AF' }}>{label}</div>
    </div>
  );
}