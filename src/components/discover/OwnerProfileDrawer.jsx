import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useNavigate } from 'react-router-dom';
import { X, MapPin } from 'lucide-react';

// Slide-over owner profile: avatar + name + the owner's approved zimmers.
// Clicking a zimmer triggers the booking flow (the same "Book now" path).
export default function OwnerProfileDrawer({ video, onClose, onPickZimmer }) {
  const [zimmers, setZimmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.entities.Zimmer.filter({ owner_id: video.owner_id, approval_status: 'אושר' })
      .then((z) => { if (active) { setZimmers(z || []); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [video.owner_id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} dir="rtl" onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh', background: 'rgba(20,20,22,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="px-5 py-5 flex items-center gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.8)', color: '#fff' }}>
            {video.owner_avatar_url
              ? <img src={video.owner_avatar_url} alt="" className="w-full h-full object-cover" />
              : (video.owner_name?.[0] || 'Z')}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-base truncate">{video.owner_name}</h3>
            <p className="text-white/50 text-xs">בעל צימר · {zimmers.length} נכסים</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : zimmers.length === 0 ? (
            <p className="text-white/60 text-sm text-center py-10">אין נכסים זמינים להצגה.</p>
          ) : (
            <div className="space-y-3">
              {zimmers.map((z) => (
                <button key={z.id} onClick={() => onPickZimmer(z)}
                  className="w-full flex gap-3 rounded-2xl p-2.5 text-right transition-all hover:bg-white/5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    {z.images?.[0]
                      ? <img src={z.images[0]} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">אין תמונה</div>}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-white font-semibold text-sm truncate">{z.name}</p>
                    {z.location && <p className="text-white/60 text-xs flex items-center gap-1 mt-0.5 truncate"><MapPin size={12} /> {z.location}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      {z.price_per_night && <span className="text-white/80 text-xs font-semibold">₪{z.price_per_night}/לילה</span>}
                      <span className="text-white/40 text-[11px]">· {z.num_rooms || '?'} חדרים</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}