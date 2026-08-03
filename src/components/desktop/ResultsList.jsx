import React, { useState, useEffect } from 'react';
import ZimmerCard from '@/components/chat/ZimmerCard';
import { MapPin, ChevronDown } from 'lucide-react';

const PAGE = 5;

export default function ResultsList({ zimmers, selectedId, onSelect, loadingCoords, searchDates }) {
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    setVisible(PAGE);
  }, [zimmers]);

  const shown = zimmers.slice(0, visible);
  const hasMore = zimmers.length > visible;

  return (
    <div className="flex flex-col h-full" dir="rtl">
      <div className="px-4 py-3 sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 z-10 rounded-t-3xl">
        <h3 className="font-bold text-sm text-gray-800">תוצאות חיפוש</h3>
        <p className="text-xs text-gray-500">
          {zimmers.length} צימרים רלוונטיים {loadingCoords && '· מאתר מיקומים במפה…'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {zimmers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-10">
            <MapPin size={32} className="mb-2 opacity-40" />
            <p className="text-sm">בחר תאריכים בצ'אט כדי לראות צימרים פנויים</p>
          </div>
        ) : (
          <>
            {shown.map((z) => (
              <div
                key={z.id}
                onClick={() => onSelect(z)}
                className={`cursor-pointer rounded-2xl transition-all ${selectedId === z.id ? 'ring-2 ring-orange-400' : 'ring-1 ring-transparent hover:ring-orange-200'}`}
              >
                <ZimmerCard zimmer={z} searchDates={searchDates} />
              </div>
            ))}
            {hasMore && (
              <button
                onClick={() => setVisible((v) => v + PAGE)}
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors"
              >
                <ChevronDown size={16} /> עוד {zimmers.length - visible} צימרים
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}