import React, { useState } from 'react';
import { X } from 'lucide-react';

// Bottom sheet with social share buttons. Builds a share text from the video
// (caption + availability + URL) and routes to each platform. For platforms
// without a web share intent (Instagram, TikTok) it copies the text to the
// clipboard and opens the platform so the user can paste.
const PLATFORMS = [
  { id: 'whatsapp', label: 'WhatsApp', color: '#25D366', icon: 'whatsapp' },
  { id: 'facebook', label: 'Facebook', color: '#1877F2', icon: 'facebook' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C', icon: 'instagram' },
  { id: 'tiktok', label: 'TikTok', color: '#fff', icon: 'tiktok' },
];

function PlatformGlyph({ id }) {
  if (id === 'whatsapp') return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.96.57 3.81 1.55 5.38L2 22l4.83-1.65a9.9 9.9 0 0 0 5.21 1.49h.01c5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.93-9.92-9.93zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-2.87.94.96-2.8-.2-.3a8.22 8.22 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.17-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.02 2.57c.12.17 1.75 2.67 4.25 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>;
  if (id === 'facebook') return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>;
  if (id === 'instagram') return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.8c-3.14 0-3.51.01-4.75.07-1.15.05-1.77.24-2.18.4-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.16.41-.35 1.03-.4 2.18-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.05 1.15.24 1.77.4 2.18.21.55.47.94.88 1.35.41.41.8.67 1.35.88.41.16 1.03.35 2.18.4 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c1.15-.05 1.77-.24 2.18-.4.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.16-.41.35-1.03.4-2.18.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.05-1.15-.24-1.77-.4-2.18a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.18-.4-1.24-.06-1.61-.07-4.75-.07zm0 3.06a4.98 4.98 0 1 1 0 9.96 4.98 4.98 0 0 1 0-9.96zm0 1.8a3.18 3.18 0 1 0 0 6.36 3.18 3.18 0 0 0 0-6.36zm5.18-3.2a1.16 1.16 0 1 1-2.32 0 1.16 1.16 0 0 1 2.32 0z"/></svg>;
  if (id === 'tiktok') return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82a4.28 4.28 0 0 1-1.06-2.82h-3.1v12.4a2.6 2.6 0 0 1-2.6 2.54 2.6 2.6 0 0 1-2.6-2.6c0-1.5 1.2-2.6 2.6-2.6.18 0 .36.02.53.06V9.26a5.7 5.7 0 0 0-.53-.03 5.68 5.68 0 1 0 5.68 5.68V8.4a7.36 7.36 0 0 0 4.2 1.32V6.62a4.28 4.28 0 0 1-3.12-.8z"/></svg>;
  return null;
}

export default function ShareSheet({ video, onClose }) {
  const [busy, setBusy] = useState(false);
  const shareUrl = `${window.location.origin}/discover`;
  const parts = [video.caption, video.available_nights_text, shareUrl].filter(Boolean);
  const shareText = parts.join('\n');
  const enc = encodeURIComponent(shareText);
  const urlEnc = encodeURIComponent(shareUrl);

  // WhatsApp's wa.me link cannot attach a media file — it only sends text. To
  // share the actual video we use the native Web Share API with the file,
  // which opens the OS share sheet where the user picks WhatsApp (the video
  // travels with the share). Falls back to the text-only wa.me link when the
  // browser can't share files or the fetch fails.
  const shareWhatsApp = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(video.video_url);
      const blob = await res.blob();
      const file = new File([blob], `travvin-${video.zimmer_name || 'video'}.mp4`, { type: blob.type || 'video/mp4' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText, title: video.zimmer_name || 'TRAVVIN' });
        setBusy(false);
        return;
      }
    } catch (e) { /* fall through to text-only */ }
    setBusy(false);
    window.open(`https://wa.me/?text=${enc}`, '_blank', 'noopener');
  };

  const open = (platform) => {
    if (platform === 'whatsapp') {
      shareWhatsApp();
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${urlEnc}&quote=${enc}`, '_blank', 'noopener');
    } else {
      // Instagram / TikTok have no web share intent — copy text, open platform.
      navigator.clipboard.writeText(shareText).catch(() => {});
      const dest = platform === 'instagram' ? 'https://www.instagram.com' : 'https://www.tiktok.com';
      window.open(dest, '_blank', 'noopener');
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl p-5 pb-7"
        style={{ background: 'rgba(18,18,20,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 -8px 32px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-base">שיתוף</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: '#fff' }}
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => open(p.id)}
              disabled={p.id === 'whatsapp' && busy}
              className="flex flex-col items-center gap-2"
            >
              <span
                className="flex items-center justify-center relative"
                style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.08)', color: p.color, border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {p.id === 'whatsapp' && busy ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <PlatformGlyph id={p.id} />
                )}
              </span>
              <span className="text-white/70 text-[11px] font-medium">{busy && p.id === 'whatsapp' ? 'מכין סרטון…' : p.label}</span>
            </button>
          ))}
        </div>

        <p className="text-white/40 text-[11px] text-center mt-4 leading-relaxed">
          לאינסטגרם וטיקטוק הטקסט יועתק אוטומטית — הדבק אותו באפליקציה.
        </p>
      </div>
    </div>
  );
}