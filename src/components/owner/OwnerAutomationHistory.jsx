import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Users, Truck, Clock, Check, AlertCircle, Search } from 'lucide-react';

// History of automatic messages: customer (GuestMessage) and supplier
// (SupplierMessage) side-by-side, color-coded and filterable. Default tab when
// entering the automatic-messages page.
export default function OwnerAutomationHistory({ ownerId }) {
  const [guests, setGuests] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all'); // all | customer | supplier

  useEffect(() => { load(); }, [ownerId]);

  const load = async () => {
    if (!ownerId) return;
    setLoading(true);
    const [g, s] = await Promise.all([
      api.entities.GuestMessage.filter({ owner_id: ownerId }, '-created_date', 100).catch(() => []),
      api.entities.SupplierMessage.filter({ owner_id: ownerId }, '-created_date', 100).catch(() => []),
    ]);
    setGuests(g || []);
    setSuppliers(s || []);
    setLoading(false);
  };

  const matches = (text) => !q || (text || '').toLowerCase().includes(q.toLowerCase());

  const filteredGuests = (guests || []).filter(m =>
    (kind === 'all' || kind === 'customer') &&
    (matches(m.title) || matches(m.body) || matches(m.customer_name) || matches(m.zimmer_name))
  );
  const filteredSuppliers = (suppliers || []).filter(m =>
    (kind === 'all' || kind === 'supplier') &&
    (matches(m.title) || matches(m.body) || matches(m.contact_name))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const empty = filteredGuests.length === 0 && filteredSuppliers.length === 0;

  return (
    <div dir="rtl" className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="חיפוש בהודעות..."
            className="w-full pr-9 pl-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#1A1A1A', fontFamily: 'Heebo, sans-serif' }}
          />
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'הכל' }, { v: 'customer', l: 'הודעות ללקוחות' }, { v: 'supplier', l: 'הודעות לספקים' }].map(t => (
            <button key={t.v} onClick={() => setKind(t.v)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
              style={kind === t.v ? { background: '#1A1A1A', color: '#fff' } : { background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatPill icon={Users} count={filteredGuests.length} label="ללקוחות" color="#3B82F6" />
        <StatPill icon={Truck} count={filteredSuppliers.length} label="לספקים" color="#F97316" />
      </div>

      {empty ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <Clock size={28} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p className="text-sm" style={{ color: '#9CA3AF' }}>אין הודעות בהיסטוריה עדיין.{q && ' נסה לשנות את החיפוש.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {kind !== 'supplier' && (
            <Column color="#3B82F6" icon={Users} title="הודעות ללקוחות" count={filteredGuests.length}>
              {filteredGuests.map(m => <CustomerCard key={m.id} m={m} />)}
            </Column>
          )}
          {kind !== 'customer' && (
            <Column color="#F97316" icon={Truck} title="הודעות לספקים" count={filteredSuppliers.length}>
              {filteredSuppliers.map(m => <SupplierCard key={m.id} m={m} />)}
            </Column>
          )}
        </div>
      )}
    </div>
  );
}

function StatPill({ icon: Icon, count, label, color }) {
  return (
    <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}1A` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <div className="text-lg font-black leading-none" style={{ color: '#1A1A1A' }}>{count}</div>
        <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{label}</div>
      </div>
    </div>
  );
}

function Column({ color, icon: Icon, title, count, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: `${color}0F`, borderBottom: `1.5px solid ${color}22` }}>
        <Icon size={16} style={{ color }} />
        <span className="text-sm font-black" style={{ color: '#1A1A1A' }}>{title}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${color}1A`, color }}>{count}</span>
      </div>
      <div className="p-3 space-y-2 max-h-[60vh] overflow-auto">
        {children}
      </div>
    </div>
  );
}

function DeliveryBadge({ status }) {
  const isOk = status === 'sent';
  const isWarn = status === 'not_configured' || status === 'skipped' || status === 'pending';
  const Icon = isOk ? Check : isWarn ? AlertCircle : AlertCircle;
  const color = isOk ? '#16A34A' : isWarn ? '#D97706' : '#EF4444';
  const label = isOk ? 'נשלח' : status === 'not_configured' ? 'לא מוגדר' : status === 'skipped' ? 'דילוג' : status === 'pending' ? 'ממתין' : 'נכשל';
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${color}1A`, color }}>
      <Icon size={10} /> {label}
    </span>
  );
}

function CustomerCard({ m }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8', borderRight: '3px solid #3B82F6' }}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-[11px] font-bold" style={{ color: '#3B82F6' }}>נמען: {m.customer_name || 'לקוח'}</span>
        {m.zimmer_name && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#fff', color: '#6B7280' }}>{m.zimmer_name}</span>}
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#fff', color: '#6B7280' }}>{m.category}</span>
        <span className="text-[10px] flex items-center gap-1 mr-auto" style={{ color: '#9CA3AF' }}>
          <Clock size={10} /> {m.created_date ? new Date(m.created_date).toLocaleString('he-IL') : ''}
        </span>
      </div>
      <div className="text-sm font-bold" style={{ color: '#1A1A1A' }}>{m.title}</div>
      {m.body && <div className="text-xs mt-1 whitespace-pre-wrap" style={{ color: '#4B5563' }}>{m.body}</div>}
      <div className="flex items-center gap-1.5 mt-2">
        {m.channels?.includes('app') && <DeliveryBadge status={m.delivery_status?.app} />}
        {m.channels?.includes('whatsapp') && <DeliveryBadge status={m.delivery_status?.whatsapp} />}
      </div>
    </div>
  );
}

function SupplierCard({ m }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8', borderRight: '3px solid #F97316' }}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-[11px] font-bold" style={{ color: '#F97316' }}>ספק: {m.contact_name || '—'}</span>
        {m.contact_phone && <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{m.contact_phone}</span>}
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#fff', color: '#6B7280' }}>{m.category}</span>
        <span className="text-[10px] flex items-center gap-1 mr-auto" style={{ color: '#9CA3AF' }}>
          <Clock size={10} /> {m.sent_at ? new Date(m.sent_at).toLocaleString('he-IL') : ''}
        </span>
      </div>
      <div className="text-sm font-bold" style={{ color: '#1A1A1A' }}>{m.title}</div>
      {m.body && <div className="text-xs mt-1 whitespace-pre-wrap" style={{ color: '#4B5563' }}>{m.body}</div>}
      <div className="flex items-center gap-1.5 mt-2">
        <DeliveryBadge status={m.delivery_status?.whatsapp} />
      </div>
    </div>
  );
}