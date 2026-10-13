import React from 'react';
import btnAiEllipse from '@/assets/owner/home/btn-ai-ellipse.png';
import aiOrb from '@/assets/owner/assistant/ai-orb.png';
import aiAsterisk from '@/assets/owner/home/ai-asterisk.svg';
import aiAsteriskWhite from '@/assets/owner/assistant/ai-asterisk-white.svg';

/* Figma 1776:18179 — white asterisk inside the AI page orb (93.5×89.4 at 42.2,44.3 of 178) */
const WHITE_ASTERISK_BOX = { width: '52.52%', height: '50.24%', left: '23.73%', top: '24.87%' };

/**
 * Figma 1776:20427 — ellipse fill (1776:20429) + Travvin asterisk (1776:20430).
 * variant="orb" — large orb fill used on the AI / Today screens (1776:18178).
 * asteriskTone="light" — white asterisk (AI assistant page, Frame 108).
 */
export default function OwnerAiIcon({ size = 40, className = '', alt = '', variant = 'button', asterisk = true, asteriskTone = 'dark' }) {
  const light = asteriskTone === 'light';
  return (
    <span
      className={`relative inline-block overflow-hidden rounded-full flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={variant === 'orb' ? aiOrb : btnAiEllipse}
        alt={alt}
        width={size}
        height={size}
        className="absolute inset-0 block w-full h-full object-cover rounded-full"
        draggable={false}
      />
      {asterisk && (
        <img
          src={light ? aiAsteriskWhite : aiAsterisk}
          alt=""
          className="absolute block pointer-events-none"
          style={light ? WHITE_ASTERISK_BOX : { width: '59.25%', height: '55.5%', left: '20.4%', top: '22.2%' }}
          draggable={false}
        />
      )}
    </span>
  );
}
