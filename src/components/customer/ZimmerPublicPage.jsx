import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Image } from '@/components/ui/image';
import {
  ArrowRight, MapPin, Bath, BedDouble, Users, UtensilsCrossed, Waves,
  Star, Calendar, MessageCircle, MessageSquare, Check, Wifi, Car, Mountain, Bath as Tub, ChefHat,
} from 'lucide-react';
import ReviewsSection from '@/components/reviews/ReviewsSection';
import InfoSummarySection from '@/components/admin/InfoSummarySection';
import RoomsSummary from '@/components/chat/RoomsSummary';
import PolicySection from '@/components/chat/PolicySection';
import NearbyLandmarks from '@/components/chat/NearbyLandmarks';
import ZimmerMapView from '@/components/admin/ZimmerMapView';
import ZimmerPageSidebar from '@/components/customer/ZimmerPageSidebar';
import BookingForm from '@/components/chat/BookingForm';
import { normalizePhoneE164, whatsappLink, matchTag } from '@/lib/rooms';
import { formatILS } from '@/lib/bookingPrice';
import { getBookedZimmerIds } from '@/components/chat/DateSearchWidget';

// Pick an amenity icon by keyword (best-effort), fallback check.
function amenityIcon(label) {
  const t = (label || '').toLowerCase();
  if (/wi-?fi|אינטרנט|ווי.?פי|אלחוטי/.test(t)) return Wifi;
  if (/חני|parking/.test(t)) return Car;
  if (/נוף|mountain|הרים|עמק/.test(t)) return Mountain;
  if (/בריכה|pool/.test(t)) return Waves;
  if (/ג׳קוזי|ג'קוזי|jacuzzi|hot.?tub/.test(t)) return Tub;
  if (/מטבח|kitchen/.test(t)) return ChefHat;
  return Check;
}

export default function ZimmerPublicPage({ zimmer, user, onBack, searchDates, preview = false }) {
  const [reviewStats, setReviewStats] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const images = zimmer.images || [];
  const phoneE164 = normalizePhoneE164(zimmer.contact_phone);
  const match = matchTag(zimmer.max_guests);

  // Bathroom & bedroom counts for the details bar (mirror admin style).
  const bathroomCount = (zimmer.rooms_detail || []).filter(r => r.has_bathroom).length + (zimmer.additional_bathrooms_count || 0);
  const bedroomCount = (zimmer.rooms_detail || []).length || zimmer.num_rooms || 0;
  const hasKitchen = (zimmer.amenities || []).some(a => /מטבח/.test(a));
  const hasPool = (zimmer.amenities || []).some(a => /בריכה/.test(a));

  const weekdayPrice = zimmer.weekday_price ?? zimmer.price_per_night;
  const weekendPrice = zimmer.weekend_price ?? zimmer.price_per_night;

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
      } catch { if (active) setReviewStats({ count: 0, avg: 0 }); }
    })();
    return () => { active = false; };
  }, [zimmer.id]);

  const handleBookingSubmit = async (data, z) => {
    setBookingError('');
    try {
      const bookedIds = await getBookedZimmerIds(api, data.check_in, data.check_out);
      if (bookedIds.includes(z.id)) { setBookingError('הצימר כבר תפוס בתאריכים שבחרת. נסה תאריכים אחרים.'); return; }
      await api.entities.BookingRequest.create({
        zimmer_id: z.id, zimmer_name: z.name, owner_id: z.owner_id,
        ...data, status: 'ממתינה',
      });
      setBookingDone(true);
    } catch {
      setBookingError('מצטער, לא הצלחנו לשמור את הבקשה. נסה שוב.');
    }
  };

  const prefillDates = searchDates && (searchDates.checkIn || searchDates.start)
    ? { checkIn: searchDates.checkIn || searchDates.start, checkOut: searchDates.checkOut || searchDates.end, num_adults: searchDates.numGuests || 2, num_children: 0 }
    : null;

  const details = [
    bathroomCount > 0 ? { icon: Bath, label: `${bathroomCount} חדר רחצה` } : null,
    bedroomCount > 0 ? { icon: BedDouble, label: `${bedroomCount} חדרי שינה` } : null,
    zimmer.max_guests ? { icon: Users, label: `עד ${zimmer.max_guests} אורחים` } : null,
    hasKitchen ? { icon: UtensilsCrossed, label: 'מטבח מאובזר' } : null,
    hasPool ? { icon: Waves, label: 'בריכה פרטית' } : null,
  ].filter(Boolean);

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif', color: '#212121' }}>
      {/* Back */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white" style={{ background: '#fff', border: '1.5px solid #E0E0E0', color: '#757575' }}>
          <ArrowRight size={17} />
        </button>
        <span className="text-sm" style={{ color: '#9e9e9e' }}>חזרה לכל הצימרים</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content — clean white-card layout */}
        <main className="flex-1 min-w-0 space-y-6">

          {/* Header */}
          <section className="bg-white rounded-2xl p-6 sm:p-8" style={{ border: '1px solid #E0E0E0' }}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-[28px] font-bold leading-tight" style={{ color: '#212121' }}>{zimmer.name}</h1>
                {zimmer.location && (
                  <p className="text-sm flex items-center gap-1.5 mt-2" style={{ color: '#757575' }}>
                    <MapPin size={14} />{zimmer.location}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {match && <Pill muted>~ {match}</Pill>}
                  {reviewStats && reviewStats.count > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: '#FFF8E1' }}>
                      <Star size={13} fill="#F59E0B" style={{ color: '#F59E0B' }} />
                      <span className="font-bold text-xs" style={{ color: '#92400E' }}>{reviewStats.avg.toFixed(1)}</span>
                      <span className="text-xs" style={{ color: '#92400E' }}>({reviewStats.count})</span>
                    </span>
                  )}
                </div>
              </div>
              {(weekdayPrice != null || weekendPrice != null) && (
                <div className="flex items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0.5">
                  <div className="flex items-baseline gap-2">
                    {weekdayPrice != null && <span className="text-xl font-bold" style={{ color: '#212121' }}>{formatILS(weekdayPrice)}</span>}
                    {weekendPrice != null && weekendPrice !== weekdayPrice && <span className="text-xl font-bold" style={{ color: '#9e9e9e' }}>· {formatILS(weekendPrice)}</span>}
                  </div>
                  <span className="text-xs" style={{ color: '#9e9e9e' }}>מחיר רגיל / סוף שבוע</span>
                </div>
              )}
            </div>
          </section>

          {/* Gallery — large image right, two stacked left (RTL aware) */}
          {images.length > 0 && (
            <section className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E0E0E0' }}>
              <div className="grid grid-cols-2 grid-rows-2 gap-1 h-80 sm:h-[420px]">
                {/* Large image — spans both rows, appears on the right in RTL */}
                <div className="row-span-2">
                  <Image src={images[0]} alt={zimmer.name} className="w-full h-full" fittingType="fill" />
                </div>
                {images[1] && (
                  <div><Image src={images[1]} alt="" className="w-full h-full" fittingType="fill" /></div>
                )}
                {images[2] ? (
                  <div><Image src={images[2]} alt="" className="w-full h-full" fittingType="fill" /></div>
                ) : (
                  <div style={{ background: '#F5F5F5' }} />
                )}
              </div>
              {images.length > 3 && (
                <div className="px-4 pt-3 pb-1 flex gap-1.5 overflow-x-auto">
                  {images.slice(3).map((img, i) => (
                    <div key={i} className="h-14 w-20 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid #E0E0E0' }}>
                      <Image src={img} alt="" className="w-full h-full" fittingType="fill" />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Details bar */}
          {details.length > 0 && (
            <section className="bg-white rounded-2xl px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-3" style={{ border: '1px solid #E0E0E0' }}>
              {details.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <d.icon size={18} style={{ color: '#424242' }} />
                  <span className="text-sm font-medium" style={{ color: '#212121' }}>{d.label}</span>
                </div>
              ))}
            </section>
          )}

          {/* About */}
          {zimmer.description && (
            <section className="bg-white rounded-2xl p-6 sm:p-8" style={{ border: '1px solid #E0E0E0' }}>
              <h2 className="text-lg font-bold mb-3" style={{ color: '#212121' }}>על בקתת האירוח</h2>
              <p className="text-sm leading-7 whitespace-pre-wrap" style={{ color: '#555555' }}>{zimmer.description}</p>
            </section>
          )}

          {/* Amenities */}
          {(zimmer.amenities || []).length > 0 && (
            <section className="bg-white rounded-2xl p-6 sm:p-8" style={{ border: '1px solid #E0E0E0' }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: '#212121' }}>מה המקום מציע</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(zimmer.amenities || []).map((a, i) => {
                  const Icon = amenityIcon(a);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#F5F5F5' }}>
                        {Icon === Check ? <Check size={14} style={{ color: '#212121' }} /> : <Icon size={14} style={{ color: '#424242' }} />}
                      </div>
                      <span className="text-sm" style={{ color: '#424242' }}>{a}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Location (own card — heading/map handled by ZimmerMapView) */}
          <ZimmerMapView zimmer={zimmer} editable={false} />

          {/* Additional details (clean, same card style) */}
          <RoomsSummary zimmer={zimmer} />
          <PolicySection zimmer={zimmer} />
          <NearbyLandmarks landmarks={zimmer.nearby_landmarks} />
          <InfoSummarySection zimmer={zimmer} />
          <ReviewsSection zimmerId={zimmer.id} />

          {/* Mobile action buttons */}
          {!preview && (
          <div className="flex flex-col gap-2 pt-1 lg:hidden">
            <button onClick={() => setBookingOpen(true)} className="w-full text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: '#0B3838' }}>
              <Calendar size={16} /> הזמן עכשיו
            </button>
            <button onClick={() => setChatOpen(true)} className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C', border: '1.5px solid rgba(249,115,22,0.2)' }}>
              <MessageSquare size={16} /> שאל שאלה / צ'אט
            </button>
            {phoneE164 && (
              <a href={whatsappLink(phoneE164, `שלום, יש לי שאלה לגבי "${zimmer.name}"`)} target="_blank" rel="noopener noreferrer"
                className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: '#25D366', color: '#fff' }}>
                <MessageCircle size={16} /> וואטסאפ
              </a>
            )}
          </div>
          )}
        </main>

        {/* Desktop sidebar */}
        {!preview && (
        <aside className="hidden lg:block w-[360px] flex-shrink-0">
          <div className="sticky top-6 self-start" style={{ height: 'calc(100vh - 7rem)' }}>
            <div className="h-full rounded-2xl overflow-hidden flex flex-col" style={{ border: '1px solid #E0E0E0' }}>
              <ZimmerPageSidebar zimmer={zimmer} user={user} onBook={() => setBookingOpen(true)} />
            </div>
          </div>
        </aside>
        )}
      </div>

      {/* Mobile floating chat button */}
      {!preview && (
      <button onClick={() => setChatOpen(true)}
        className="lg:hidden fixed bottom-24 left-4 z-30 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl"
        style={{ background: '#0B3838' }}>
        <MessageSquare size={22} />
      </button>
      )}

      {/* Mobile chat overlay */}
      {chatOpen && !preview && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setChatOpen(false)} />
          <div className="absolute inset-0 overflow-hidden" onClick={e => e.stopPropagation()}>
            <ZimmerPageSidebar zimmer={zimmer} user={user} onBook={() => { setChatOpen(false); setBookingOpen(true); }} onClose={() => setChatOpen(false)} />
          </div>
        </div>
      )}

      {/* Booking modal */}
      {bookingOpen && !preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => { setBookingOpen(false); setBookingDone(false); setBookingError(''); }}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {bookingDone ? (
              <div className="bg-white rounded-2xl p-6 text-center" dir="rtl">
                <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3" style={{ background: 'rgba(34,197,94,0.12)' }}>
                  <Check size={24} style={{ color: '#16A34A' }} />
                </div>
                <h3 className="font-black text-lg mb-1" style={{ color: '#1A1A1A' }}>הבקשה התקבלה! 🎉</h3>
                <p className="text-sm mb-4" style={{ color: '#6B7280' }}>בעל הצימר יצור איתך קשר בקרוב לאישור ההזמנה.</p>
                <button onClick={() => { setBookingOpen(false); setBookingDone(false); setBookingError(''); }}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white" style={{ background: '#0B3838' }}>סגור</button>
              </div>
            ) : (
              <>
                {bookingError && (
                  <div className="mb-2 text-sm text-center text-white rounded-xl px-3 py-2" style={{ background: '#EF4444' }}>{bookingError}</div>
                )}
                <BookingForm zimmer={zimmer} onSubmit={handleBookingSubmit} prefillDates={prefillDates} onClose={() => { setBookingOpen(false); setBookingError(''); }} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ children, muted }) {
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={muted ? { background: '#F5F5F5', color: '#757575' } : { background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}>{children}</span>;
}