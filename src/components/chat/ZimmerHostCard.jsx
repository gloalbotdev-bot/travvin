import React from 'react';
import { MessageCircle, User } from 'lucide-react';
import { normalizePhoneE164, whatsappLink } from '@/lib/rooms';

// Host card — owner name + WhatsApp only (response time intentionally omitted per spec).
export default function ZimmerHostCard({ zimmer }) {
  const phoneE164 = normalizePhoneE164(zimmer.contact_phone);
  const name = zimmer.owner_name || 'בעל המתחם';
  if (!name && !phoneE164) return null;
  return (
    <div dir="rtl" className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
      <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(11,56,56,0.1)' }}>
        <User size={18} style={{ color: '#0B3838' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>המארח/ת</p>
        <p className="font-bold text-sm truncate" style={{ color: '#1A1A1A' }}>{name}</p>
      </div>
      {phoneE164 && (
        <a
          href={whatsappLink(phoneE164, `שלום, יש לי שאלה לגבי "${zimmer.name}"`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl"
          style={{ background: '#25D366', color: '#fff' }}
        >
          <MessageCircle size={13} /> וואטסאפ
        </a>
      )}
    </div>
  );
}