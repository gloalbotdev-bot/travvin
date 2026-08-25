import React from 'react';

/**
 * @param {'user'|'owner'|'admin'|string|null|undefined} registeredAs
 */
export function messageForRegisteredAs(registeredAs) {
  if (registeredAs === 'owner') {
    return 'החשבון הזה כבר רשום כבעל מתחם. כדי להיכנס כלקוח יש להתחבר עם חשבון Google אחר.';
  }
  if (registeredAs === 'admin') {
    return 'החשבון הזה רשום כאדמין. כדי להיכנס כלקוח או כבעל מתחם יש להתחבר עם חשבון Google אחר.';
  }
  return 'החשבון הזה כבר רשום כלקוח. כדי להיכנס כבעל מתחם יש להתחבר עם חשבון Google אחר.';
}

/**
 * Modal for role exclusivity (customer vs owner).
 * @param {{ registeredAs: string, onDismiss: () => void }} props
 */
export default function RoleMismatchModal({ registeredAs, onDismiss }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(26,26,26,0.45)', fontFamily: 'Heebo, sans-serif' }}
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-xl"
        style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}
      >
        <h2 className="text-lg font-black mb-2" style={{ color: '#1A1A1A' }}>
          חשבון בתפקיד אחר
        </h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: '#6B7280' }}>
          {messageForRegisteredAs(registeredAs)}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: '#F97316' }}
        >
          הבנתי
        </button>
      </div>
    </div>
  );
}
