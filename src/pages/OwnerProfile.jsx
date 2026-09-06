import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { ArrowRight, Heart, Play, ShoppingCart } from 'lucide-react';
import BookingForm from '@/components/chat/BookingForm';
import VideoErrorBoundary from '@/components/discover/VideoErrorBoundary';
import VideoToast from '@/components/discover/VideoToast';

// Single video cell — autoplays when active, pauses otherwise.
function VideoItem({ video, isActive, onLike, onBook, isAuthed, toast, onCloseToast }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isActive) { try { el.currentTime = 0; } catch {} el.play().catch(() => {}); }
    else { try { el.pause(); } catch {} }
  }, [isActive]);
  return (
    <div className="relative rounded-2xl overflow-hidden bg-neutral-900" style={{ aspectRatio: '9 / 16' }}>
      <video ref={ref} src={video.video_url} className="w-full h-full object-cover" muted loop playsInline preload="metadata" />
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: '60%', background: 'linear-gradient(to top, rgba(0,0,0,0.82) 8%, rgba(0,0,0,0.2) 50%, transparent 100%)' }} />
      <div className="absolute z-10" style={{ bottom: 64, left: 6 }}>
        <button onClick={onLike} className="flex flex-col items-center gap-0.5">
          <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <Heart size={18} fill={video.liked ? '#ff2d55' : 'transparent'} color={video.liked ? '#ff2d55' : '#fff'} />
          </span>
          <span className="text-white text-[10px] font-semibold">{video.likes_count || 0}</span>
        </button>
      </div>
      <div className="absolute z-10" style={{ bottom: 8, left: 0, right: 44, padding: '0 8px' }}>
        <p className="text-white font-bold text-xs mb-0.5 truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>{video.zimmer_name || ''}</p>
        {video.caption && <p className="text-white/85 text-[11px] leading-snug line-clamp-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{video.caption}</p>}
        <button onClick={onBook}
          className="mt-1.5 inline-flex items-center gap-1 text-white text-[11px] font-bold px-3 py-1.5 rounded-full transition-transform active:scale-95"
          style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 4px 12px rgba(249,115,22,0.4)' }}>
          <ShoppingCart size={12} /> הזמן
        </button>
      </div>

      {toast && <VideoToast toast={toast} onClose={onCloseToast} />}
    </div>
  );
}

// Public owner profile page — shows the videos an owner has uploaded.
// Reached from the Discover feed by tapping an owner's avatar/name.
// Public RLS returns only non-hidden videos for this owner.
export default function OwnerProfile() {
  const { ownerId } = useParams();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState('');
  const [ownerAvatar, setOwnerAvatar] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [bookingZimmer, setBookingZimmer] = useState(null);
  const [bookingSourceVideoId, setBookingSourceVideoId] = useState(null);
  const [bookingMsg, setBookingMsg] = useState(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [toast, setToast] = useState(null);
  const cardRefs = useRef({});

  const showToast = useCallback((message, type = 'error') => {
    setToast({ id: Date.now(), message, type });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Use the public feed function so we get the viewer's `liked` state per
      // video (RLS blocks a direct VideoLike read for non-admins).
      const res = await api.functions.invoke('getVideoFeed', {});
      const data = res.data || res;
      const all = data.videos || [];
      const mine = all.filter(v => v.owner_id === ownerId);
      const sorted = mine.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setVideos(sorted);
      if (sorted[0]) {
        setOwnerName(sorted[0].owner_name || 'בעל צימר');
        setOwnerAvatar(sorted[0].owner_avatar_url || '');
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  }, [ownerId]);

  useEffect(() => {
    document.title = 'פרופיל בעל צימר · ZimmerBot';
    load();
    api.auth.isAuthenticated().then(setIsAuthed).catch(() => setIsAuthed(false));
  }, [load]);

  // Autoplay only the most-visible card.
  useEffect(() => {
    if (!videos.length) return;
    const observer = new IntersectionObserver((entries) => {
      let best = null; let bestRatio = 0;
      for (const en of entries) {
        if (en.intersectionRatio > bestRatio) { best = en; bestRatio = en.intersectionRatio; }
      }
      if (best && bestRatio >= 0.5) setActiveId(best.target.dataset.id);
    }, { threshold: [0.5, 0.75] });
    Object.values(cardRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [videos]);

  const handleLike = async (video) => {
    if (!isAuthed) {
      showToast('כדי לעשות לייק צריך להתחבר. לעבור להתחברות?', 'auth');
      return;
    }
    const wasLiked = !!video.liked;
    const oldCount = video.likes_count || 0;
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
  };

  const handleBookNow = async (video) => {
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
  };

  const handleBookingSubmit = async (data, zimmer) => {
    setSubmittingBooking(true);
    try {
      await api.entities.BookingRequest.create({
        zimmer_id: zimmer.id, zimmer_name: zimmer.name, owner_id: zimmer.owner_id,
        ...data, source_video_id: bookingSourceVideoId || null, status: 'ממתינה',
      });
      setBookingZimmer(null); setBookingSourceVideoId(null);
      setBookingMsg('✅ בקשת ההזמנה נשלחה! בעל הצימר יצור איתך קשר בקרוב.');
    } catch (e) { showToast('שגיאה בשליחת ההזמנה. נסה שוב.', 'error'); }
    finally { setSubmittingBooking(false); }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto" dir="rtl" style={{ background: '#000', color: '#fff', fontFamily: 'Heebo, sans-serif' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate('/discover')}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          <ArrowRight size={18} />
        </button>
        <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.7)' }}>
          {ownerAvatar
            ? <img src={ownerAvatar} alt="" className="w-full h-full object-cover" />
            : (ownerName?.[0] || 'Z')}
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-base truncate">{ownerName || 'בעל צימר'}</h1>
          <p className="text-white/50 text-xs">{videos.length} סרטונים · גלו</p>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center px-6 py-24">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(249,115,22,0.15)' }}>
            <Play size={26} style={{ color: '#F97316' }} />
          </div>
          <p className="font-semibold">אין עדיין סרטונים ציבוריים</p>
          <p className="text-white/50 text-sm mt-1">הסרטונים של בעל הצימר הזה יופיעו כאן ברגע שיעלה אותם.</p>
        </div>
      ) : (
        <div className="px-3 py-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {videos.map((v) => (
            <div key={v.id} data-id={v.id} ref={(el) => (cardRefs.current[v.id] = el)}>
              <VideoErrorBoundary callerName={`OwnerVideoItem#${v.id}`}>
                <VideoItem video={v} isActive={activeId === v.id} isAuthed={isAuthed}
                  onLike={() => handleLike(v)} onBook={() => handleBookNow(v)}
                  toast={activeId === v.id ? toast : null} onCloseToast={closeToast} />
              </VideoErrorBoundary>
            </div>
          ))}
        </div>
      )}

      {/* Booking modal */}
      {bookingZimmer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setBookingZimmer(null)}>
          <div className="w-full sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <BookingForm zimmer={bookingZimmer} onSubmit={handleBookingSubmit} onClose={() => setBookingZimmer(null)} />
          </div>
        </div>
      )}
      {bookingMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setBookingMsg(null)}>
          <div className="rounded-2xl p-8 max-w-sm text-center" style={{ background: '#fff' }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 12l4 4 10-10" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="text-sm font-semibold mb-4" style={{ color: '#1A1A1A' }}>{bookingMsg}</p>
            <button onClick={() => setBookingMsg(null)} className="text-white text-sm font-bold px-6 py-2.5 rounded-xl" style={{ background: '#F97316' }}>סגור</button>
          </div>
        </div>
      )}
    </div>
  );
}