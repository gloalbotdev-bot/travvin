import React, { useState } from 'react';
import { api } from '@/api/client';
import { Check, Loader2 } from 'lucide-react';
import DateRangeField from '@/components/common/DateRangeField';

export default function PriceUpdateForm({ zimmers, initialZimmerId, initialRange, onSaved, onDone }) {
  const [zimmerId, setZimmerId] = useState(initialZimmerId || zimmers[0]?.id || '');
  const [startDate, setStartDate] = useState(initialRange?.start || '');
  const [endDate, setEndDate] = useState(initialRange?.end || '');
  const [pct, setPct] = useState(0); // signed: -80..200
  const [absolute, setAbsolute] = useState('');
  const [saving, setSaving] = useState(false);

  const zimmer = zimmers.find(z => z.id === zimmerId);
  const hasAbsolute = absolute !== '' && absolute != null;
  const valid = zimmerId && startDate && endDate && startDate <= endDate && (hasAbsolute ? Number(absolute) > 0 : true);

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const rule = { start_date: startDate, end_date: endDate };
      if (hasAbsolute) {
        rule.price_per_night = Number(absolute);
      } else {
        rule.adjustment = pct >= 0 ? 'increase' : 'decrease';
        rule.percentage = Math.abs(pct);
      }
      const current = Array.isArray(zimmer?.seasonal_pricing) ? zimmer.seasonal_pricing : [];
      await api.entities.Zimmer.update(zimmerId, { seasonal_pricing: [...current, rule] });
      onSaved?.();
      onDone?.();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>נכס</label>
        <select value={zimmerId} onChange={e => setZimmerId(e.target.value)}
          className="w-full px-3 py-2 text-sm outline-none rounded-lg" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}>
          {zimmers.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>תקופה</label>
        <DateRangeField
          start={startDate}
          end={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          allowPast
          placeholder="בחר תקופה"
        />
      </div>

      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>מחיר מוחלט ללילה (₪)</label>
        <input type="number" min={0} value={absolute} onChange={e => setAbsolute(e.target.value)}
          className="w-full px-3 py-2 text-sm outline-none rounded-lg" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}
          placeholder="ריק = לפי אחוזים" />
      </div>

      <div className={hasAbsolute ? 'opacity-40 pointer-events-none' : ''}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium" style={{ color: '#6B7280' }}>התאמת אחוז</label>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: pct > 0 ? 'rgba(249,115,22,0.12)' : pct < 0 ? 'rgba(59,130,246,0.12)' : '#F0EEE8', color: pct > 0 ? '#EA580C' : pct < 0 ? '#1D4ED8' : '#9CA3AF' }}>
            {pct > 0 ? '+' : ''}{pct}%
          </span>
        </div>
        <input type="range" min={-80} max={200} step={5} value={pct} onChange={e => setPct(Number(e.target.value))}
          className="w-full accent-orange-500" />
        <div className="flex justify-between mt-1 text-[10px]" style={{ color: '#9CA3AF' }}>
          <span>−80%</span><span>0</span><span>+200%</span>
        </div>
      </div>

      <button onClick={submit} disabled={!valid || saving} type="button"
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-bold transition-all disabled:opacity-50"
        style={{ background: '#0B1B2A' }}>
        {saving ? <><Loader2 size={15} className="animate-spin" /> שומר…</> : <><Check size={15} /> עדכן מחיר</>}
      </button>
    </div>
  );
}