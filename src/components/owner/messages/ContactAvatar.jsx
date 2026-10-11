import React from 'react';

// Guests have no profile photos, so the 56px Figma avatar shows their initial.
export default function ContactAvatar({ name, children }) {
  return (
    <div className="font-simona w-[56px] h-[56px] rounded-full flex items-center justify-center flex-shrink-0 text-[20px]"
      style={{ background: '#EFEFEF', color: '#0B3838', fontWeight: 500 }} aria-hidden="true">
      {children || (name || 'ל').trim().slice(0, 1)}
    </div>
  );
}
