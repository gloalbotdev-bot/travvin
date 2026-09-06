import React from 'react';
import { Home, TreePalm, MapPin } from 'lucide-react';
import { groupAmenities, AMENITY_GROUPS } from '@/lib/rooms';

const ICONS = { home: Home, tree: TreePalm, pin: MapPin };

export default function AmenitiesGroups({ amenities }) {
  const groups = groupAmenities(amenities);
  const hasAny = Object.values(groups).some((arr) => arr.length);
  if (!hasAny) return null;

  return (
    <div dir="rtl">
      <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: '#0B3838' }}>מתקנים</h3>
      <div className="space-y-2.5">
        {AMENITY_GROUPS.map((g) => {
          const items = groups[g.key];
          if (!items.length) return null;
          const Icon = ICONS[g.icon];
          return (
            <div key={g.key} className="rounded-2xl p-3.5" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color: '#0B3838' }} />
                <span className="font-bold text-xs uppercase tracking-wider" style={{ color: '#0B3838' }}>{g.label}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((a, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}>{a}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}