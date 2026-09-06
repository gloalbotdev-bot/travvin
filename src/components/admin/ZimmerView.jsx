import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { ArrowRight, Pencil, MapPin, Eye, Bath, BedDouble, Users, UtensilsCrossed, Waves, Check, X } from 'lucide-react';
import { Image } from '@/components/ui/image';
import InfoSummarySection from '@/components/admin/InfoSummarySection';
import InfoSummaryEditor from '@/components/admin/InfoSummaryEditor';
import ReviewsSection from '@/components/reviews/ReviewsSection';
import ZimmerAiSidebar from '@/components/admin/ZimmerAiSidebar';
import ZimmerMapView from '@/components/admin/ZimmerMapView';
import ZimmerEditor from '@/components/admin/ZimmerEditor';
import ManualBookingForm from '@/components/owner/ManualBookingForm';
import BlockDateForm from '@/components/owner/BlockDateForm';
import CustomerPreviewModal from '@/components/admin/CustomerPreviewModal';

const overlap = (aIn, aOut, bIn, bOut) => new Date(aIn) < new Date(bOut) && new Date(aOut) > new Date(bIn);
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ZimmerView({ zimmer, onCancel, onUpdated, onDelete }) {
  const [data, setData] = useState(zimmer);
  const [editingSummary, setEditingSummary] = useState(false);
  const [occupiedToday, setOccupiedToday] = useState(false);
  const [modal, setModal] = useState(null);
  const [editingTab, setEditingTab] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const images = data.images || [];

  // Maps each completion-list item index to the editor tab that fills it.
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
        const bookings = await api.entities.BookingRequest.filter({ zimmer_id: zimmer.id, status: 'אושרה' });
        if (!cancelled) setOccupiedToday(bookings.some(b => overlap(b.check_in, b.check_out, t, t)));
      } catch {
        if (!cancelled) setOccupiedToday(false);
      }
    })();
    return () => { cancelled = true; };
  }, [zimmer]);

  const handleSaveSummary = async (text, snapshot) => {
    await api.entities.Zimmer.update(data.id, { info_summary: text, info_summary_snapshot: snapshot });
    const updated = { ...data, info_summary: text, info_summary_snapshot: snapshot };
    setData(updated);
    if (onUpdated) onUpdated(updated);
    setEditingSummary(false);
  };

  // Detail chips
  const bathroomCount = (data.rooms_detail || []).filter(r => r.has_bathroom).length + (data.additional_bathrooms_count || 0);
  const bedroomCount = (data.rooms_detail || []).length || data.num_rooms || 0;
  const hasKitchen = (data.amenities || []).some(a => /מטבח/.test(a));
  const hasPool = (data.amenities || []).some(a => /בריכה/.test(a));
  const details = [
    bathroomCount > 0 ? { icon: Bath, label: `${bathroomCount} חדר רחצה` } : null,
    bedroomCount > 0 ? { icon: BedDouble, label: `${bedroomCount} חדרי שינה` } : null,
    data.max_guests ? { icon: Users, label: `עד ${data.max_guests} אורחים` } : null,
    hasKitchen ? { icon: UtensilsCrossed, label: 'מטבח מאובזר' } : null,
    hasPool ? { icon: Waves, label: 'בריכה פרטית' } : null,
  ].filter(Boolean);

  const weekday = data.weekday_price || data.price_per_night;
  const weekend = data.weekend_price || data.price_per_night;
  const showTwoPrices = !!(data.weekday_price || data.weekend_price);

  return (
    <div className="min-h-screen" dir="rtl" style={{ background: '#F9FAFB', fontFamily: 'Heebo, sans-serif' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Top back row */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onCancel}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white"
            style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
            <ArrowRight size={17} />
          </button>
          <span className="text-sm" style={{ color: '#9CA3AF' }}>חזרה לצימרים</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <main className="flex-1 min-w-0 space-y-5">
            {/* Header */}
            <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-black leading-tight" style={{ color: '#1A1A1A' }}>{data.name}</h1>
                  {data.location && (
                    <p className="text-sm flex items-center gap-1 mt-1.5" style={{ color: '#6B7280' }}>
                      <MapPin size={13} />{data.location}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={data.approval_status === 'אושר'
                        ? { background: 'rgba(34,197,94,0.12)', color: '#16A34A' }
                        : data.approval_status === 'נדחה'
                          ? { background: 'rgba(239,68,68,0.12)', color: '#EF4444' }
                          : { background: 'rgba(245,158,11,0.12)', color: '#D97706' }}>
                      סטטוס · {data.approval_status || 'ממתין'}
                    </span>
                    {occupiedToday && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#FDE047', color: '#713F12' }}>
                        תפוס כרגע
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2">
                  {showTwoPrices ? (
                    <div className="flex items-center gap-1.5 text-sm font-black" style={{ color: '#1A1A1A' }}>
                      <span>₪{weekday}</span><span style={{ color: '#9CA3AF' }}>/</span><span>₪{weekend}</span>
                    </div>
                  ) : data.price_per_night ? (
                    <div className="text-sm font-black" style={{ color: '#1A1A1A' }}>₪{data.price_per_night} / לילה</div>
                  ) : null}
                  {showTwoPrices && <span className="text-[11px]" style={{ color: '#9CA3AF' }}>אמצ"ש / סופ"ש</span>}
                  <button onClick={() => setPreviewOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                    style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', color: '#1E293B' }}>
                    <Eye size={13} /> צפה כלקוח
                  </button>
                </div>
              </div>
            </div>

            {/* Gallery with floating edit */}
            {images.length > 0 && (
              <div className="relative rounded-2xl overflow-hidden" style={{ border: '1.5px solid #F0EEE8' }}>
                <div className="h-64 sm:h-80" style={{ background: '#F8F7F4' }}>
                  <Image src={images[0]} className="w-full h-full" fittingType="fill" />
                </div>
                {images.length > 1 && (
                  <div className="grid grid-cols-2 gap-1 p-1" style={{ background: '#F8F7F4' }}>
                    {images.slice(1, 3).map((img, i) => (
                      <div key={i} className="h-32 sm:h-40">
                        <Image src={img} className="w-full h-full" fittingType="fill" />
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => openEditor('basic')}
                  className="absolute bottom-4 left-4 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:opacity-90"
                  style={{ background: '#1A3C3E' }}>
                  <Pencil size={15} /> עריכה
                </button>
              </div>
            )}

            {/* Details row */}
            {details.length > 0 && (
              <div className="rounded-2xl p-4 flex flex-wrap items-center gap-x-5 gap-y-3" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                {details.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <d.icon size={17} style={{ color: '#1E293B' }} />
                    <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{d.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            {data.description && (
              <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <h2 className="font-black text-sm mb-3" style={{ color: '#1A1A1A' }}>על בקתת האירוח</h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#4B5563' }}>{data.description}</p>
              </section>
            )}

            {/* Amenities */}
            {(data.amenities || []).length > 0 && (
              <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <h2 className="font-black text-sm mb-3" style={{ color: '#1A1A1A' }}>מה המקום מציע</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(data.amenities || []).slice(0, 8).map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(26,60,62,0.1)' }}>
                        <Check size={12} style={{ color: '#1A3C3E' }} />
                      </div>
                      <span className="text-sm" style={{ color: '#374151' }}>{a}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Map */}
            <ZimmerMapView zimmer={data} onEdit={() => openEditor('location')} />

            {/* Info summary */}
            <InfoSummarySection zimmer={data} isOwner onEdit={() => setEditingSummary(true)} />

            {/* Reviews */}
            <ReviewsSection zimmerId={data.id} />
          </main>

          {/* AI sidebar */}
          <aside className="w-full lg:w-80 flex-shrink-0">
            <ZimmerAiSidebar
              zimmer={data}
              onAddBooking={() => setModal('booking')}
              onBlockDate={() => setModal('block')}
              onUpdatePrice={() => openEditor('price')}
              onOpenCheckin={() => openEditor('settings')}
              onFillMissing={(i) => openEditor(MISSING_TAB[i] || 'basic')}
            />
          </aside>
        </div>
      </div>

      {editingSummary && (
        <InfoSummaryEditor zimmer={data} onSave={handleSaveSummary} onClose={() => setEditingSummary(false)} />
      )}

      {/* Inline: manual booking */}
      {modal === 'booking' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModal(null)}>
          <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <ManualBookingForm zimmers={[data]} ownerId={data.owner_id} onClose={() => setModal(null)} onSaved={() => setModal(null)} />
          </div>
        </div>
      )}

      {/* Inline: block date */}
      {modal === 'block' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={e => e.stopPropagation()} dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-base" style={{ color: '#1A1A1A' }}>חסימת תאריך · {data.name}</h2>
              <button onClick={() => setModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F8F7F4', color: '#6B7280' }}><X size={16} /></button>
            </div>
            <BlockDateForm zimmers={[data]} ownerId={data.owner_id} initialZimmerId={data.id} onDone={() => setModal(null)} />
          </div>
        </div>
      )}

      {/* Inline: full editor overlay (opens at the requested tab) */}
      {editingTab && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#F8F7F4' }}>
          <ZimmerEditor zimmer={data} initialTab={editingTab} onSave={handleEditorSave} onCancel={closeEditor} onDelete={onDelete} />
        </div>
      )}

      {/* Customer view preview modal */}
      {previewOpen && (
        <CustomerPreviewModal zimmer={data} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}