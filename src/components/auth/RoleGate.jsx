import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import RoleMismatchModal from '@/components/auth/RoleMismatchModal';

/**
 * Gates a page to an allowed role set. Guests (no session) are allowed when allowGuest is true.
 *
 * @param {{
 *   allow: Array<'user'|'owner'|'admin'>,
 *   allowGuest?: boolean,
 *   children: React.ReactNode,
 * }} props
 */
export default function RoleGate({ allow, allowGuest = false, children }) {
  const allowKey = Array.isArray(allow) ? allow.join(',') : '';
  const [state, setState] = useState('loading'); // loading | ok | mismatch
  const [registeredAs, setRegisteredAs] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const allowed = allowKey ? allowKey.split(',') : [];
    (async () => {
      try {
        const u = await api.auth.me();
        if (cancelled) return;
        if (!u) {
          if (allowGuest) {
            setState('ok');
            return;
          }
          // Owner (or other gated) pages: send to welcome to pick Google login
          window.location.href = '/welcome';
          return;
        }
        if (allowed.includes(u.role)) {
          setState('ok');
          return;
        }
        setRegisteredAs(u.role || 'user');
        setState('mismatch');
      } catch {
        if (cancelled) return;
        if (allowGuest) {
          setState('ok');
          return;
        }
        window.location.href = '/welcome';
      }
    })();
    return () => { cancelled = true; };
  }, [allowKey, allowGuest]);

  const dismiss = () => {
    api.auth.logout('/welcome');
  };

  if (state === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#F8F7F4' }}>
        <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'mismatch') {
    return (
      <div className="fixed inset-0" style={{ background: '#F8F7F4' }}>
        <RoleMismatchModal registeredAs={registeredAs} onDismiss={dismiss} />
      </div>
    );
  }

  return children;
}
