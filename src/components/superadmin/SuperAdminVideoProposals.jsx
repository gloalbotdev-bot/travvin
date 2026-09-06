import React from 'react';
import { Clock, Check, X, Send } from 'lucide-react';

function fmtDateTime(s) {
  try { return new Date(s).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

// Super-admin "My Proposals" tracking section. Shows every proposal the admin
// sent (status != 'פעיל' — pending or rejected), with the owner, zimmer,
// sent date, decision status and the note. Approved ones are excluded
// because they are now live videos in the list below.
export default function SuperAdminVideoProposals({ rows }) {
  const proposals = rows
    .filter((v) => v.proposal_status === 'הצעה' || v.proposal_status === 'נדחתה')
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  if (proposals.length === 0) return null;

  const statusChip = (s) => {
    if (s === 'הצעה') return { label: 'ממתין להחלטה', bg: 'rgba(249,115,22,0.1)', color: '#EA580C', icon: Clock };
    if (s === 'נדחתה') return { label: 'נדחה ע"י בעלים', bg: 'rgba(239,68,68,0.1)', color: '#EF4444', icon: X };
    return { label: s, bg: '#F0EEE8', color: '#6B7280', icon: Check };
  };

  return (
    <div className="rounded-2xl p-5 mb-6" dir="rtl" style={{ background: '#fff', border: '1.5px solid #FED7AA', fontFamily: 'Heebo, sans-serif' }}>
      <div className="flex items-center gap-2 mb-1">
        <Send size={16} style={{ color: '#F97316' }} />
        <h2 className="text-base font-black" style={{ color: '#1A1A1A' }}>הצעות שלי ({proposals.length})</h2>
      </div>
      <p className="text-xs mb-4" style={{ color: '#9CA3AF' }}>מעקב אחר הצעות ששלחת לבעלי צימרים וסטטוס ההחלטה שלהם.</p>

      <div className="space-y-3">
        {proposals.map((v) => {
          const chip = statusChip(v.proposal_status);
          const ChipIcon = chip.icon;
          return (
            <div key={v.id} className="rounded-xl flex gap-3 p-3" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
              <div className="w-16 h-24 rounded-lg overflow-hidden bg-black flex-shrink-0">
                <video src={v.video_url} className="w-full h-full object-cover" muted playsInline
                  onMouseEnter={(e) => e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{v.zimmer_name || '(ללא צימר)'}</p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: chip.bg, color: chip.color }}>
                    <ChipIcon size={10} /> {chip.label}
                  </span>
                </div>
                <p className="text-xs mb-0.5" style={{ color: '#6B7280' }}>בעלים: {v.owner_name || '—'}</p>
                <p className="text-xs mb-0.5" style={{ color: '#9CA3AF' }}>נשלח: {fmtDateTime(v.created_date)}</p>
                {v.proposal_decided_at && <p className="text-xs mb-1" style={{ color: '#9CA3AF' }}>הוחלט: {fmtDateTime(v.proposal_decided_at)}</p>}
                {v.proposal_note && <p className="text-xs rounded-lg px-2 py-1.5 mt-1" style={{ background: '#fff', color: '#374151', border: '1px solid #F0EEE8' }}>הערה: {v.proposal_note}</p>}
                {v.caption && <p className="text-sm mt-1 line-clamp-2" style={{ color: '#374151' }}>{v.caption}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}