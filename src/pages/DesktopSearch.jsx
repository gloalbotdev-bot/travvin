import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import SearchChat from '@/components/desktop/SearchChat';
import ResultsList from '@/components/desktop/ResultsList';
import SearchMap from '@/components/desktop/SearchMap';
import ZimmerDetailDrawer from '@/components/chat/ZimmerDetailDrawer';
import BookingForm from '@/components/chat/BookingForm';
import DirectChat, { getOrCreateDirectThread } from '@/components/chat/DirectChat';
import { getBookedZimmerIds, datesOverlap } from '@/components/chat/DateSearchWidget';

export default function DesktopSearch() {
  const [user, setUser] = useState(null);
  const [results, setResults] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
  const [selectedZimmer, setSelectedZimmer] = useState(null);
  const [bookingZimmer, setBookingZimmer] = useState(null);
  const [coordsCache, setCoordsCache] = useState({});
  const [directThread, setDirectThread] = useState(null);
  const [askPrefill, setAskPrefill] = useState(null);
  const [bookingMessage, setBookingMessage] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Attach coords from cache to results (for map + list)
  const zimmersWithCoords = results.map((z) => {
    const c = coordsCache[z.location];
    return c ? { ...z, lat: c.lat, lng: c.lng } : z;
  });

  const handleResults = useCallback((zims, meta) => {
    setResults(zims);
    setSearchMeta(meta);
  }, []);

  // On new results, geocode any new addresses
  useEffect(() => {
    if (!results.length) return;
    const uniqueAddresses = Array.from(new Set(results.map((z) => (z.location || '').trim()).filter(Boolean)));
    const pending = uniqueAddresses.filter((a) => !(a in coordsCache));
    if (pending.length === 0) return;
    setCoordsCache((prev) => {
      const next = { ...prev };
      pending.forEach((a) => { if (!(a in next)) next[a] = { lat: null, lng: null, pending: true }; });
      return next;
    });
    (async () => {
      try {
        const res = await base44.functions.invoke('geocodeAddresses', { addresses: pending });
        const out = res?.data?.results || [];
        setCoordsCache((prev) => {
          const next = { ...prev };
          out.forEach((r) => { if (r.address) next[r.address] = { lat: r.lat, lng: r.lng }; });
          pending.forEach((a) => { if (!(a in next)) next[a] = { lat: null, lng: null }; });
          return next;
        });
      } catch (e) {
        // mark as resolved-null so we don't retry forever
        setCoordsCache((prev) => {
          const next = { ...prev };
          pending.forEach((a) => { if (next[a]?.pending) next[a] = { lat: null, lng: null }; });
          return next;
        });
      }
    })();
  }, [results]);

  const loadingCoords = Object.values(coordsCache).some((c) => c.pending);

  const handleSelect = (z) => {
    setSelectedZimmer(z);
    setBookingZimmer(null);
  };

  const handleBook = (z) => {
    setBookingZimmer(z);
  };

  const handleAsk = (z) => {
    setSelectedZimmer(null);
    setAskPrefill(`בנוגע לצימר "${z.name}": `);
  };

  const openDirectChat = async (z) => {
    if (!user) { alert('יש להתחבר כדי לפתוח צ\u05f3אט ישיר.'); return; }
    setSelectedZimmer(null);
    try {
      const t = await getOrCreateDirectThread({ zimmer: z, customer: user });
      setDirectThread(t);
    } catch (e) {
      alert("לא הצלחתי לפתוח צ'אט ישיר. נסה שוב.");
    }
  };

  const handleBookingSubmit = async (data, zimmer) => {
    const bookedIds = await getBookedZimmerIds(base44, data.check_in, data.check_out);
    if (bookedIds.includes(zimmer.id)) {
      setBookingMessage(`⚠️ ${zimmer.name} תפוס בתאריכים האלה. נסה תאריכים אחרים.`);
      setBookingZimmer(null);
      return;
    }
    try {
      await base44.entities.BookingRequest.create({ zimmer_id: zimmer.id, zimmer_name: zimmer.name, owner_id: zimmer.owner_id, ...data, status: 'ממתינה' });
      try {
        const promos = await base44.entities.Promotion.filter({ zimmer_id: zimmer.id, status: 'פעיל' });
        for (const p of promos) if (datesOverlap(data.check_in, data.check_out, p.check_in, p.check_out)) await base44.entities.Promotion.update(p.id, { status: 'נתפס' });
      } catch {}
      setBookingZimmer(null);
      setSelectedZimmer(null);
      setBookingMessage(`✅ בקשת ההזמנה ל-${zimmer.name} התקבלה! בעל הצימר ייצור איתך קשר בקרוב. 🎉`);
    } catch (e) {
      setBookingMessage('לא הצלחתי לשמור את הבקשה. נסה שוב.');
    }
  };

  const prefillDates = searchMeta ? { checkIn: searchMeta.checkIn, checkOut: searchMeta.checkOut, num_adults: searchMeta.numAdults, num_children: searchMeta.numChildren } : null;

  return (
    <div className="h-full w-full flex flex-col lg:flex-row gap-3 p-3 overflow-y-auto lg:overflow-hidden bg-[#F5F5F5]" dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      {/* Chat sidebar */}
      <div className="lg:w-1/4 lg:min-w-[300px] lg:max-w-[420px] h-[68vh] lg:h-auto bg-white rounded-3xl shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-[#F97316] flex items-center justify-center text-white font-bold text-sm">Z</div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-900">ZimmerBot</div>
            <div className="text-[10px] text-gray-500">צ'אט · תוצאות · מפה</div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <SearchChat
            user={user}
            onResults={handleResults}
            onSelectZimmer={handleSelect}
            onBookZimmer={handleBook}
            askPrefill={askPrefill}
            onAskPrefillConsumed={() => setAskPrefill(null)}
            bookingMessage={bookingMessage}
            onBookingMessageShown={() => setBookingMessage(null)}
          />
        </div>
      </div>

      {/* Results list */}
      <div className="lg:w-1/3 lg:min-w-[300px] lg:max-w-[460px] h-[55vh] lg:h-auto bg-white rounded-3xl shadow-sm flex flex-col overflow-hidden">
        <ResultsList zimmers={zimmersWithCoords} selectedId={selectedZimmer?.id} onSelect={handleSelect} loadingCoords={loadingCoords} searchDates={prefillDates} />
      </div>

      {/* Map / action panel */}
      <div className={
        bookingZimmer || directThread
          ? 'fixed inset-0 z-50 h-screen bg-white lg:relative lg:static lg:z-auto lg:flex-1 lg:rounded-3xl lg:overflow-hidden lg:shadow-sm lg:h-auto'
          : 'flex-1 relative rounded-3xl overflow-hidden shadow-sm bg-white h-[50vh] lg:h-auto'
      }>
        {bookingZimmer ? (
          <div className="absolute inset-0 flex flex-col bg-[#F5F5F5]" dir="rtl">
            <div className="flex-1 overflow-y-auto p-4 flex justify-center">
              <div className="w-full max-w-md">
                <BookingForm zimmer={bookingZimmer} onSubmit={handleBookingSubmit} prefillDates={prefillDates} onClose={() => setBookingZimmer(null)} />
              </div>
            </div>
          </div>
        ) : directThread ? (
          <DirectChat thread={directThread} isOwner={false} user={user} counterpartName={directThread.owner_name} zimmerName={directThread.zimmer_name} onClose={() => setDirectThread(null)} inline />
        ) : (
          <>
            <SearchMap zimmers={zimmersWithCoords} selectedId={selectedZimmer?.id} onSelect={handleSelect} />
            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-2xl shadow-md px-3 py-2 text-xs text-gray-700 z-[1000]">
              🏠 {zimmersWithCoords.filter((z) => z.lat).length} מתוך {results.length} צימרים ממוקמים על המפה
            </div>
          </>
        )}
      </div>

      {/* Detail popup */}
      {selectedZimmer && !bookingZimmer && !directThread && (
        <ZimmerDetailDrawer
          zimmer={selectedZimmer}
          onClose={() => setSelectedZimmer(null)}
          onBook={(z) => handleBook(z)}
          onAsk={handleAsk}
          onDirectChat={openDirectChat}
          searchDates={prefillDates}
        />
      )}

    </div>
  );
}