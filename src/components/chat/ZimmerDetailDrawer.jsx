import React, { useState } from 'react';
import { Image } from '@/components/ui/image';
import { X, ChevronLeft, ChevronRight, Users, BedDouble, MapPin, Calendar } from 'lucide-react';
import InfoSummarySection from '@/components/admin/InfoSummarySection';
import ReviewsSection from '@/components/reviews/ReviewsSection';
import { zimmerPriceSummary, formatILS } from '@/lib/bookingPrice';

export default function ZimmerDetailDrawer({ zimmer, onClose, onBook, onAsk, onDirectChat, searchDates }) {
  const [imgIndex, setImgIndex] = useState(0);
  const images = zimmer.images || [];

  const prev = (e) => { e.stopPropagation(); setImgIndex(i => (i - 1 + images.length) % images.length); };
  const next = (e) => { e.stopPropagation(); setImgIndex(i => (i + 1) % images.length); };

  // Compute partial vs regular price when the customer searched with specific dates/guests
  let priceInfo = null;
  if (searchDates && searchDates.checkIn && searchDates.checkOut) {
    const numAdults = searchDates.num_adults || 0;
    const numChildren = searchDates.num_children || 0;
    const full = zimmerPriceSummary(zimmer, searchDates.checkIn, searchDates.checkOut, 0, 0);
    const yours = zimmerPriceSummary(zimmer, searchDates.checkIn, searchDates.checkOut, numAdults, numChildren);
    if (yours.isPartial && yours.avg < full.avg) {
      priceInfo = { regularAvg: full.avg, yourAvg: yours.avg, nights: yours.nights, yourTotal: yours.total };
    }
  }

  return (
    <div className="fixed inset-0 flex items-end sm:items-center sm:justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 9999 }} dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()} style={{ fontFamily: 'Heebo, sans-serif' }}>
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid #F0EEE8' }}>
          <h2 className="font-black text-base truncate" style={{ color: '#1A1A1A' }}>{zimmer.name}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#F8F7F4', color: '#6B7280' }}>
            <X size={16} />
          </button>
        </div>

        {/* Image gallery */}
        {images.length > 0 && (
          <div className="relative h-56 bg-gray-100" onClick={(e) => e.stopPropagation()}>
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
              priceInfo ? (
                <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                  <span className="bg-[#25D366] text-white text-xs font-bold px-2.5 py-1 rounded-full">{formatILS(priceInfo.yourAvg)}/לילה</span>
                  <span className="bg-black/50 text-white text-[10px] font-medium px-2 py-0.5 rounded-full line-through">{formatILS(priceInfo.regularAvg)}/לילה</span>
                </div>
              ) : (
                <div className="absolute top-3 right-3 bg-[#25D366] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  ₪{zimmer.price_per_night}/לילה
                </div>
              )
            )}
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Title row if no images */}
          {images.length === 0 && zimmer.price_per_night && (
            priceInfo ? (
              <div className="flex items-center gap-2">
                <span className="inline-block bg-[#25D366]/10 text-[#16A34A] text-sm font-bold px-3 py-1.5 rounded-full">{formatILS(priceInfo.yourAvg)}/לילה</span>
                <span className="text-sm font-medium line-through" style={{ color: '#9CA3AF' }}>{formatILS(priceInfo.regularAvg)}/לילה</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,211,102,0.12)', color: '#16A34A' }}>תמחור חלקי</span>
              </div>
            ) : (
              <div className="inline-block bg-[#25D366]/10 text-[#16A34A] text-sm font-bold px-3 py-1.5 rounded-full">₪{zimmer.price_per_night}/לילה</div>
            )
          )}

          {/* Partial pricing banner */}
          {priceInfo && (
            <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)' }}>
              <div className="flex-1">
                <p className="text-xs font-bold" style={{ color: '#16A34A' }}>תמחור חלקי לפי אדם 🎉</p>
                <p className="text-xs mt-0.5" style={{ color: '#4B5563' }}>
                  {priceInfo.nights} לילות: סה"כ {formatILS(priceInfo.yourTotal)} במקום {formatILS(priceInfo.regularAvg * priceInfo.nights)}
                </p>
              </div>
            </div>
          )}

          {/* Location */}
          {zimmer.location && (
            <div className="flex items-center gap-1.5 text-sm" style={{ color: '#4B5563' }}>
              <MapPin size={14} style={{ color: '#F97316' }} />
              <span>{zimmer.location}</span>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {zimmer.num_rooms != null && (
              <Stat icon={BedDouble} label="חדרים" value={zimmer.num_rooms} />
            )}
            {zimmer.max_guests != null && (
              <Stat icon={Users} label="אורחים מקס." value={zimmer.max_guests} />
            )}
            {zimmer.price_per_night != null && (
              <Stat icon={Calendar} label={priceInfo ? 'ללילה (שלך)' : 'ללילה'} value={priceInfo ? formatILS(priceInfo.yourAvg) : `₪${zimmer.price_per_night}`} />
            )}
          </div>

          {/* Description */}
          {zimmer.description && (
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: '#F97316' }}>תיאור</h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#4B5563' }}>{zimmer.description}</p>
            </div>
          )}

          {/* Info summary — identical to what the owner sees */}
          <div className="mb-1">
            <InfoSummarySection zimmer={zimmer} />
          </div>

          <ReviewsSection zimmerId={zimmer.id} />

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {onBook && (
              <button
                onClick={() => onBook(zimmer)}
                className="w-full text-white py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90"
                style={{ background: '#25D366' }}
              >
                📅 הזמן עכשיו
              </button>
            )}
            <div className="flex gap-2">
              {onAsk && (
                <button
                  onClick={() => onAsk(zimmer)}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90"
                  style={{ background: 'rgba(7,94,84,0.08)', color: '#075E54', border: '1.5px solid rgba(7,94,84,0.2)' }}
                >
                  💬 שאל שאלה
                </button>
              )}
              {onDirectChat && (
                <button
                  onClick={() => onDirectChat(zimmer)}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90"
                  style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C', border: '1.5px solid rgba(249,115,22,0.2)' }}
                >
                  📩 צ'אט ישיר
                </button>
              )}
            </div>
          </div>
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