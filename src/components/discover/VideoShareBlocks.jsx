import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

// Two separate glass blocks that sit below the video info, each with its own
// copy button:
//  1) auto availability text ("בשבוע הקרוב יש N לילות פנויים") — only when present.
//  2) the zimmer page URL (leads to the public discover feed / booking funnel).
export default function VideoShareBlocks({ video }) {
  const [copied, setCopied] = useState(null);
  const shareUrl = `${window.location.origin}/discover`;
  const nightsText = video.available_nights_text || '';

  const copy = (e, text, field) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 1800);
    }).catch(() => {});
  };

  const blockStyle = {
    background: 'rgba(20,20,22,0.45)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 14,
  };

  return (
    <div className="mt-2 space-y-2">
      {nightsText && (
        <div className="flex items-center gap-2 px-3 py-2" style={blockStyle}>
          <span className="text-white text-xs font-medium flex-1 leading-snug" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
            🌙 {nightsText}
          </span>
          <button
            onClick={(e) => copy(e, nightsText, 'nights')}
            className="flex items-center justify-center flex-shrink-0 transition-transform active:scale-90"
            style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.12)', color: '#fff' }}
            aria-label="העתק טקסט זמינות"
          >
            {copied === 'nights' ? <Check size={15} color="#22C55E" /> : <Copy size={15} />}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2" style={blockStyle}>
        <span className="text-white/80 text-xs flex-1 truncate font-mono" dir="ltr" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
          {shareUrl}
        </span>
        <button
          onClick={(e) => copy(e, shareUrl, 'url')}
          className="flex items-center justify-center flex-shrink-0 transition-transform active:scale-90"
          style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.12)', color: '#fff' }}
          aria-label="העתק קישור"
        >
          {copied === 'url' ? <Check size={15} color="#22C55E" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}