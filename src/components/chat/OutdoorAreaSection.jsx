import React from 'react';
import { TreePalm } from 'lucide-react';
import { effectiveOutdoorItems, hasOutdoorArea, outdoorItemLabel } from '@/lib/rooms';

// variant: 'compact' (drawer boxes, like AmenitiesGroups) | 'page' (public page white card).
export default function OutdoorAreaSection({ zimmer, variant = 'compact' }) {
  const area = hasOutdoorArea(zimmer) ? zimmer.outdoor_area : {};
  const items = effectiveOutdoorItems(zimmer);
  const photos = Array.isArray(area.photos) ? area.photos : [];
  if (!items.length && !area.description && !area.size_sqm && !photos.length) return null;

  const meta = [
    area.privacy === 'private' ? 'חצר פרטית' : area.privacy === 'shared' ? 'חצר משותפת' : null,
    area.size_sqm ? `${area.size_sqm} מ״ר` : null,
  ].filter(Boolean);

  if (variant === 'page') {
    return (
      <section className="bg-white rounded-2xl p-6 sm:p-8" style={{ border: '1px solid #E0E0E0' }} dir="rtl">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <h2 className="text-lg font-bold" style={{ color: '#212121' }}>המתחם החיצוני</h2>
          {meta.map((m) => (
            <span key={m} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#F5F5F5', color: '#424242' }}>{m}</span>
          ))}
        </div>
        {area.description && (
          <p className="text-sm leading-7 whitespace-pre-wrap mb-4" style={{ color: '#555555' }}>{area.description}</p>
        )}
        {items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((it, i) => (
              <div key={`${it.name}-${i}`} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#F5F5F5' }}>
                  <TreePalm size={14} style={{ color: '#424242' }} />
                </div>
                <span className="text-sm" style={{ color: '#424242' }}>{outdoorItemLabel(it, area.privacy)}</span>
              </div>
            ))}
          </div>
        )}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
            {photos.slice(0, 8).map((p, i) => (
              <img key={`${p}-${i}`} src={p} alt={`תמונת החצר ${i + 1}`} className="w-full aspect-square object-cover rounded-xl" loading="lazy" />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div dir="rtl">
      <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: '#0B3838' }}>מתחם חיצוני</h3>
      <div className="rounded-2xl p-3.5 space-y-2.5" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <TreePalm size={14} style={{ color: '#0B3838' }} />
          <span className="font-bold text-xs uppercase tracking-wider" style={{ color: '#0B3838' }}>חצר</span>
          {meta.map((m) => (
            <span key={m} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#fff', border: '1px solid #E8E5E0', color: '#0B3838' }}>{m}</span>
          ))}
        </div>
        {area.description && (
          <p className="text-xs leading-relaxed" style={{ color: '#4B5563' }}>{area.description}</p>
        )}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {items.map((it, i) => (
              <span key={`${it.name}-${i}`} className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}>
                {outdoorItemLabel(it, area.privacy)}
              </span>
            ))}
          </div>
        )}
        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {photos.slice(0, 8).map((p, i) => (
              <img key={`${p}-${i}`} src={p} alt={`תמונת החצר ${i + 1}`} className="w-full aspect-square object-cover rounded-lg" loading="lazy" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
