import React from 'react';
import { MapPin } from 'lucide-react';

// Landmark chips with travel time (e.g. "חוף הכינרת · 8 דק").
export default function NearbyLandmarks({ landmarks }) {
  const list = Array.isArray(landmarks) ? landmarks.filter((l) => l && l.name) : [];
  if (!list.length) return null;
  return (
    <div dir="rtl" className="rounded-2xl p-4" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
      <div className="flex items-center gap-2 mb-2">
        <MapPin size={14} style={{ color: '#0B3838' }} />
        <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#0B3838' }}>בסביבה</h3>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {list.map((l, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: '#fff', border: '1px solid #F0EEE8', color: '#0B3838' }}>
            {l.name}
            {l.travel_time_minutes != null && <span style={{ color: '#9CA3AF' }}>· {l.travel_time_minutes} דק</span>}
          </span>
        ))}
      </div>
    </div>
  );
}