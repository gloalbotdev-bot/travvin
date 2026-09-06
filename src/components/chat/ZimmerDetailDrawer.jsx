import React, { useState, useEffect } from 'react';
import { Image } from '@/components/ui/image';
import { api } from '@/api/client';
import { X, ChevronLeft, ChevronRight, Users, BedDouble, MapPin, Calendar, Bath, Star, MessageCircle, Maximize2 } from 'lucide-react';
import ReviewsSection from '@/components/reviews/ReviewsSection';
import MiniAvailabilityCalendar from '@/components/chat/MiniAvailabilityCalendar';
import DescriptionCardsSection from '@/components/chat/DescriptionCardsSection';
import AmenitiesGroups from '@/components/chat/AmenitiesGroups';
import ZimmerHostCard from '@/components/chat/ZimmerHostCard';
import RoomsSummary from '@/components/chat/RoomsSummary';
import PolicySection from '@/components/chat/PolicySection';
import NearbyLandmarks from '@/components/chat/NearbyLandmarks';
import { zimmerPriceSummary, formatILS } from '@/lib/bookingPrice';
import { totalBeds, bathroomsCount, normalizePhoneE164, whatsappLink, matchTag } from '@/lib/rooms';

export default function ZimmerDetailDrawer({ zimmer, onClose, onBook, onAsk, onDirectChat, searchDates }) {
  const [imgIndex, setImgIndex] = useState(0);
  const images = zimmer.images || [];
  const rooms = zimmer.rooms_detail;
  const beds = totalBeds(rooms);
  const baths = bathroomsCount(rooms, zimmer.additional_bathrooms_count);
  const phoneE164 = normalizePhoneE164(zimmer.contact_phone);
  const match = matchTag(zimmer.max_guests);

  const [reviewStats, setReviewStats] = useState(null);
  const [showFullCal, setShowFullCal] = useState(false);

  const prev = (e) => { e.stopPropagation(); setImgIndex(i => (i - 1 + images.length) % images.length); };
  const next = (e) => { e.stopPropagation(); setImgIndex(i => (i + 1) % images.length); };

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

  useEffect(() => {
    if (!zimmer.id) return;
    let active = true;
    (async () => {
      try {
        const data = await api.entities.Review.filter({ zimmer_id: zimmer.id, status: 'published' }, '-published_at', 50);
        if (!active) return;
        const list = data || [];
        const count = list.length;
        const avg = count ? list.reduce((a, r) => a + (r.rating || 0), 0) / count : 0;
        setReviewStats({ count, avg });
      } catch { setReviewStats({ count: 0, avg: 0 }); }
    })();
    return () => { active = false; };
  }, [zimmer.id]);

  // Thumbnails (only when ≥5 images): pick 4 representative frames + generic labels.
  const thumbs = images.length >= 5
    ? [0, Math.floor(images.length / 3), Math.floor((images.length * 2) / 3), images.length - 1]
    : [];
  const thumbLabels = ['חדרים', 'חדרים', 'בריכה/חוץ', 'נוף'];

  const weekdayPrice = zimmer.weekday_price ?? zimmer.price_per_night;
  const weekendPrice = zimmer.weekend_price ?? zimmer.price_per_night;

  return (
    <div className="fixed inset-0 flex items-end sm:items-center sm:justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 9999 }} dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()} style={{ fontFamily: 'Heebo, sans-serif' }}>
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-3 sm:px-5 py-3" style={{ background: '#0B3838' }}>
          <h2 className="font-black text-sm sm:text-base truncate text-white">{zimmer.name}</h2>
          <button onClick={onClose} className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', width: 40, height: 40, minHeight: 40 }}>
            <X size={18} />
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
                  <span className="text-white text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#0B3838' }}>{formatILS(priceInfo.yourAvg)}/לילה</span>
                  <span className="bg-black/50 text-white text-[10px] font-medium px-2 py-0.5 rounded-full line-through">{formatILS(priceInfo.regularAvg)}/לילה</span>
                </div>
              ) : (
                <div className="absolute top-3 right-3 text-white text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#0B3838' }}>
                  ₪{zimmer.price_per_night}/לילה
                </div>
              )
            )}
          </div>
        )}

        {/* Thumbnails strip (only when ≥5 images) */}
        {thumbs.length > 0 && (
          <div className="px-5 pt-3">
            <div className="flex justify-between text-[10px] mb-1" style={{ color: '#9CA3AF' }}>
              {thumbLabels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {thumbs.map((ti, i) => (
                <button key={i} onClick={() => setImgIndex(ti)} className="relative h-14 rounded-lg overflow-hidden" style={{ border: imgIndex === ti ? '2px solid #0B3838' : '1px solid #F0EEE8' }}>
                  <Image src={images[ti]} alt="" className="w-full h-full" fittingType="fill" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Title-row tags: size, rooms, beds, baths, match estimate */}
          <div className="flex flex-wrap gap-1.5">
            {zimmer.size_sqm != null && <Tag>{zimmer.size_sqm} מ״ר</Tag>}
            {zimmer.num_rooms != null && <Tag>{zimmer.num_rooms} סוויטות</Tag>}
            {beds != null && <Tag>{beds} מיטות</Tag>}
            {baths > 0 && <Tag>{baths} רחצה</Tag>}
            {match && <Tag muted>~ {match}</Tag>}
          </div>

          {/* Reviews tag — average + count */}
          {reviewStats && reviewStats.count > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: '#FFFF00' }}>
              <Star size={14} fill="#0B3838" style={{ color: '#0B3838' }} />
              <span className="font-black text-sm" style={{ color: '#0B3838' }}>{reviewStats.avg.toFixed(1)}</span>
              <span className="text-xs font-medium" style={{ color: '#0B3838' }}>({reviewStats.count} ביקורות)</span>
            </div>
          )}

          {/* Partial pricing banner */}
          {priceInfo && (
            <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: 'rgba(11,56,56,0.06)', border: '1px solid rgba(11,56,56,0.2)' }}>
              <div className="flex-1">
                <p className="text-xs font-bold" style={{ color: '#0B3838' }}>תמחור חלקי לפי אדם 🎉</p>
                <p className="text-xs mt-0.5" style={{ color: '#4B5563' }}>
                  {priceInfo.nights} לילות: סה"כ {formatILS(priceInfo.yourTotal)} במקום {formatILS(priceInfo.regularAvg * priceInfo.nights)}
                </p>
              </div>
            </div>
          )}

          {/* Location */}
          {zimmer.location && (
            <div className="flex items-center gap-1.5 text-sm" style={{ color: '#4B5563' }}>
              <MapPin size={14} style={{ color: '#0B3838' }} />
              <span>{zimmer.location}</span>
            </div>
          )}

          {/* Capacity stat boxes — sleeping vs event when both present, else single */}
          <div className={`grid ${zimmer.max_guests_event ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
            {beds != null && <Stat icon={BedDouble} label="מיטות" value={beds} />}
            {zimmer.max_guests != null && <Stat icon={Users} label="אורחים לשינה" value={zimmer.max_guests} accent />}
            {zimmer.max_guests_event != null && zimmer.max_guests_event > 0 ? (
              <Stat icon={Users} label="אורחים לאירוע" value={zimmer.max_guests_event} accentOrange />
            ) : (baths > 0 && <Stat icon={Bath} label="חדרי רחצה" value={baths} />)}
          </div>

          {/* Pricing cards — weekday/weekend + extras */}
          {(weekdayPrice || weekendPrice || zimmer.extra_guest_fee != null || zimmer.breakfast_fee != null) && (
            <div className="grid grid-cols-2 gap-2">
              {weekdayPrice != null && <PriceBox label="אמצ״ש (א׳-ה׳)" value={formatILS(weekdayPrice)} />}
              {weekendPrice != null && <PriceBox label="סופ״ש (ה׳-ש׳)" value={formatILS(weekendPrice)} accent />}
              {zimmer.extra_guest_fee != null && zimmer.extra_guest_fee > 0 && <PriceBox label="תוספת אורח" value={`${formatILS(zimmer.extra_guest_fee)}/לילה`} small />}
              {zimmer.breakfast_fee != null && zimmer.breakfast_fee > 0 && <PriceBox label="ארוחת בוקר" value={`${formatILS(zimmer.breakfast_fee)}/אורח`} small />}
            </div>
          )}

          {/* Description (AI-split cards) */}
          <DescriptionCardsSection zimmer={zimmer} />

          {/* Rooms breakdown + computed summary */}
          <RoomsSummary zimmer={zimmer} />

          {/* Amenities (3 groups) */}
          <AmenitiesGroups amenities={zimmer.amenities} />

          {/* Host card */}
          <ZimmerHostCard zimmer={zimmer} />

          {/* Policy */}
          <PolicySection zimmer={zimmer} />

          {/* Nearby landmarks */}
          <NearbyLandmarks landmarks={zimmer.nearby_landmarks} />

          <ReviewsSection zimmerId={zimmer.id} />

          {/* Mini availability calendar — only if owner opted to expose */}
          {zimmer.expose_availability_calendar && (
            <div className="space-y-2">
              <MiniAvailabilityCalendar zimmerId={zimmer.id} weeks={showFullCal ? 12 : 6} />
              <button onClick={() => setShowFullCal(v => !v)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#0B3838' }}>
                <Maximize2 size={12} /> {showFullCal ? 'הצג פחות' : 'להצגת יומן מלא'}
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {onBook && (
              <button onClick={() => onBook(zimmer)} className="w-full text-white py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90" style={{ background: '#0B3838' }}>
                📅 הזמן עכשיו
              </button>
            )}
            <div className="flex gap-2">
              {phoneE164 && (
                <a href={whatsappLink(phoneE164, `שלום, יש לי שאלה לגבי "${zimmer.name}"`)} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-1.5" style={{ background: '#25D366', color: '#fff' }}>
                  <MessageCircle size={15} /> וואטסאפ
                </a>
              )}
              {onAsk && (
                <button onClick={() => onAsk(zimmer)} className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90" style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838', border: '1.5px solid rgba(11,56,56,0.2)' }}>
                  💬 שאל שאלה
                </button>
              )}
              {onDirectChat && (
                <button onClick={() => onDirectChat(zimmer)} className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90" style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C', border: '1.5px solid rgba(249,115,22,0.2)' }}>
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

function Tag({ children, muted }) {
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={muted ? { background: 'rgba(11,56,56,0.06)', color: '#6B7280' } : { background: 'rgba(11,56,56,0.1)', color: '#0B3838' }}>{children}</span>
  );
}

function Stat({ icon: Icon, label, value, accent, accentOrange }) {
  const color = accentOrange ? '#F97316' : accent ? '#0B3838' : '#0B3838';
  const bg = accentOrange
    ? { background: 'rgba(249,115,22,0.07)', border: '1.5px solid rgba(249,115,22,0.25)' }
    : accent
      ? { background: 'rgba(11,56,56,0.06)', border: '1.5px solid rgba(11,56,56,0.2)' }
      : { background: '#F8F7F4', border: '1px solid #F0EEE8' };
  return (
    <div className="rounded-xl p-3 text-center" style={bg}>
      <Icon size={16} className="mx-auto mb-1" style={{ color }} />
      <div className="text-sm font-black" style={{ color: '#1A1A1A' }}>{value}</div>
      <div className="text-xs" style={{ color: '#9CA3AF' }}>{label}</div>
    </div>
  );
}

function PriceBox({ label, value, accent, small }) {
  return (
    <div className="rounded-xl p-3" style={{ background: accent ? 'rgba(11,56,56,0.06)' : '#F8F7F4', border: accent ? '1.5px solid rgba(11,56,56,0.2)' : '1px solid #F0EEE8' }}>
      <p className="text-[10px] mb-0.5" style={{ color: '#9CA3AF' }}>{label}</p>
      <p className={`font-black ${small ? 'text-xs' : 'text-sm'}`} style={{ color: '#0B3838' }}>{value}</p>
    </div>
  );
}