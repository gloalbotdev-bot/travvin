import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/api/client';
import { useNavigate } from 'react-router-dom';
import VideoCard from '@/components/discover/VideoCard';
import CommentsSheet from '@/components/discover/CommentsSheet';
import VideoErrorBoundary from '@/components/discover/VideoErrorBoundary';
import BookingForm from '@/components/chat/BookingForm';


const MAX_DURATION = 45;

// score = (likes+1) × recency_boost × random(0.7–1.3) — recomputed per load,
// stable during scroll.
function computeScore(v) {
  const likes = (v.likes_count || 0) + 1;
  const ageDays = v.created_date ? (Date.now() - new Date(v.created_date).getTime()) / 86400000 : 999;
  const recency = ageDays <= 7 ? 1.5 : 1;
  const rand = 0.7 + Math.random() * 0.6;
  return likes * recency * rand;
}

export default function VideoFeed() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAuthed, setIsAuthed] = useState(false);
  const [commentsFor, setCommentsFor] = useState(null);   // video
  const [bookingZimmer, setBookingZimmer] = useState(null); // full zimmer object
  const [bookingSourceVideoId, setBookingSourceVideoId] = useState(null);
  const [bookingMsg, setBookingMsg] = useState(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [toast, setToast] = useState(null); // { id, message, type: 'error' | 'auth' | 'success' }
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('discover_muted') === 'true'; } catch { return false; } });

  const showToast = useCallback((message, type = 'error') => {
    setToast({ id: Date.now(), message, type });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  const containerRef = useRef(null);
  const itemRefs = useRef([]);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.functions.invoke('getVideoFeed', {});
      const data = res.data || res;
      let list = data.videos || [];
      list = list.map((v) => ({ ...v, _score: computeScore(v) }))
        .sort((a, b) => b._score - a._score);
      setVideos(list);
    } catch (e) {
      setError('לא הצלחנו לטעון את הפיד. נסה שוב.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.auth.isAuthenticated().then(setIsAuthed).catch(() => setIsAuthed(false));
  }, [load]);

  useEffect(() => { try { localStorage.setItem('discover_muted', String(muted)); } catch {} }, [muted]);

  // Track the active item via IntersectionObserver for autoplay + windowing.
  useEffect(() => {
    if (!videos.length) return;
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      let best = null;
      let bestRatio = 0;
      for (const en of entries) {
        if (en.intersectionRatio > bestRatio) { best = en; bestRatio = en.intersectionRatio; }
      }
      if (best) {
        const idx = Number(best.target.dataset.index);
        if (!Number.isNaN(idx)) setActiveIndex(idx);
      }
    }, { root, threshold: [0.5, 0.75] });
    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [videos]);

  const handleLike = useCallback(async (video) => {
    if (!isAuthed) {
      showToast('כדי לעשות לייק צריך להתחבר. לעבור להתחברות?', 'auth');
      return;
    }
    const wasLiked = !!video.liked;
    const oldCount = video.likes_count || 0;
    // optimistic
    setVideos((prev) => prev.map((v) => v.id === video.id
      ? { ...v, liked: !wasLiked, likes_count: Math.max(0, oldCount + (wasLiked ? -1 : 1)) }
      : v));
    try {
      const res = await api.functions.invoke('toggleVideoLike', { video_id: video.id });
      const d = (res && (res.data || res)) || {};
      setVideos((prev) => prev.map((v) => v.id === video.id
        ? { ...v, liked: !!d.liked, likes_count: typeof d.likes_count === 'number' ? d.likes_count : v.likes_count }
        : v));
    } catch (e) {
      // revert to the exact pre-toggle state
      setVideos((prev) => prev.map((v) => v.id === video.id
        ? { ...v, liked: wasLiked, likes_count: oldCount }
        : v));
      const status = e?.status || e?.response?.status;
      if (status === 401) {
        setIsAuthed(false);
        showToast('החיבור פג תוקף. התחבר מחדש כדי לסמן לייק.', 'auth');
      } else {
        const raw = e?.response?.data?.error || e?.message || e?.error?.message || e?.error || 'שגיאה בעדכון הלייק. נסה שוב.';
        showToast(typeof raw === 'string' ? raw : 'שגיאה בעדכון הלייק. נסה שוב.', 'error');
      }
    }
  }, [isAuthed, showToast]);

  const handleBookNow = useCallback(async (video) => {
    if (!isAuthed) {
      showToast('כדי להזמין צריך להתחבר. לעבור להתחברות?', 'auth');
      return;
    }
    try {
      const zimmer = await api.entities.Zimmer.get(video.zimmer_id);
      if (!zimmer) { showToast('הצימר לא נמצא.', 'error'); return; }
      setBookingSourceVideoId(video.id);
      setBookingZimmer(zimmer);
      setBookingMsg(null);
    } catch (e) {
      showToast('לא הצלחנו לפתוח את טופס ההזמנה. נסה שוב.', 'error');
    }
  }, [isAuthed, showToast]);

  const handleBookingSubmit = useCallback(async (data, zimmer) => {
    setSubmittingBooking(true);
    try {
      await api.entities.BookingRequest.create({
        zimmer_id: zimmer.id,
        zimmer_name: zimmer.name,
        owner_id: zimmer.owner_id,
        ...data,
        source_video_id: bookingSourceVideoId || null,
        status: 'ממתינה',
      });
      setBookingZimmer(null);
      setBookingSourceVideoId(null);
      setBookingMsg('✅ בקשת ההזמנה נשלחה! בעל הצימר יצור איתך קשר בקרוב.');
    } catch (e) {
      showToast('שגיאה בשליחת ההזמנה. נסה שוב.', 'error');
    } finally {
      setSubmittingBooking(false);
    }
  }, [bookingSourceVideoId, showToast]);

  if (loading) return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#000' }}>
      <div className="w-8 h-8 border-2 border-gray-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6" style={{ background: '#000' }}>
      <p className="text-gray-300 text-sm mb-4">{error}</p>
      <button onClick={load} className="text-white text-sm font-semibold px-5 py-2.5 rounded-xl" style={{ background: '#F97316' }}>נסה שוב</button>
    </div>
  );

  if (videos.length === 0) return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6" style={{ background: '#000' }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(249,115,22,0.15)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M15 10l-5 5m0-5l5 5M3 8l4-4h10l4 4v8l-4 4H7l-4-4V8z" stroke="#F97316" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <p className="text-gray-300 font-semibold">אין עדיין סרטונים בפיד</p>
      <p className="text-gray-500 text-sm mt-1">בעלי צימרים יכולים להעלות סרטונים מפאנל הניהול שלהם.</p>
    </div>
  );

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 overflow-y-auto snap-y snap-mandatory discover-feed-scroll">
        {videos.map((v, i) => (
          <div key={v.id} data-index={i} ref={(el) => (itemRefs.current[i] = el)}
            className="snap-start" style={{ height: '100%', position: 'relative', scrollSnapStop: 'always' }}>
            <VideoErrorBoundary callerName={`VideoCard#${i}`}>
              <VideoCard
                video={v}
                isActive={i === activeIndex}
                isNext={i === activeIndex + 1}
                isAuthed={isAuthed}
                onLike={handleLike}
                onOpenComments={() => setCommentsFor(v)}
                onOpenOwner={() => navigate(`/discover/owner/${v.owner_id}`)}
                onBookNow={() => handleBookNow(v)}
                toast={i === activeIndex ? toast : null}
                onCloseToast={closeToast}
                muted={muted}
                onToggleMute={() => setMuted(m => !m)}
              />
            </VideoErrorBoundary>
          </div>
        ))}
      </div>

      {commentsFor && (
        <CommentsSheet video={commentsFor} onClose={() => setCommentsFor(null)} />
      )}

      {bookingZimmer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(0,0,0,0.7)' }} dir="rtl" onClick={() => setBookingZimmer(null)}>
          <div className="w-full sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <BookingForm zimmer={bookingZimmer} onSubmit={handleBookingSubmit} onClose={() => setBookingZimmer(null)} />
          </div>
        </div>
      )}
      {bookingMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setBookingMsg(null)}>
          <div className="rounded-2xl p-8 max-w-sm text-center" style={{ background: '#fff' }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 12l4 4 10-10" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p className="text-sm font-semibold mb-4" style={{ color: '#1A1A1A' }}>{bookingMsg}</p>
            <button onClick={() => setBookingMsg(null)} className="text-white text-sm font-bold px-6 py-2.5 rounded-xl" style={{ background: '#F97316' }}>סגור</button>
          </div>
        </div>
      )}
    </>
  );
}