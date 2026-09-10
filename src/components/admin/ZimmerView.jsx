import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { X } from 'lucide-react';
import { Image } from '@/components/ui/image';
import ZimmerAiSidebar from '@/components/admin/ZimmerAiSidebar';
import ZimmerMapView from '@/components/admin/ZimmerMapView';
import ZimmerEditor from '@/components/admin/ZimmerEditor';
import ManualBookingForm from '@/components/owner/ManualBookingForm';
import BlockDateForm from '@/components/owner/BlockDateForm';
import CustomerPreviewModal from '@/components/admin/CustomerPreviewModal';

import iconBack from '@/assets/owner/properties/icon-back.svg';
import iconPin from '@/assets/owner/properties/icon-pin.svg';
import iconTag from '@/assets/owner/properties/icon-tag.svg';
import iconEye from '@/assets/owner/properties/icon-eye.svg';
import iconUsers from '@/assets/owner/properties/icon-users.svg';
import iconBed from '@/assets/owner/properties/icon-bed.svg';
import iconDroplet from '@/assets/owner/properties/icon-droplet.svg';
import iconMountain from '@/assets/owner/properties/icon-mountain.svg';
import iconPool from '@/assets/owner/properties/icon-pool.svg';
import iconWifi from '@/assets/owner/properties/icon-wifi.svg';
import iconCar from '@/assets/owner/properties/icon-car.svg';
import iconCooking from '@/assets/owner/properties/icon-cooking.svg';

/** Local calendar YYYY-MM-DD (not UTC — avoids off-by-one in Israel). */
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Night occupancy: check_in inclusive, check_out exclusive (same as OwnerCalendar). */
const coversDay = (checkIn, checkOut, day) => {
  if (!checkIn || !checkOut || !day) return false;
  const a = String(checkIn).slice(0, 10);
  const b = String(checkOut).slice(0, 10);
  const t = String(day).slice(0, 10);
  return a <= t && t < b;
};

const formatPrice = (n) => {
  if (n == null || n === '') return null;
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return `₪${num.toLocaleString('he-IL')}`;
};

function amenityIcon(label) {
  const t = String(label || '');
  if (/בריכ|ג['׳']קוזי|גקוזי|jacuzzi|pool/i.test(t)) return iconPool;
  if (/מטבח|בישול|cooking/i.test(t)) return iconCooking;
  if (/נוף|הר|עמק|mountain/i.test(t)) return iconMountain;
  if (/wifi|Wi-?Fi|אינטרנט|אלחוט/i.test(t)) return iconWifi;
  if (/חני/i.test(t)) return iconCar;
  if (/מיטה|חדר שינה|bed/i.test(t)) return iconBed;
  if (/רחצה|מקלחת|אמבט/i.test(t)) return iconDroplet;
  if (/אורח|אירוח/i.test(t)) return iconUsers;
  return iconPool;
}

export default function ZimmerView({ zimmer, onCancel, onUpdated, onDelete, embedded = false }) {
  const [data, setData] = useState(zimmer);
  const [occupiedToday, setOccupiedToday] = useState(false);
  const [modal, setModal] = useState(null);
  const [editingTab, setEditingTab] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const images = data.images || [];

  const MISSING_TAB = ['basic', 'settings', 'basic', 'location', 'rooms', 'rooms', 'basic'];
  const openEditor = (tab = 'basic') => setEditingTab(tab);
  const closeEditor = () => setEditingTab(null);
  const handleEditorSave = async (updated) => {
    setData(updated);
    onUpdated?.(updated);
    setEditingTab(null);
  };

  useEffect(() => {
    setData(zimmer);
    let cancelled = false;
    (async () => {
      try {
        const t = todayStr();
        const bookings = await api.entities.BookingRequest.filter({ zimmer_id: zimmer.id });
        const active = (bookings || []).filter((b) => b.status === 'אושרה' || b.status === 'חסום');
        if (!cancelled) setOccupiedToday(active.some((b) => coversDay(b.check_in, b.check_out, t)));
      } catch {
        if (!cancelled) setOccupiedToday(false);
      }
    })();
    return () => { cancelled = true; };
  }, [zimmer]);

  const bathroomCount = (data.rooms_detail || []).filter(r => r.has_bathroom).length + (data.additional_bathrooms_count || 0);
  const bedroomCount = (data.rooms_detail || []).length || data.num_rooms || 0;
  const hasKitchen = (data.amenities || []).some(a => /מטבח/.test(a));
  const hasPool = (data.amenities || []).some(a => /בריכה/.test(a));
  const details = [
    bathroomCount > 0 ? { icon: iconDroplet, label: `${bathroomCount} חדר רחצה` } : null,
    bedroomCount > 0 ? { icon: iconBed, label: `${bedroomCount} חדרי שינה` } : null,
    data.max_guests ? { icon: iconUsers, label: `עד ${data.max_guests} אורחים` } : null,
    hasKitchen ? { icon: null, label: 'מטבח מאובזר' } : null,
    hasPool ? { icon: null, label: 'בריכה פרטית' } : null,
  ].filter(Boolean);

  const weekday = data.weekday_price || data.price_per_night;
  const weekend = data.weekend_price || data.price_per_night;
  const showTwoPrices = !!(data.weekday_price || data.weekend_price);
  // Figma 1011:1244 — weekday / weekend (= רגיל / סוף שבוע). dir=ltr on render prevents RTL bidi flip.
  const priceLabel = showTwoPrices
    ? `${formatPrice(weekday)} / ${formatPrice(weekend)}`
    : data.price_per_night
      ? formatPrice(data.price_per_night)
      : null;

  const mainImg = images[0];
  const sideImgs = images.slice(1, 3);

  const shellClass = embedded
    ? 'flex flex-1 min-h-0 w-full overflow-hidden'
    : 'min-h-screen';

  return (
    <div className={shellClass} dir="rtl" style={{ background: '#FAFAFA' }}>
      <div className={`flex w-full ${embedded ? 'flex-1 min-h-0 overflow-hidden' : 'max-w-[1920px] mx-auto'} flex-col lg:flex-row`}>
        {/* Main property card — RIGHT in RTL */}
        <main
          className={`flex-1 min-w-0 min-h-0 ${embedded ? 'overflow-auto owner-hide-scrollbar p-3 sm:p-4 lg:p-5 lg:pl-3' : 'px-4 sm:px-6 py-6'}`}
        >
          <div
            className="relative bg-white mx-auto w-full"
            style={{ borderRadius: 23, maxWidth: 1366 }}
          >
            {/* Back — top of card, visual right */}
            <button
              type="button"
              onClick={onCancel}
              className="absolute z-10 flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ top: 24, right: 24, width: 37, height: 37 }}
              aria-label="חזרה לנכסים"
            >
              <span className="overflow-hidden block" style={{ width: 37, height: 37 }}>
                <img
                  src={iconBack}
                  alt=""
                  width={37}
                  height={37}
                  className="block w-full h-full"
                  style={{ transform: 'rotate(90deg)' }}
                />
              </span>
            </button>

            {/* More top padding so title sits below back; tighter right so title sits further right */}
            <div className="flex flex-col gap-8 pl-6 sm:pl-10 lg:pl-14 pr-6 sm:pr-8 lg:pr-8 pt-[72px] pb-10 items-stretch">
              {/* Header — Figma 1011:1227 */}
              <div className="flex flex-col gap-[38px] w-full">
                <div className="flex flex-col gap-[13px] w-full">
                  <h1
                    className="font-simpler w-full text-right"
                    style={{ color: '#0B3838', fontSize: 'clamp(22px, 2.4vw, 32px)', fontWeight: 600, lineHeight: 'normal' }}
                  >
                    {data.name}
                  </h1>

                  {/* justify-start in RTL = pack to the RIGHT */}
                  <div className="flex flex-wrap items-center justify-start gap-4 w-full">
                    {data.location && (
                      <div className="flex items-center gap-2.5">
                        <span className="overflow-hidden shrink-0" style={{ width: 11, height: 13 }}>
                          <img src={iconPin} alt="" width={11} height={13} className="block w-full h-full" />
                        </span>
                        <span
                          className="font-simona underline"
                          style={{ color: '#717171', fontSize: 15, fontWeight: 400, textUnderlineOffset: 3 }}
                        >
                          {data.location}
                        </span>
                      </div>
                    )}
                    {data.location && (
                      <span style={{ color: '#9CA3AF', fontSize: 15 }}>•</span>
                    )}
                    <span
                      className="font-simona inline-flex items-center justify-center rounded-[15px]"
                      style={{
                        background: '#EFEFEF',
                        color: '#0B3838',
                        fontSize: 15,
                        fontWeight: 400,
                        height: 18,
                        paddingInline: 12,
                        lineHeight: '18px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {`סטטוס- ${data.approval_status || 'ממתין'}`}
                    </span>
                    {occupiedToday && (
                      <span
                        className="font-simona inline-flex items-center justify-center px-2 py-[3px] rounded-full"
                        style={{ background: '#FFFF00', color: '#0B3838', fontSize: 13, fontWeight: 500, minWidth: 82 }}
                      >
                        תפוס כרגע
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-[14px] w-full">
                  {priceLabel && (
                    <div className="flex items-end gap-[9px]">
                      <span className="overflow-hidden shrink-0 mb-0.5" style={{ width: 20, height: 20 }}>
                        <img src={iconTag} alt="" width={20} height={20} className="block w-full h-full" />
                      </span>
                      <span
                        dir="ltr"
                        className="font-simpler whitespace-nowrap"
                        style={{ color: '#0B3838', fontSize: 19, fontWeight: 600, lineHeight: 'normal' }}
                      >
                        {priceLabel}
                      </span>
                      <span className="font-simona whitespace-nowrap" style={{ color: '#717171', fontSize: 14, fontWeight: 400, lineHeight: 'normal' }}>
                        {showTwoPrices ? 'מחיר רגיל / סוף שבוע' : 'מחיר ללילה'}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    dir="ltr"
                    className="font-simona flex items-center justify-center gap-[9px] transition-opacity hover:opacity-80 shrink-0"
                    style={{
                      background: '#FAFAFA',
                      borderRadius: 17,
                      padding: '7px 29px',
                      color: '#0B3838',
                      fontSize: 14,
                      fontWeight: 500,
                      minHeight: 45,
                    }}
                  >
                    <span className="overflow-hidden shrink-0" style={{ width: 16, height: 16 }}>
                      <img src={iconEye} alt="" width={16} height={16} className="block w-full h-full" />
                    </span>
                    תצוגה באתר
                  </button>
                </div>
              </div>

              <div className="w-full h-px" style={{ background: '#E8E8E8' }} />

              {/* Gallery — Figma 1011:1248: Left-Previews flex-1 (wider), Main 521px (right) */}
              {images.length > 0 && (
                <div className="relative w-full" style={{ minHeight: 280 }}>
                  <div className="flex gap-4 w-full" style={{ height: 'clamp(280px, 42vw, 480px)' }} dir="rtl">
                    {/* Main large — RIGHT in RTL, fixed ~521px like Figma 1011:1252 */}
                    <div
                      className="relative h-full overflow-hidden shrink-0"
                      style={{ width: 'min(521px, 48%)', borderRadius: 16 }}
                    >
                      <Image src={mainImg} className="w-full h-full" fittingType="fill" />
                    </div>
                    {/* Side stack — LEFT, takes remaining width (wider on large screens) */}
                    {sideImgs.length > 0 && (
                      <div className="flex flex-col gap-4 flex-1 min-w-0 h-full">
                        {sideImgs.map((img, i) => (
                          <div key={i} className="relative flex-1 min-h-0 overflow-hidden" style={{ borderRadius: 16 }}>
                            <Image src={img} className="w-full h-full" fittingType="fill" />
                          </div>
                        ))}
                        {sideImgs.length === 1 && <div className="flex-1" />}
                      </div>
                    )}
                  </div>

                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0"
                    style={{
                      height: 142,
                      background: 'linear-gradient(to top, #FFFFFF 0%, rgba(217,217,217,0) 100%)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => openEditor('basic')}
                    className="font-simpler text-white transition-opacity hover:opacity-90"
                    style={{
                      position: 'absolute',
                      /* Center on the 16px gutter between left stack and right main (gap-4) */
                      left: 'calc(100% - min(521px, 48%) - 8px)',
                      bottom: 0,
                      transform: 'translateX(-50%)',
                      background: '#0B3838',
                      borderRadius: 123,
                      width: 171,
                      height: 52,
                      fontSize: 20,
                      fontWeight: 600,
                      zIndex: 2,
                    }}
                  >
                    עריכה
                  </button>
                </div>
              )}

              {images.length === 0 && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => openEditor('basic')}
                    className="font-simpler text-white transition-opacity hover:opacity-90"
                    style={{ background: '#0B3838', borderRadius: 123, width: 171, height: 52, fontSize: 20, fontWeight: 600 }}
                  >
                    עריכה
                  </button>
                </div>
              )}

              <div className="w-full h-px" style={{ background: '#E8E8E8' }} />

              {details.length > 0 && (
                <div className="flex flex-col gap-3 w-full items-stretch">
                  <h2 className="font-simpler w-full text-right" style={{ color: '#0B3838', fontSize: 20, fontWeight: 600 }}>
                    פרטים
                  </h2>
                  <div className="flex flex-wrap items-center justify-start w-full gap-0">
                    {details.map((d, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && (
                          <span className="px-1" style={{ color: '#0B3838', fontSize: 24, lineHeight: 1 }}>•</span>
                        )}
                        <div className="flex items-center gap-2 px-4 py-2">
                          {d.icon && (
                            <span className="overflow-hidden shrink-0" style={{ width: 16, height: 16 }}>
                              <img src={d.icon} alt="" width={16} height={16} className="block w-full h-full" />
                            </span>
                          )}
                          <span className="font-simona whitespace-nowrap" style={{ color: '#0B3838', fontSize: 16, fontWeight: 400 }}>
                            {d.label}
                          </span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              <div className="w-full h-px" style={{ background: '#E8E8E8' }} />

              <section className="flex flex-col gap-3 items-end w-full text-right">
                <h2 className="font-simpler w-full" style={{ color: '#0B3838', fontSize: 20, fontWeight: 600 }}>
                  על בקתת האירוח
                </h2>
                <p className="font-simona w-full whitespace-pre-wrap" style={{ color: '#717171', fontSize: 16, fontWeight: 400, lineHeight: '26px' }}>
                  {data.description || 'עדיין אין תיאור לנכס. לחצו על עריכה כדי להוסיף.'}
                </p>
              </section>

              <div className="w-full h-px" style={{ background: '#E8E8E8' }} />

              <section className="flex flex-col gap-4 items-end w-full">
                <h2 className="font-simpler w-full text-right" style={{ color: '#0B3838', fontSize: 20, fontWeight: 600 }}>
                  מה המקום מציע
                </h2>
                {(data.amenities || []).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 w-full">
                    {(data.amenities || []).slice(0, 8).map((a, i) => (
                      <div key={i} className="flex items-center justify-start gap-2 min-w-0">
                        <span className="overflow-hidden shrink-0" style={{ width: 20, height: 20 }}>
                          <img src={amenityIcon(a)} alt="" width={20} height={20} className="block w-full h-full" />
                        </span>
                        <span className="font-simona text-right" style={{ color: '#0B3838', fontSize: 16, fontWeight: 400 }}>
                          {a}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-simona text-right w-full" style={{ color: '#717171', fontSize: 15 }}>
                    עדיין לא הוגדרו מתקנים. ניתן להוסיף בעריכה.
                  </p>
                )}
              </section>

              <div className="w-full h-px" style={{ background: '#E8E8E8' }} />

              <section className="flex flex-col gap-4 items-end w-full">
                <div className="flex flex-col gap-1 items-end w-full text-right">
                  <h2 className="font-simpler w-full" style={{ color: '#0B3838', fontSize: 20, fontWeight: 600 }}>
                    היכן אני נמצא
                  </h2>
                  <p className="font-simona w-full" style={{ color: '#717171', fontSize: 15, fontWeight: 400 }}>
                    {data.location
                      ? `${data.location} – מיקום מדהים בלב הטבע עם גישה קלה למסלולי טיולים ואטרקציות`
                      : 'מיקום לא צוין. הוסיפו כתובת בעריכה.'}
                  </p>
                </div>
                <ZimmerMapView zimmer={data} onEdit={() => openEditor('location')} figmaLayout />
              </section>
            </div>
          </div>
        </main>

        <aside
          className={`w-full lg:w-[460px] flex-shrink-0 ${embedded ? 'overflow-auto owner-hide-scrollbar border-r border-[#F0EEE8]' : ''}`}
          style={embedded ? { maxHeight: '100%' } : undefined}
        >
          <div className={`${embedded ? 'p-4 lg:p-6 lg:pt-8' : 'px-4 pb-8'}`}>
            <ZimmerAiSidebar
              zimmer={data}
              onAddBooking={() => setModal('booking')}
              onBlockDate={() => setModal('block')}
              onUpdatePrice={() => openEditor('price')}
              onOpenCheckin={() => openEditor('settings')}
              onFillMissing={(i) => openEditor(MISSING_TAB[i] || 'basic')}
            />
          </div>
        </aside>
      </div>

      {modal === 'booking' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModal(null)}>
          <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <ManualBookingForm zimmers={[data]} ownerId={data.owner_id} onClose={() => setModal(null)} onSaved={() => setModal(null)} />
          </div>
        </div>
      )}

      {modal === 'block' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-simpler text-base" style={{ color: '#0B3838', fontWeight: 600 }}>חסימת תאריך · {data.name}</h2>
              <button type="button" onClick={() => setModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F8F7F4', color: '#6B7280' }}>
                <X size={16} />
              </button>
            </div>
            <BlockDateForm zimmers={[data]} ownerId={data.owner_id} initialZimmerId={data.id} onDone={() => setModal(null)} />
          </div>
        </div>
      )}

      {editingTab && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#F8F7F4' }}>
          <ZimmerEditor zimmer={data} initialTab={editingTab} onSave={handleEditorSave} onCancel={closeEditor} onDelete={onDelete} />
        </div>
      )}

      {previewOpen && (
        <CustomerPreviewModal zimmer={data} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}
