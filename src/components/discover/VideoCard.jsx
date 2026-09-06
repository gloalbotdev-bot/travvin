import React, { useRef, useEffect, useState } from 'react';
import { Heart, MessageCircle, ShoppingCart, Volume2, VolumeX, Play, Share } from 'lucide-react';
import VideoToast from '@/components/discover/VideoToast';
import ShareSheet from '@/components/discover/ShareSheet';
import TravvinEndCard from '@/components/discover/TravvinEndCard';
import VideoShareBlocks from '@/components/discover/VideoShareBlocks';

// A single TikTok-style video card. Windowing: the <video> element is only
// mounted for the active item and the next one (preload). Inactive items get
// a lightweight placeholder so long feeds stay smooth on mobile.
// On video end, a ~2s branded end card plays before the video loops again.
export default function VideoCard({ video, isActive, isNext, isAuthed, onLike, onOpenComments, onOpenOwner, onBookNow, toast, onCloseToast, muted = false, onToggleMute }) {
  const videoRef = useRef(null);
  const cover = video.zimmer_images?.[0];
  const [paused, setPaused] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showEndCard, setShowEndCard] = useState(false);

  // Autoplay when becoming active; pause when leaving.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.currentTime = 0;
      setShowEndCard(false);
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => setPaused(false)).catch(() => setPaused(true));
      } else {
        setPaused(false);
      }
    } else {
      try { el.pause(); } catch {}
      setShowEndCard(false);
    }
  }, [isActive]);

  // Sync muted state to the video element (React's `muted` prop is unreliable as a controlled attribute).
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const togglePlayPause = (e) => {
    if (e) e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setPaused(false);
      setShowEndCard(false);
    } else {
      el.pause();
      setPaused(true);
    }
  };

  // On video end: show the branded end card for ~2s, then replay (loop).
  const handleEnded = () => {
    if (!isActive) return;
    setShowEndCard(true);
    setTimeout(() => {
      const el = videoRef.current;
      setShowEndCard(false);
      if (el) { el.currentTime = 0; el.play().catch(() => {}); setPaused(false); }
    }, 2000);
  };

  const Avatar = ({ size = 44 }) => (
    <button onClick={(e) => { e.stopPropagation(); onOpenOwner(); }}
      className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold"
      style={{ width: size, height: size, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.8)', color: '#fff' }}>
      {video.owner_avatar_url
        ? <img src={video.owner_avatar_url} alt="" className="w-full h-full object-cover" />
        : (video.owner_name?.[0] || 'Z')}
    </button>
  );

  return (
    <div className="absolute inset-0" style={{ background: '#000' }} onClick={togglePlayPause}>
      {/* Video or placeholder */}
      {(isActive || isNext) ? (
        <video
          ref={videoRef}
          src={video.video_url}
          className="w-full h-full object-cover"
          muted={muted}
          playsInline
          autoPlay={isActive}
          preload={isNext ? 'auto' : 'metadata'}
          onEnded={handleEnded}
          style={{ objectPosition: 'center' }}
        />
      ) : cover ? (
        <img src={cover} alt="" className="w-full h-full object-cover opacity-60" />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(180deg,#1a1a1a,#000)' }}>
          <p className="text-gray-600 text-sm">{video.zimmer_name}</p>
        </div>
      )}

      {/* Play icon overlay when paused */}
      {paused && !showEndCard && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <Play size={30} className="text-white" fill="white" />
          </div>
        </div>
      )}

      {/* End-of-video branded card */}
      {showEndCard && <TravvinEndCard />}

      {/* bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: '55%', background: 'linear-gradient(to top, rgba(0,0,0,0.78) 5%, rgba(0,0,0,0.25) 45%, transparent 100%)' }} />

      {/* Glass action rail — mute + like + comment + share (RTL: physical right) */}
      <div className="absolute z-20 flex flex-col items-center gap-1 p-2 rounded-3xl"
        style={{ bottom: 96, right: 12, background: 'rgba(20,20,22,0.45)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
        <button onClick={(e) => { e.stopPropagation(); onToggleMute && onToggleMute(); }} className="flex flex-col items-center gap-1 py-1" style={{ minHeight: 56 }}>
          <span className="w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90">
            {muted ? <VolumeX size={24} color="#fff" /> : <Volume2 size={24} color="#fff" />}
          </span>
        </button>
        <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.15)', margin: '2px 0' }} />
        <button onClick={(e) => { e.stopPropagation(); onLike(video); }} className="flex flex-col items-center gap-1 py-1" style={{ minHeight: 56 }}>
          <span className="w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90">
            <Heart size={26} fill={video.liked ? '#ff2d55' : 'transparent'} color={video.liked ? '#ff2d55' : '#fff'} />
          </span>
          <span className="text-white text-[11px] font-semibold">{video.likes_count || 0}</span>
        </button>
        <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.15)', margin: '2px 0' }} />
        <button onClick={(e) => { e.stopPropagation(); onOpenComments(); }} className="flex flex-col items-center gap-1 py-1" style={{ minHeight: 56 }}>
          <span className="w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90">
            <MessageCircle size={24} color="#fff" />
          </span>
          <span className="text-white text-[11px] font-semibold">{video.reviews_count || 0}</span>
        </button>
        <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.15)', margin: '2px 0' }} />
        <button onClick={(e) => { e.stopPropagation(); setShowShare(true); }} className="flex flex-col items-center gap-1 py-1" style={{ minHeight: 56 }}>
          <span className="w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90">
            <Share size={24} color="#fff" />
          </span>
          <span className="text-white text-[11px] font-semibold">שתף</span>
        </button>
      </div>

      {/* Local in-card toast (only on the active card) */}
      {toast && <VideoToast toast={toast} onClose={onCloseToast} />}

      {/* Bottom info (left side, leaves room for rail on the right) */}
      <div className="absolute z-20" style={{ bottom: 72, left: 0, right: 70, padding: '0 16px' }}>
        <div className="flex items-center gap-2 mb-2">
          <Avatar size={40} />
          <button onClick={(e) => { e.stopPropagation(); onOpenOwner(); }} className="text-white font-semibold text-sm hover:underline" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            {video.owner_name}
          </button>
        </div>
        <p className="text-white font-bold text-base mb-0.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{video.zimmer_name}</p>
        {video.zimmer_location && <p className="text-white/80 text-xs mb-1" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>📍 {video.zimmer_location}</p>}
        {video.caption && <p className="text-white/90 text-sm leading-snug line-clamp-2" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{video.caption}</p>}

        <button onClick={(e) => { e.stopPropagation(); onBookNow(); }}
          className="mt-3 inline-flex items-center gap-2 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-transform active:scale-95"
          style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 6px 18px rgba(249,115,22,0.4)' }}>
          <ShoppingCart size={15} /> הזמן עכשיו
        </button>

        {/* Two copyable share blocks: availability text + zimmer page URL */}
        <VideoShareBlocks video={video} />
      </div>

      {/* Share bottom sheet */}
      {showShare && <ShareSheet video={video} onClose={() => setShowShare(false)} />}
    </div>
  );
}