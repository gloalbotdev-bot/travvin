import React from 'react';
import { MapPin, Users, BedDouble, Star } from 'lucide-react';

// Customer-facing zimmer card — mirrors the owner's ZimmerListCard look,
// minus edit/delete actions, with a rating badge when reviews exist.
export default function ZimmerBrowseCard({ zimmer, rating, onClick }) {
  const img = zimmer.images?.[0];
  const weekday = zimmer.weekday_price ?? zimmer.price_per_night;
  const weekend = zimmer.weekend_price ?? zimmer.price_per_night;
  const showTwo = !!(zimmer.weekday_price || zimmer.weekend_price);

  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer group"
      style={{ background: '#fff', border: '1.5px solid #F0EEE8' }} onClick={onClick}>
      <div className="h-52 relative overflow-hidden" style={{ background: '#F8F7F4' }}>
        {img
          ? <img src={img} alt={zimmer.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #EAD5FF 0%, #FFD4C2 100%)' }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none"><path d="M28 8L8 22v26h14V34h12v14h14V22L28 8z" stroke="#9CA3AF" strokeWidth="2.5" strokeLinejoin="round" fill="none" /></svg>
          </div>
        }
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 50%)' }} />
        {zimmer.price_per_night && (
          <div className="absolute bottom-3 right-3 text-white text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#F97316' }}>
            {showTwo ? `₪${weekday}–₪${weekend}` : `₪${zimmer.price_per_night}/לילה`}
          </div>
        )}
        {rating && rating.count > 0 && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.92)' }}>
            <Star size={11} fill="#F97316" style={{ color: '#F97316' }} />
            <span className="text-xs font-black" style={{ color: '#1A1A1A' }}>{rating.avg.toFixed(1)}</span>
            <span className="text-[10px]" style={{ color: '#6B7280' }}>({rating.count})</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-base mb-1 truncate" style={{ color: '#1A1A1A' }}>{zimmer.name}</h3>
        <p className="text-sm mb-3 flex items-center gap-1 truncate" style={{ color: '#9CA3AF' }}>
          <MapPin size={12} /> {zimmer.location || 'מיקום לא צוין'}
        </p>
        <div className="flex gap-3 text-xs" style={{ color: '#9CA3AF' }}>
          {zimmer.num_rooms ? <span className="inline-flex items-center gap-1"><BedDouble size={12} /> {zimmer.num_rooms} חדרים</span> : null}
          {zimmer.max_guests ? <span className="inline-flex items-center gap-1"><Users size={12} /> עד {zimmer.max_guests}</span> : null}
        </div>
      </div>
    </div>
  );
}