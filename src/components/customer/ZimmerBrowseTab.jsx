import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/api/client';
import { MapPin, Loader2, Sparkles, SlidersHorizontal, RotateCcw } from 'lucide-react';
import ZimmerBrowseCard from '@/components/customer/ZimmerBrowseCard';
import ZimmerPageFilters from '@/components/customer/ZimmerPageFilters';
import { getBookedZimmerIds } from '@/components/chat/DateSearchWidget';

const DEFAULT_FILTERS = { q: '', start: '', end: '', numGuests: 0, minPrice: 0, maxPrice: 0, amenities: [], sort: 'newest' };

const effectivePrice = (z) => z.weekday_price ?? z.weekend_price ?? z.price_per_night ?? null;

// Index of approved zimmers. In AI mode (default) the list is driven by the
// adjacent chat: filterIds (when provided) restricts the grid to the chat's
// smart results. In manual mode the full filter panel is shown and filterIds
// is ignored.
export default function ZimmerBrowseTab({ user, onSelect, filterIds = null, aiMode = true, onResetAI, onBackToAI }) {
  const [zimmers, setZimmers] = useState([]);
  const [reviewsMap, setReviewsMap] = useState({});
  const [bookedIds, setBookedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [list, reviews] = await Promise.all([
          api.entities.Zimmer.filter({ approval_status: 'אושר' }, '-created_date', 200),
          api.entities.Review.filter({ status: 'published' }, '-published_at', 200).catch(() => []),
        ]);
        if (!active) return;
        setZimmers(list || []);
        const map = {};
        (reviews || []).forEach(r => {
          if (!r.zimmer_id) return;
          if (!map[r.zimmer_id]) map[r.zimmer_id] = { count: 0, sum: 0 };
          map[r.zimmer_id].count += 1;
          map[r.zimmer_id].sum += (r.rating || 0);
        });
        const finalMap = {};
        Object.entries(map).forEach(([id, v]) => { finalMap[id] = { count: v.count, avg: v.sum / v.count }; });
        setReviewsMap(finalMap);
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  // Availability: when dates set (manual mode), fetch booked ids once per range.
  useEffect(() => {
    if (!filters.start || !filters.end) { setBookedIds([]); return; }
    let active = true;
    (async () => {
      try { const ids = await getBookedZimmerIds(api, filters.start, filters.end); if (active) setBookedIds(ids); }
      catch { if (active) setBookedIds([]); }
    })();
    return () => { active = false; };
  }, [filters.start, filters.end]);

  // AI mode: restrict to filterIds preserving the chat's ranking order.
  const aiList = useMemo(() => {
    if (!filterIds || filterIds.length === 0) return zimmers;
    const byId = new Map(zimmers.map(z => [z.id, z]));
    return filterIds.map(id => byId.get(id)).filter(Boolean);
  }, [zimmers, filterIds]);

  // Manual mode: apply the full filter panel.
  const manualList = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    let out = zimmers.filter(z => {
      if (q) {
        const hay = `${z.name || ''} ${z.location || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.numGuests > 0 && z.max_guests && z.max_guests < filters.numGuests) return false;
      if (filters.start && filters.end && bookedIds.includes(z.id)) return false;
      const p = effectivePrice(z);
      if (filters.minPrice > 0 && (p == null || p < filters.minPrice)) return false;
      if (filters.maxPrice > 0 && (p == null || p > filters.maxPrice)) return false;
      if (filters.amenities.length) {
        const amens = (z.amenities || []).map(a => a.toLowerCase());
        const hasAll = filters.amenities.every(a => amens.some(x => x.includes(a.toLowerCase()) || a.toLowerCase().includes(x)));
        if (!hasAll) return false;
      }
      return true;
    });
    const ratingOf = (z) => reviewsMap[z.id]?.avg ?? null;
    if (filters.sort === 'price_asc') out.sort((a, b) => (effectivePrice(a) ?? Infinity) - (effectivePrice(b) ?? Infinity));
    else if (filters.sort === 'price_desc') out.sort((a, b) => (effectivePrice(b) ?? -Infinity) - (effectivePrice(a) ?? -Infinity));
    else if (filters.sort === 'rating') out.sort((a, b) => (ratingOf(b) ?? -1) - (ratingOf(a) ?? -1));
    else out.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    return out;
  }, [zimmers, filters, bookedIds, reviewsMap]);

  const list = aiMode ? aiList : manualList;
  const searchDates = (filters.start && filters.end)
    ? { checkIn: filters.start, checkOut: filters.end, start: filters.start, end: filters.end, numGuests: filters.numGuests }
    : null;

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      {/* AI mode header */}
      {aiMode ? (
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2" style={{ color: '#0B3838' }}>
              <Sparkles size={18} style={{ color: '#F97316' }} />
              {filterIds ? 'תוצאות בהתאמה מדויקת' : 'הצימרים שלנו'}
            </h1>
            <p className="text-sm mt-1 flex items-center gap-1" style={{ color: '#9CA3AF' }}>
              <MapPin size={13} />
              {filterIds
                ? `${list.length} צימרים נבחרו עבורך על ידי החיפוש החכם — לחץ על כרטיס לפרטים והזמנה`
                : "חפש בצ'אט הצמוד כדי לראות תוצאות מדויקות, או עבור לסינון ידני"}
            </p>
          </div>
          <button onClick={onResetAI}
            className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838', border: '1.5px solid rgba(11,56,56,0.15)' }}>
            <SlidersHorizontal size={15} /> סינון ידני
          </button>
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                <SlidersHorizontal size={18} style={{ color: '#0B3838' }} /> סינון ידני
              </h1>
              <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>בחר את המסננים ומצא את הצימר המתאים</p>
            </div>
            <button onClick={onBackToAI}
              className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C', border: '1.5px solid rgba(249,115,22,0.2)' }}>
              <RotateCcw size={15} /> חזרה לחיפוש AI
            </button>
          </div>
          <ZimmerPageFilters filters={filters} onChange={setFilters} onReset={() => setFilters(DEFAULT_FILTERS)} resultCount={manualList.length} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={26} className="animate-spin" style={{ color: '#0B3838' }} />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <MapPin size={28} className="mx-auto mb-2" style={{ color: '#9CA3AF' }} />
          <p className="text-sm font-semibold" style={{ color: '#6B7280' }}>
            {aiMode && filterIds ? 'לא נמצאו צימרים תואמים לחיפוש' : 'לא נמצאו צימרים תואמים'}
          </p>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
            {aiMode ? "נסה לשנות את החיפוש בצ'אט" : 'נסה לשנות את הסינון או לאפס סינונים'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map(z => (
            <ZimmerBrowseCard key={z.id} zimmer={z} rating={reviewsMap[z.id]} onClick={() => onSelect(z, searchDates)} />
          ))}
        </div>
      )}
    </div>
  );
}