import React from 'react';
import { Clock, CreditCard, Cigarette, Ban } from 'lucide-react';

const PAYMENT_LABELS = {
  'מזומן': 'מזומן',
  'העברה בנקאית': 'העברה בנקאית',
  'כרטיס אשראי': 'כרטיס אשראי',
};

// Check-in/out times, cancellation, payment methods, smoking policy.
export default function PolicySection({ zimmer }) {
  const ss = zimmer.stay_settings || {};
  const checkin = ss.checkin_time;
  const checkout = ss.checkout_time;
  const cancel = zimmer.cancellation_policy_text;
  const payments = Array.isArray(zimmer.payment_methods) ? zimmer.payment_methods : [];
  const smoking = zimmer.smoking_policy;

  const hasAny = checkin || checkout || cancel || payments.length || smoking;
  if (!hasAny) return null;

  return (
    <div dir="rtl" className="rounded-2xl p-4 space-y-3" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
      <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#0B3838' }}>מדיניות ותנאים</h3>

      {(checkin || checkout) && (
        <Row icon={Clock} label="צ'ק-אין / צ'ק-אאוט">
          <span>{checkin ? `כניסה ${checkin}` : ''}{checkin && checkout ? ' · ' : ''}{checkout ? `יציאה ${checkout}` : ''}</span>
        </Row>
      )}

      {cancel && (
        <Row icon={Ban} label="מדיניות ביטול">
          <span className="leading-relaxed">{cancel}</span>
        </Row>
      )}

      {payments.length > 0 && (
        <Row icon={CreditCard} label="אמצעי תשלום">
          <div className="flex flex-wrap gap-1.5">
            {payments.map((p, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}>
                {PAYMENT_LABELS[p] || p}
              </span>
            ))}
          </div>
        </Row>
      )}

      {smoking && (
        <Row icon={Cigarette} label="עישון">
          <span>{smoking}</span>
        </Row>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#0B3838' }} />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#9CA3AF' }}>{label}</p>
        <div className="text-xs" style={{ color: '#4B5563' }}>{children}</div>
      </div>
    </div>
  );
}