import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowRight, PenLine, MapPin } from 'lucide-react';
import { Image } from '@/components/ui/image';
import InfoSummarySection from '@/components/admin/InfoSummarySection';
import InfoSummaryEditor from '@/components/admin/InfoSummaryEditor';
import ReviewsSection from '@/components/reviews/ReviewsSection';

export default function ZimmerView({ zimmer, onEdit, onCancel, onUpdated }) {
  const [data, setData] = useState(zimmer);
  const [editingSummary, setEditingSummary] = useState(false);
  const images = data.images || [];

  const handleSaveSummary = async (text, snapshot) => {
    await base44.entities.Zimmer.update(data.id, { info_summary: text, info_summary_snapshot: snapshot });
    const updated = { ...data, info_summary: text, info_summary_snapshot: snapshot };
    setData(updated);
    if (onUpdated) onUpdated(updated);
    setEditingSummary(false);
  };

  return (
    <div className="min-h-screen" dir="rtl" style={{ background: '#F8F7F4', fontFamily: 'Heebo, sans-serif' }}>
      <div className="max-w-3xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onCancel}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
              <ArrowRight size={17} />
            </button>
            <div>
              <h1 className="text-xl font-black" style={{ color: '#1A1A1A' }}>{data.name}</h1>
              {data.location && (
                <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: '#9CA3AF' }}>
                  <MapPin size={12} />{data.location}
                </p>
              )}
            </div>
          </div>
          <button onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
            <PenLine size={15} /> עריכה
          </button>
        </div>

        {/* Images */}
        {images.length > 0 && (
          <div className="mb-5">
            <div className="rounded-2xl overflow-hidden h-64 mb-2">
              <Image src={images[0]} className="w-full h-full" fittingType="fill" />
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {images.slice(1, 5).map((img, i) => (
                  <div key={i} className="rounded-xl overflow-hidden aspect-square">
                    <Image src={img} className="w-full h-full" fittingType="fill" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {data.price_per_night && (
            <div className="rounded-2xl p-4 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <div className="text-lg font-black" style={{ color: '#F97316' }}>₪{data.price_per_night}</div>
              <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>ללילה</div>
            </div>
          )}
          {data.num_rooms && (
            <div className="rounded-2xl p-4 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <div className="text-lg font-black" style={{ color: '#1A1A1A' }}>{data.num_rooms}</div>
              <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>חדרים</div>
            </div>
          )}
          {data.max_guests && (
            <div className="rounded-2xl p-4 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <div className="text-lg font-black" style={{ color: '#1A1A1A' }}>{data.max_guests}</div>
              <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>אורחים מקסימלי</div>
            </div>
          )}
          <div className="rounded-2xl p-4 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <div className="text-sm font-bold" style={{ color: data.approval_status === 'אושר' ? '#22C55E' : data.approval_status === 'נדחה' ? '#EF4444' : '#F59E0B' }}>
              {data.approval_status || 'ממתין'}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>סטטוס</div>
          </div>
        </div>

        {/* Description */}
        {data.description && (
          <section className="rounded-2xl p-6 mb-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <h2 className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#F97316' }}>תיאור</h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#4B5563' }}>{data.description}</p>
          </section>
        )}

        {/* Info summary (replaces raw data zones) — identical to what the customer sees */}
        <div className="mb-5">
          <InfoSummarySection zimmer={data} isOwner onEdit={() => setEditingSummary(true)} />
        </div>

        {/* Published reviews */}
        <div className="mb-5">
          <ReviewsSection zimmerId={data.id} />
        </div>
      </div>

      {editingSummary && (
        <InfoSummaryEditor zimmer={data} onSave={handleSaveSummary} onClose={() => setEditingSummary(false)} />
      )}
    </div>
  );
}