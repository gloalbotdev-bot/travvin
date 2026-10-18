import React, { useState } from 'react';
import { api } from '@/api/client';

const ROLE_LABEL = {
  user: 'לקוח',
  owner: 'בעל מתחם',
  admin: 'אדמין',
};

/**
 * @param {'user'|'owner'|'admin'|string|null|undefined} registeredAs
 * @param {'user'|'owner'|'admin'|string|null|undefined} [attemptedIntent]
 * @param {{ alreadyHasDual?: boolean }} [opts]
 */
export function messageForRegisteredAs(registeredAs, attemptedIntent, opts = {}) {
  const asLabel = ROLE_LABEL[registeredAs] || 'משתמש';
  const intentLabel = ROLE_LABEL[attemptedIntent];

  // Admins may enter as customer or owner; do not tell them to use another Google account.
  if (registeredAs === 'admin') {
    return 'החשבון הזה רשום כאדמין.';
  }

  if (opts.alreadyHasDual && intentLabel) {
    return `יש לך גישה גם כ${intentLabel}. התנתקו והיכנסו מחדש דרך המסך המתאים כדי להחליף תפקיד.`;
  }

  if (intentLabel && intentLabel !== asLabel) {
    return `החשבון הזה כבר רשום כ${asLabel}. כדי להיכנס כ${intentLabel} אפשר לבקש מהאדמין גישה לתפקיד נוסף, או להתחבר עם חשבון Google אחר.`;
  }

  if (registeredAs === 'owner') {
    return 'החשבון הזה כבר רשום כבעל מתחם. כדי להיכנס בתפקיד אחר אפשר לבקש מהאדמין, או להתחבר עם חשבון Google אחר.';
  }
  return 'החשבון הזה כבר רשום כלקוח. כדי להיכנס כבעל מתחם אפשר לבקש מהאדמין, או להתחבר עם חשבון Google אחר.';
}

/**
 * Modal for role exclusivity (customer vs owner vs admin).
 * @param {{
 *   registeredAs: string,
 *   attemptedIntent?: string,
 *   requestToken?: string|null,
 *   toRole?: string|null,
 *   alreadyHasDual?: boolean,
 *   onDismiss: () => void,
 * }} props
 */
export default function RoleMismatchModal({
  registeredAs,
  attemptedIntent,
  requestToken = null,
  toRole = null,
  alreadyHasDual = false,
  onDismiss,
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const targetRole = toRole || attemptedIntent;
  const canRequest =
    !alreadyHasDual &&
    !sent &&
    (registeredAs === 'user' || registeredAs === 'owner') &&
    (targetRole === 'user' || targetRole === 'owner') &&
    registeredAs !== targetRole &&
    (Boolean(requestToken) || Boolean(toRole || attemptedIntent));

  const handleRequest = async () => {
    setSending(true);
    setError(null);
    try {
      if (requestToken) {
        await api.roleAccessRequests.create({ request_token: requestToken });
      } else {
        await api.roleAccessRequests.create({ to_role: targetRole });
      }
      setSent(true);
    } catch (err) {
      setError(err?.message || 'שליחת הבקשה נכשלה');
    } finally {
      setSending(false);
    }
  };

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
        <p className="text-sm leading-relaxed mb-4" style={{ color: '#6B7280' }}>
          {messageForRegisteredAs(registeredAs, attemptedIntent, { alreadyHasDual })}
        </p>

        {sent && (
          <p className="text-sm mb-4 font-semibold" style={{ color: '#16A34A' }}>
            הבקשה נשלחה לאדמין. נעדכן אותך אחרי בדיקה.
          </p>
        )}
        {error && (
          <p className="text-sm mb-4" style={{ color: '#EF4444' }}>
            {error}
          </p>
        )}

        <div className="space-y-2">
          {canRequest && (
            <button
              type="button"
              onClick={handleRequest}
              disabled={sending}
              className="w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#1A1A1A' }}
            >
              {sending ? 'שולח…' : 'שלח בקשה לאדמין לתפקיד נוסף'}
            </button>
          )}
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
    </div>
  );
}
