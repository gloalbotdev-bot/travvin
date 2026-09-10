import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { MapPin, Navigation, Pencil } from 'lucide-react';

export default function ZimmerMapView({ zimmer, onEdit, editable = true, figmaLayout = false }) {
  const [mode, setMode] = useState('loading'); // loading | precise | region | none
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedLat = zimmer.stay_settings?.lat;
      const storedLng = zimmer.stay_settings?.lng;
      if (storedLat && storedLng) {
        if (!cancelled) { setMode('precise'); setLat(storedLat); setLng(storedLng); }
        return;
      }
      const precise = zimmer.stay_settings?.address?.trim();
      const region = zimmer.location?.trim();
      const queries = [precise, region].filter(Boolean);
      if (!queries.length) { if (!cancelled) setMode('none'); return; }
      try {
        const res = await api.functions.invoke('geocodeAddresses', { addresses: queries });
        const r = res?.results || [];
        const preciseRes = precise ? r[0] : null;
        const regionRes = region ? r[precise ? 1 : 0] : null;
        if (!cancelled) {
          if (preciseRes && preciseRes.lat) { setMode('precise'); setLat(preciseRes.lat); setLng(preciseRes.lng); }
          else if (regionRes && regionRes.lat) { setMode('region'); setLat(regionRes.lat); setLng(regionRes.lng); }
          else setMode('none');
        }
      } catch {
        if (!cancelled) setMode('none');
      }
    })();
    return () => { cancelled = true; };
  }, [zimmer.id, zimmer.location, zimmer.stay_settings?.address, zimmer.stay_settings?.lat, zimmer.stay_settings?.lng]);

  const delta = mode === 'precise' ? 0.008 : 0.06;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const src = (mode === 'precise' || mode === 'region')
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${mode === 'precise' ? `&marker=${lat},${lng}` : ''}`
    : null;

  const mapBody = (
    <>
      {mode === 'loading' ? (
        <div className="w-full flex items-center justify-center" style={{ height: 280, borderRadius: 16, background: '#F9FAFB' }}>
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        </div>
      ) : src ? (
        <div className="relative overflow-hidden w-full" style={{ borderRadius: 16 }}>
          <iframe
            title="מפת מיקום"
            src={src}
            className="w-full"
            style={{ height: 280, border: 0, display: 'block' }}
            loading="lazy"
          />
          {mode === 'precise' && zimmer.stay_settings?.nav_link && (
            <a href={zimmer.stay_settings.nav_link} target="_blank" rel="noreferrer"
              className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white shadow"
              style={{ background: '#0B3838' }}>
              <Navigation size={12} /> ניווט
            </a>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={editable ? onEdit : undefined}
          className="w-full flex flex-col items-center justify-center"
          style={{ height: 280, borderRadius: 16, background: '#F9FAFB', border: '1.5px dashed #E5E7EB' }}
        >
          <MapPin size={22} style={{ color: '#9CA3AF' }} />
          <p className="font-simona text-xs mt-2" style={{ color: '#9CA3AF' }}>אין מיקום להצגה עדיין</p>
        </button>
      )}

      {!figmaLayout && (zimmer.nearby_landmarks || []).length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {zimmer.nearby_landmarks.map((l, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#F9FAFB', border: '1px solid #F0EEE8', color: '#1E293B' }}>
              {l.name}{l.travel_time_minutes != null && <span style={{ color: '#9CA3AF' }}> · {l.travel_time_minutes} דק</span>}
            </span>
          ))}
        </div>
      )}
    </>
  );

  if (figmaLayout) {
    return <div className="w-full" dir="rtl">{mapBody}</div>;
  }

  return (
    <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }} dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin size={16} style={{ color: '#1E293B' }} />
          <h2 className="font-black text-sm" style={{ color: '#1A1A1A' }}>היכן אני נמצא</h2>
        </div>
        {editable && (
          <button onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: '#1E293B' }}>
            <Pencil size={12} /> עריכה
          </button>
        )}
      </div>

      <p className="text-xs mb-3 leading-relaxed" style={{ color: '#6B7280' }}>
        {zimmer.location ? `${zimmer.location} — ` : ''}
        {mode === 'precise'
          ? 'מיקום מדויק על פי הכתובת שהוזנה.'
          : mode === 'region'
            ? 'מציג את האזור הכללי. כדאי להוסיף כתובת מדויקת לניווט בעריכה.'
            : 'מיקום לא צוין. הוסף מיקום או כתובת בעריכה כדי להציג מפה מדויקת.'}
      </p>

      {mapBody}
    </section>
  );
}