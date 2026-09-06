import React, { useState } from 'react';
import { Image } from '@/components/ui/image';
import { ChevronLeft, ChevronRight, Users, BedDouble, MapPin, Bath } from 'lucide-react';
import { zimmerPriceSummary, formatILS } from '@/lib/bookingPrice';
import { totalBeds, bathroomsCount } from '@/lib/rooms';

export default function ZimmerCard({ zimmer, onClick, searchDates }) {
  const [imgIndex, setImgIndex] = useState(0);
  const images = zimmer.images || [];
  const rooms = zimmer.rooms_detail;
  const beds = totalBeds(rooms);
  const baths = bathroomsCount(rooms, zimmer.additional_bathrooms_count);

  const prev = (e) => { e.stopPropagation(); setImgIndex(i => (i - 1 + images.length) % images.length); };
  const next = (e) => { e.stopPropagation(); setImgIndex(i => (i + 1) % images.length); };

  // Partial (per-person) price vs regular full price, based on the active search
  let priceInfo = null;
  if (searchDates && searchDates.checkIn && searchDates.checkOut) {
    const numAdults = searchDates.num_adults || 0;
    const numChildren = searchDates.num_children || 0;
    const full = zimmerPriceSummary(zimmer, searchDates.checkIn, searchDates.checkOut, 0, 0);
    const yours = zimmerPriceSummary(zimmer, searchDates.checkIn, searchDates.checkOut, numAdults, numChildren);
    if (yours.isPartial && yours.avg < full.avg) {
      priceInfo = { regularAvg: full.avg, yourAvg: yours.avg };
    }
  }

  return (
    <div
      onClick={() => onClick?.(zimmer)}
      className={`snap-start flex-shrink-0 w-64 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
    >
      {/* Image + price badge */}
      <div className="relative h-40 bg-gray-100">
        {images.length > 0 ? (
          <>
            <Image src={images[imgIndex]} alt={zimmer.name} className="w-full h-full object-cover" fittingType="fill" />
            {images.length > 1 && (
              <>
                <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60">
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIndex ? 'bg-white' : 'bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">🏠</div>
        )}
        {/* Price badge — weekend price preferred (per spec default), then base */}
        <div className="absolute top-2 right-2 rounded-full px-2.5 py-1" style={{ background: '#0B3838' }}>
          {priceInfo ? (
            <div className="flex flex-col items-center leading-tight text-white">
              <span className="text-[10px] line-through opacity-70">{formatILS(priceInfo.regularAvg)}</span>
              <span className="text-xs font-bold">{formatILS(priceInfo.yourAvg)}/לילה</span>
            </div>
          ) : (
            <span className="text-white text-xs font-bold">
              {(zimmer.weekend_price || zimmer.weekday_price || zimmer.price_per_night)
                ? `₪${zimmer.weekend_price || zimmer.weekday_price || zimmer.price_per_night}/לילה`
                : 'מחיר לפי פנייה'}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 text-right" dir="rtl">
        <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">{zimmer.name}</h3>
        {zimmer.location && (
          <div className="flex items-center gap-1 text-gray-500 text-xs mb-2 flex-row-reverse justify-end">
            <span className="truncate">{zimmer.location}</span>
            <MapPin size={12} style={{ color: '#0B3838' }} />
          </div>
        )}
        {/* Stats row: rooms · beds (only if detailed) · baths (if any) · max guests */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-gray-700">
          {zimmer.num_rooms != null && (
            <div className="flex items-center gap-1 flex-row-reverse">
              <span>{zimmer.num_rooms} חדרים</span>
              <BedDouble size={12} style={{ color: '#0B3838' }} />
            </div>
          )}
          {beds != null && (
            <div className="flex items-center gap-1 flex-row-reverse">
              <span>{beds} מיטות</span>
              <BedDouble size={12} style={{ color: '#0B3838' }} />
            </div>
          )}
          {baths > 0 && (
            <div className="flex items-center gap-1 flex-row-reverse">
              <span>{baths} רחצה</span>
              <Bath size={12} style={{ color: '#0B3838' }} />
            </div>
          )}
          {zimmer.max_guests != null && (
            <div className="flex items-center gap-1 flex-row-reverse">
              <span>עד {zimmer.max_guests} לשינה</span>
              <Users size={12} style={{ color: '#0B3838' }} />
            </div>
          )}
          {zimmer.max_guests_event != null && zimmer.max_guests_event > 0 && (
            <div className="flex items-center gap-1 flex-row-reverse">
              <span>עד {zimmer.max_guests_event} לאירוע</span>
              <Users size={12} style={{ color: '#F97316' }} />
            </div>
          )}
        </div>
        {/* Short teaser — line-clamp to ~1 line so it never looks broken */}
        {zimmer.description && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-1 leading-snug">{zimmer.description}</p>
        )}
      </div>
    </div>
  );
}