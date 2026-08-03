import React, { useState } from 'react';
import { Image } from '@/components/ui/image';
import { ChevronLeft, ChevronRight, Users, BedDouble, MapPin, DollarSign, Info } from 'lucide-react';
import { zimmerPriceSummary, formatILS } from '@/lib/bookingPrice';

export default function ZimmerCard({ zimmer, onClick, searchDates }) {
  const [imgIndex, setImgIndex] = useState(0);
  const images = zimmer.images || [];

  const prev = (e) => {
    e.stopPropagation();
    setImgIndex(i => (i - 1 + images.length) % images.length);
  };
  const next = (e) => {
    e.stopPropagation();
    setImgIndex(i => (i + 1) % images.length);
  };

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
      {/* Image */}
      <div className="relative h-40 bg-gray-100">
        {images.length > 0 ? (
          <>
            <Image
              src={images[imgIndex]}
              alt={zimmer.name}
              className="w-full h-full object-cover"
              fittingType="fill"
            />
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
        <div className="absolute top-2 right-2 rounded-full px-2.5 py-1" style={{ background: priceInfo ? '#25D366' : '#1A1A1A' }}>
          {priceInfo ? (
            <div className="flex flex-col items-center leading-tight text-white">
              <span className="text-[10px] line-through opacity-70">{formatILS(priceInfo.regularAvg)}</span>
              <span className="text-xs font-bold">{formatILS(priceInfo.yourAvg)}/לילה</span>
            </div>
          ) : (
            <span className="text-white text-xs font-bold">{zimmer.price_per_night ? `₪${zimmer.price_per_night}/לילה` : 'מחיר לפי פנייה'}</span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 text-right" dir="rtl">
        <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">{zimmer.name}</h3>
        {zimmer.location && (
          <div className="flex items-center gap-1 text-gray-500 text-xs mb-2 flex-row-reverse justify-end">
            <span>{zimmer.location}</span>
            <MapPin size={12} />
          </div>
        )}
        <div className="flex gap-3 text-xs text-gray-600">
          {zimmer.num_rooms && (
            <div className="flex items-center gap-1 flex-row-reverse">
              <span>{zimmer.num_rooms} חדרים</span>
              <BedDouble size={12} />
            </div>
          )}
          {zimmer.max_guests && (
            <div className="flex items-center gap-1 flex-row-reverse">
              <span>עד {zimmer.max_guests}</span>
              <Users size={12} />
            </div>
          )}
        </div>
        {zimmer.description && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{zimmer.description}</p>
        )}
        {onClick && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-center gap-1 text-xs font-semibold text-[#F97316]">
            <Info size={12} /> לחץ לפרטים מלאים
          </div>
        )}
      </div>
    </div>
  );
}