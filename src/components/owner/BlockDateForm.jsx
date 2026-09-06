import React, { useState } from 'react';
import { api } from '@/api/client';
import { Check, Loader2 } from 'lucide-react';
import DateRangeField from '@/components/common/DateRangeField';

const REASONS = ['תחזוקה', 'שימוש פרטי', 'חופשה', 'אחר'];

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso, n) => toISO(new Date(new Date(iso + 'T00:00:00').getTime() + n * 86400000));

export default function BlockDateForm({ zimmers, ownerId, initialDate, initialZimmerId, onSaved, onDone }) {
  const [zimmerId, setZimmerId] = useState(initialZimmerId || zimmers[0]?.id || '');
  const [mode, setMode] = useState('single');
  const [date, setDate] = useState(initialDate || '');
  const [startDate, setStartDate] = useState(initialDate || '');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('תחזוקה');
  const [saving, setSaving] = useState(false);

  const zimmer = zimmers.find(z => z.id === zimmerId);
  const valid = zimmerId && (mode === 'single' ? date : (startDate && endDate && startDate <= endDate));

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const ci = mode === 'single' ? date : startDate;
    const co = mode === 'single' ? addDays(date, 1) : endDate;
    try {
      await api.entities.BookingRequest.create({
        zimmer_id: zimmerId,
        zimmer_name: zimmer?.name || '',
        owner_id: ownerId,
        guest_name: reason,
        guest_phone: '',
        check_in: ci,
        check_out: co,
        status: 'חסום',
        is_block: true,
        block_reason: reason,
        num_guests: null,
      });
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
          {zimmers.length === 0 && <option value="">אין צימרים</option>}
          {zimmers.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>טווח</label>
        <div className="flex gap-1.5">
          {['single', 'range'].map(m => (
            <button key={m} onClick={() => setMode(m)} type="button"
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={mode === m ? { background: '#0B1B2A', color: '#fff' } : { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
              {m === 'single' ? 'יום בודד' : 'טווח תאריכים'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'single' ? (
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>תאריך</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm outline-none rounded-lg" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }} />
        </div>
      ) : (
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>תאריכים</label>
          <DateRangeField
            start={startDate}
            end={endDate}
            onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
            placeholder="בחר טווח תאריכים"
          />
        </div>
      )}

      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>סיבה</label>
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map(r => (
            <button key={r} type="button" onClick={() => setReason(r)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={reason === r ? { background: '#0B1B2A', color: '#fff' } : { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <button onClick={submit} disabled={!valid || saving} type="button"
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-bold transition-all disabled:opacity-50"
        style={{ background: '#0B1B2A' }}>
        {saving ? <><Loader2 size={15} className="animate-spin" /> חוסם…</> : <><Check size={15} /> חסום תאריך</>}
      </button>
    </div>
  );
}