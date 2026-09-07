import React from 'react';
import btnAiEllipse from '@/assets/owner/home/btn-ai-ellipse.png';
import btnAiSparkles from '@/assets/owner/home/btn-ai-sparkles.svg';

/** Figma 1011:93 — ellipse fill (1011:94) + sparkles (1011:95) */
export default function OwnerAiIcon({ size = 40, className = '', alt = '' }) {
  const sparkW = Math.round(size * (18 / 40));
  const sparkH = Math.round(size * (17 / 40));
  return (
    <span
      className={`relative inline-block overflow-hidden rounded-full flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={btnAiEllipse}
        alt={alt}
        width={size}
        height={size}
        className="absolute inset-0 block w-full h-full object-cover rounded-full"
        draggable={false}
      />
      <img
        src={btnAiSparkles}
        alt=""
        width={sparkW}
        height={sparkH}
        className="absolute block pointer-events-none"
        style={{
          width: sparkW,
          height: sparkH,
          left: '50%',
          top: '50%',
          transform: 'translate(-52%, -48%)',
        }}
        draggable={false}
      />
    </span>
  );
}
