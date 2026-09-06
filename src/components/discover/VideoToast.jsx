import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// In-card toast for the Discover feed — absolute inside the active card so it
// does not escape when snapping between videos. Auto-dismisses, with a close
// button (error) or a "התחבר" action (auth).
export default function VideoToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const ms = toast.type === 'auth' ? 6000 : 3500;
    const t = setTimeout(onClose, ms);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  const isAuth = toast.type === 'auth';
  const bg = isAuth ? 'rgba(249,115,22,0.92)' : 'rgba(20,20,22,0.92)';

  return (
    <div
      className="absolute z-40 flex items-center gap-2 rounded-2xl"
      style={{
        top: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100% - 32px)',
        padding: '10px 12px',
        background: bg,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${isAuth ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)'}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
      role="alert"
      aria-live="polite"
      dir="rtl"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-white text-sm font-medium flex-1 leading-snug">{toast.message}</p>
      {isAuth ? (
        <button
          onClick={() => { window.location.href = '/login'; }}
          className="text-white text-sm font-bold px-3 rounded-xl whitespace-nowrap flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.22)', minWidth: 40, minHeight: 40 }}
        >
          התחבר
        </button>
      ) : (
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white flex items-center justify-center rounded-lg"
          style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, background: 'rgba(255,255,255,0.08)' }}
          aria-label="סגור"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}