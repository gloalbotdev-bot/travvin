import React, { useState } from 'react';
import { Image } from '@/components/ui/image';
import { ChevronLeft, ChevronRight, Users, BedDouble, MapPin, Calendar } from 'lucide-react';
import InfoSummarySection from '@/components/admin/InfoSummarySection';
import ReviewsSection from '@/components/reviews/ReviewsSection';

export default function ZimmerDetailInline({ zimmer, onBack, onBook }) {
  const [imgIndex, setImgIndex] = useState(0);
  const images = zimmer.images || [];

  const prev = (e) => { e.stopPropagation(); setImgIndex(i => (i - 1 + images.length) % images.length); };
  const next = (e) => { e.stopPropagation(); setImgIndex(i => (i + 1) % images.length); };

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      {/* Header with back */}
      <div className="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 bg-white/95 backdrop-blur border-b border-gray-100">
        <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-gray-100" style={{ background: '#F8F7F4', color: '#6B7280' }}>
          <ChevronRight size={18} />
        </button>
        <h2 className="font-black text-base truncate" style={{ color: '#1A1A1A' }}>{zimmer.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Image gallery */}
        {images.length > 0 && (
          <div className="relative h-52 bg-gray-100">
            <Image src={images[imgIndex]} alt={zimmer.name} className="w-full h-full" fittingType="fill" />
            {images.length > 1 && (
              <>
                <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60">
                  <ChevronRight size={18} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
                  {imgIndex + 1} / {images.length}
                </div>
              </>
            )}
            {zimmer.price_per_night && (
              <div className="absolute top-3 right-3 bg-[#25D366] text-white text-xs font-bold px-2.5 py-1 rounded-full">₪{zimmer.price_per_night}/לילה</div>
            )}
          </div>
        )}

        <div className="p-5 space-y-4">
          {images.length === 0 && zimmer.price_per_night && (
            <div className="inline-block bg-[#25D366]/10 text-[#16A34A] text-sm font-bold px-3 py-1.5 rounded-full">₪{zimmer.price_per_night}/לילה</div>
          )}

          {zimmer.location && (
            <div className="flex items-center gap-1.5 text-sm" style={{ color: '#4B5563' }}>
              <MapPin size={14} style={{ color: '#F97316' }} />
              <span>{zimmer.location}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {zimmer.num_rooms != null && <Stat icon={BedDouble} label="חדרים" value={zimmer.num_rooms} />}
            {zimmer.max_guests != null && <Stat icon={Users} label="אורחים מקס." value={zimmer.max_guests} />}
            {zimmer.price_per_night != null && <Stat icon={Calendar} label="ללילה" value={`₪${zimmer.price_per_night}`} />}
          </div>

          {zimmer.description && (
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: '#F97316' }}>תיאור</h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#4B5563' }}>{zimmer.description}</p>
            </div>
          )}

          <div className="mb-1">
            <InfoSummarySection zimmer={zimmer} />
          </div>

          <ReviewsSection zimmerId={zimmer.id} />

          {onBook && (
            <button
              onClick={() => onBook(zimmer)}
              className="w-full text-white py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90"
              style={{ background: '#25D366' }}
            >
              📅 הזמן עכשיו
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8' }}>
      <Icon size={16} className="mx-auto mb-1" style={{ color: '#F97316' }} />
      <div className="text-sm font-black" style={{ color: '#1A1A1A' }}>{value}</div>
      <div className="text-xs" style={{ color: '#9CA3AF' }}>{label}</div>
    </div>
  );
}