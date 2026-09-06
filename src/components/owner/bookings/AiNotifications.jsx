import React from 'react';
import { Sparkles } from 'lucide-react';
import { needsAttention } from './bookingStatus';

// AI insight cards built from the loaded bookings (no extra network calls).
export default function AiNotifications({ bookings, onApproveQuick, onCreatePromo }) {
  const pending = bookings.filter(needsAttention);
  const cards = [];
  if (pending.length > 0) {
    cards.push({
      id: 'pending',
      text: `${pending.length} הזמנות ממתינות לאישור — מומלץ לאשר היום כדי להבטיח את העסקה`,
      link: 'מעבר לאישור מהיר',
      onClick: () => onApproveQuick(pending[0]),
    });
  }
  // Detect a free upcoming weekend across any zimmer.
  const fri = new Date();
  const dow = fri.getDay();
  fri.setDate(fri.getDate() + ((5 - dow + 7) % 7 || 7));
  const sat = new Date(fri); sat.setDate(sat.getDate() + 1);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const friStr = iso(fri), satStr = iso(sat);
  const covered = bookings.some(b => b.status === 'אושרה' && new Date(b.check_in) <= fri && new Date(b.check_out) >= sat);
  if (!covered) {
    cards.push({
      id: 'weekend',
      text: 'הסופ"ש הקרוב פנוי — אפשר להציע הנחה קטנה כדי להגדיל סיכוי לסגירה',
      link: 'צור הצעה',
      onClick: onCreatePromo,
    });
  }

  if (cards.length === 0) return null;
  return (
    <div className="space-y-2">
      {cards.map(c => (
        <div key={c.id} className="rounded-xl p-3" style={{ background: '#FFF8E1', border: '1px solid #FFE082' }}>
          <div className="flex items-start gap-2">
            <Sparkles size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#F59E0B' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-5" style={{ color: '#616161' }}>{c.text}</p>
              <button onClick={c.onClick} className="text-xs font-bold mt-1.5" style={{ color: '#E53935' }}>{c.link} ←</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}