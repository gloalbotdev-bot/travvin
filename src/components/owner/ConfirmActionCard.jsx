import React from 'react';
import { Check, Loader2, X } from 'lucide-react';

/**
 * Shared confirm-before-execute card for every owner assistant bubble.
 * status: 'pending' | 'busy' | 'done' | 'cancelled' | 'expired'
 */
export default function ConfirmActionCard({
  action,
  status = 'pending',
  onConfirm,
  onCancel,
  confirmLabel = 'אשר ובצע',
  cancelLabel = 'ביטול',
  compact = false,
  children,
}) {
  if (!action) return null;
  const busy = status === 'busy';
  const resolved = status === 'done' || status === 'cancelled' || status === 'expired';
  const resolvedText = { done: '✓ בוצע', cancelled: 'בוטל — לא בוצע שינוי', expired: 'פג תוקף — בקש/י את הפעולה שוב' }[status];
  return (
    <div
      className={`bg-white rounded-[16px] ${compact ? 'p-3' : 'p-4'} font-simona`}
      style={{ border: '1.5px solid #E4E7E5' }}
      role="group"
      aria-label="אישור פעולה"
    >
      <p className="font-simpler" style={{ color: '#0B3838', fontSize: compact ? 14 : 15, fontWeight: 600 }}>
        {action.summary}
      </p>
      {Array.isArray(action.details) && action.details.length > 0 && (
        <ul className="mt-2 space-y-1">
          {action.details.map((d, i) => (
            <li key={i} className="leading-relaxed whitespace-pre-wrap" style={{ color: '#717171', fontSize: compact ? 12 : 13 }}>
              {d}
            </li>
          ))}
        </ul>
      )}
      {children}
      {resolved ? (
        <p role="status" className="mt-3 text-xs" style={{ color: status === 'done' ? '#047857' : '#717171' }}>
          {resolvedText}
        </p>
      ) : (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="font-simpler flex-1 text-white py-2 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: '#0B3838', fontWeight: 600 }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {busy ? 'מבצע...' : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm flex items-center gap-1 transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838', border: '1.5px solid rgba(11,56,56,0.12)' }}
          >
            <X size={14} /> {cancelLabel}
          </button>
        </div>
      )}
    </div>
  );
}
