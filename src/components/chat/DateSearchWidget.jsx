import React, { useState } from 'react';
import { Calendar, Users, Search, Wallet, Sparkles, MapPin } from 'lucide-react';
import { REGION_OPTIONS } from '@/lib/regions';
import { ownFetch } from '@/api/own/http';
import DateRangeField from '@/components/common/DateRangeField';

// Checks if two date ranges overlap (inclusive nights)
export function datesOverlap(checkIn1, checkOut1, checkIn2, checkOut2) {
  const a1 = new Date(checkIn1);
  const a2 = new Date(checkOut1);
  const b1 = new Date(checkIn2);
  const b2 = new Date(checkOut2);
  return a1 < b2 && a2 > b1;
}

/** Busy ranges without PII — public /api/bookings/busy */
async function fetchBusyRanges(zimmerId) {
  const q = zimmerId ? `?zimmer_id=${encodeURIComponent(zimmerId)}` : '';
  const data = await ownFetch(`/api/bookings/busy${q}`, { method: 'GET', auth: false });
  return Array.isArray(data) ? data : [];
}

// Returns booked zimmer IDs for a given date range
export async function getBookedZimmerIds(_client, checkIn, checkOut) {
  const bookings = await fetchBusyRanges();
  return bookings
    .filter(b => datesOverlap(checkIn, checkOut, b.check_in, b.check_out))
    .map(b => b.zimmer_id);
}

// Returns booked date ranges (check_in/check_out) for a specific zimmer
export async function getBookedRangesForZimmer(_client, zimmerId) {
  if (!zimmerId) return [];
  const bookings = await fetchBusyRanges(zimmerId);
  return bookings
    .filter(b => b.check_in && b.check_out)
    .map(b => ({ check_in: b.check_in, check_out: b.check_out }));
}

// Master list of amenities customers can filter by.
export const AMENITY_LIST = [
  'בריכה מחוממת ומקורה',
  "ג'קוזי ספא",
  'בריכה פרטית',
  'נוף לים / נוף פתוח',
  'מכונת קפה',
  'עמדת מנגל / גריל גז',
  'מטבח חוץ',
  'שולחן סנוקר / ביליארד',
  'שולחן פינג פונג',
  'סאונה יבשה / רטובה',
  'מיטות שיזוף',
  'ערסלים ופינות רביצה',
  'קמין עצים / גז',
  'טלוויזיות חכמות עם נטפליקס',
  'מערכת שמע / רמקולים',
  'מקרן קולנוע ביתי',
  'קונסולת משחקים',
  'משחקי שולחן',
  'מתקנים לילדים',
  'טרמפולינה',
  'מקרר ומקפיא',
  'מדיח כלים',
  'בר מים',
  'תנור אפייה וכיריים',
  'Wi-Fi מהיר',
  'חדר רחצה צמוד לכל חדר שינה',
  'מגבות וחלוקי רחצה',
  'מיטות קינג סייז',
  'ציוד לשבת (פלטה, מיחם)',
];

export default function DateSearchWidget({ onSearch, mode = 'exact', initialAmenities = [] }) {
  const [searchMode, setSearchMode] = useState(mode); // 'exact' | 'flexible'
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [numNights, setNumNights] = useState(2);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [numAdults, setNumAdults] = useState(2);
  const [numChildren, setNumChildren] = useState(0);
  const [maxBudget, setMaxBudget] = useState('');
  const [amenities, setAmenities] = useState(new Set(initialAmenities));
  const [showAmenities, setShowAmenities] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState(new Set());
  const [showRegions, setShowRegions] = useState(false);
  const [freeText, setFreeText] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const toggleAmenity = (a) => setAmenities(prev => {
    const n = new Set(prev);
    if (n.has(a)) n.delete(a); else n.add(a);
    return n;
  });

  const toggleRegion = (r) => setSelectedRegions(prev => {
    const n = new Set(prev);
    if (n.has(r)) n.delete(r); else n.add(r);
    return n;
  });
  const allRegions = selectedRegions.size === REGION_OPTIONS.length;
  const toggleAllRegions = () => setSelectedRegions(allRegions ? new Set() : new Set(REGION_OPTIONS));

  const handleSubmit = (e) => {
    e.preventDefault();
    const numGuests = (parseInt(numAdults) || 0) + (parseInt(numChildren) || 0);
    if (numGuests < 1) return;
    const budget = maxBudget ? parseInt(maxBudget) : null;
    const amens = Array.from(amenities);
    const regs = Array.from(selectedRegions);
    const ft = freeText.trim();
    if (searchMode === 'exact') {
      if (!checkIn || !checkOut) return;
      onSearch({ mode: 'exact', checkIn, checkOut, numGuests, num_adults: parseInt(numAdults) || 0, num_children: parseInt(numChildren) || 0, max_budget: budget, amenities: amens, regions: regs, freeText: ft });
    } else {
      if (!rangeStart || !rangeEnd || !numNights) return;
      onSearch({ mode: 'flexible', rangeStart, rangeEnd, numNights: parseInt(numNights), numGuests, num_adults: parseInt(numAdults) || 0, num_children: parseInt(numChildren) || 0, max_budget: budget, amenities: amens, regions: regs, freeText: ft });
    }
  };

  const minCheckOut = checkIn
    ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0]
    : today;

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100" dir="rtl">
      <div className="bg-[#075E54] text-white px-4 py-3">
        <div className="font-semibold text-sm flex items-center gap-2"><Calendar size={15} /> בחר תאריכים לחיפוש</div>
        <div className="text-xs text-green-200 mt-0.5">כדי להציג רק צימרים פנויים</div>
      </div>

      {/* Mode Toggle */}
      <div className="flex border-b border-gray-100">
        <button
          type="button"
          onClick={() => setSearchMode('exact')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${searchMode === 'exact' ? 'bg-green-50 text-green-700 border-b-2 border-green-500' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📅 תאריכים מדויקים
        </button>
        <button
          type="button"
          onClick={() => setSearchMode('flexible')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${searchMode === 'flexible' ? 'bg-green-50 text-green-700 border-b-2 border-green-500' : 'text-gray-500 hover:text-gray-700'}`}
        >
          🔀 חיפוש גמיש
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {searchMode === 'exact' ? (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">תאריכי שהייה</label>
            <DateRangeField
              start={checkIn}
              end={checkOut}
              onChange={(s, e) => { setCheckIn(s); setCheckOut(e); }}
              min={today}
              placeholder="בחר כניסה ויציאה"
              className=""
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">מספר לילות</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 7].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumNights(n)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${numNights === n ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">טווח תאריכים אפשרי</label>
              <DateRangeField
                start={rangeStart}
                end={rangeEnd}
                onChange={(s, e) => { setRangeStart(s); setRangeEnd(e); }}
                min={today}
                placeholder="בחר טווח תאריכים"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1"><Users size={12} /> מבוגרים</label>
            <input
              required
              type="number"
              min={1}
              max={30}
              value={numAdults}
              onChange={e => setNumAdults(parseInt(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1"><Users size={12} /> ילדים</label>
            <input
              type="number"
              min={0}
              max={30}
              value={numChildren}
              onChange={e => setNumChildren(parseInt(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
            />
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1"><Wallet size={12} /> תקציב מקסימלי ללילה (₪)</label>
          <input
            type="number"
            min={0}
            value={maxBudget}
            onChange={e => setMaxBudget(e.target.value)}
            placeholder="ללא הגבלה"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
          />
        </div>

        {/* Region / area selection */}
        <div>
          <button
            type="button"
            onClick={() => setShowRegions(s => !s)}
            className="w-full flex items-center justify-between text-xs font-medium text-gray-600 py-1.5"
          >
            <span className="flex items-center gap-1.5"><MapPin size={12} /> אזור</span>
            <span className="text-xs">
              {selectedRegions.size > 0 ? `${selectedRegions.size} נבחרו ▾` : 'בחר אזורים ▾'}
            </span>
          </button>
          {showRegions && (
            <div className="pt-1 border-t border-gray-100 mt-1">
              <button
                type="button"
                onClick={toggleAllRegions}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg mb-1.5 transition-all"
                style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}
              >
                {allRegions ? 'בטל בחירת הכל' : 'סמן את כל האזורים'}
              </button>
              <div className="flex flex-wrap gap-1.5">
                {REGION_OPTIONS.map(r => {
                  const on = selectedRegions.has(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRegion(r)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? 'bg-green-500 text-white border-green-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-green-300'}`}
                    >
                      {on ? '✓ ' : ''}{r}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="...או הקלד אזור/מקום חופשי"
                className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
              />
            </div>
          )}
        </div>

        {/* Amenities */}
        <div>
          <button
            type="button"
            onClick={() => setShowAmenities(s => !s)}
            className="w-full flex items-center justify-between text-xs font-medium text-gray-600 py-1.5"
          >
            <span className="flex items-center gap-1.5"><Sparkles size={12} /> מה חשוב לך? (מתקנים)</span>
            <span className="text-xs">
              {amenities.size > 0 ? `${amenities.size} נבחרו ▾` : 'בחר מתקנים ▾'}
            </span>
          </button>
          {showAmenities && (
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pt-1 border-t border-gray-100 mt-1">
              {AMENITY_LIST.map(a => {
                const on = amenities.has(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? 'bg-green-500 text-white border-green-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-green-300'}`}
                  >
                    {on ? '✓ ' : ''}{a}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Search size={15} /> חפש צימרים פנויים
        </button>
      </form>
    </div>
  );
}