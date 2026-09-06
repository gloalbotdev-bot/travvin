import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Trash2, Eye, EyeOff, MessageSquare, MessageSquareOff, AlertTriangle, Plus, Clock } from 'lucide-react';
import SuperAdminVideoProposalForm from '@/components/superadmin/SuperAdminVideoProposalForm';
import SuperAdminVideoProposals from '@/components/superadmin/SuperAdminVideoProposals';

function fmtDate(s) { try { return new Date(s).toLocaleDateString('he-IL'); } catch { return ''; } }

// Super-admin moderation of ALL videos. Two synchronized ways to hide comments:
// per-video toggle and per-zimmer toggle (spreads to all videos of that zimmer
// with an explicit confirmation of how many video rows it affects).
export default function SuperAdminVideos() {
  const [rows, setRows] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showProposal, setShowProposal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [videos, users, bookings] = await Promise.all([
        api.entities.ZimmerVideo.list('-created_date', 500),
        api.entities.User.list(),
        api.entities.BookingRequest.list('-created_date', 200),
      ]);
      const ownerMap = new Map((users || []).map((u) => [u.id, u]));
      const bookingCountByVideo = new Map();
      for (const b of bookings || []) {
        if (b.source_video_id) bookingCountByVideo.set(b.source_video_id, (bookingCountByVideo.get(b.source_video_id) || 0) + 1);
      }
      setRows((videos || []).map((v) => ({
        ...v,
        owner_name: ownerMap.get(v.owner_id)?.full_name || v.owner_name || '—',
        bookings_count: bookingCountByVideo.get(v.id) || 0,
      })));
      const ownerIds = Array.from(new Set((videos || []).map((v) => v.owner_id).filter(Boolean)));
      setOwners(ownerIds.map((id) => ({ id, name: ownerMap.get(id)?.full_name || '—' })).filter(o => o.id));
    } catch (e) { /* */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setHidden = async (v, hidden) => {
    setBusy(true);
    try { await api.functions.invoke('setVideoVisibility', { video_id: v.id, hidden }); setRows((p) => p.map((x) => x.id === v.id ? { ...x, hidden } : x)); } catch {}
    setBusy(false);
  };

  const setCommentsHiddenVideo = async (v, hidden) => {
    setBusy(true);
    try { await api.entities.ZimmerVideo.update(v.id, { comments_hidden: hidden }); setRows((p) => p.map((x) => x.id === v.id ? { ...x, comments_hidden: hidden } : x)); } catch {}
    setBusy(false);
  };

  const setCommentsHiddenZimmer = async (ownerRow, hidden) => {
    const affected = rows.filter((r) => r.owner_id === ownerRow.id);
    setBusy(true);
    try {
      const res = await api.functions.invoke('setVideoCommentsHidden', { zimmer_id: ownerRow.zimmer_id, comments_hidden: hidden });
    } catch {}
    // refresh from server for accuracy (comments_hidden synced across zimmer)
    load();
    setBusy(false);
  };

  const remove = async (v) => {
    if (!confirm('למחוק את הסרטון לצמיתות?')) return;
    setBusy(true);
    try { await api.functions.invoke('deleteVideo', { video_id: v.id }); setRows((p) => p.filter((x) => x.id !== v.id)); } catch {}
    setBusy(false);
  };

  // zimmer-level groups for the zimmer-wide comments toggle
  const zimmerGroups = {};
  rows.forEach((r) => {
    if (!r.zimmer_id) return;
    if (!zimmerGroups[r.zimmer_id]) zimmerGroups[r.zimmer_id] = { zimmer_name: r.zimmer_name, count: 0, comments_hidden: false, owner_name: r.owner_name };
    zimmerGroups[r.zimmer_id].count++;
    zimmerGroups[r.zimmer_id].comments_hidden = r.comments_hidden;
  });

  if (loading) return (
    <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" /></div>
  );

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>וידאו ({rows.length})</h1>
        <button onClick={() => setShowProposal((s) => !s)}
          className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90" style={{ background: '#F97316' }}>
          <Plus size={16} /> הצע סרטון לבעלים
        </button>
      </div>
      <p className="text-sm mb-5" style={{ color: '#9CA3AF' }}>ניהול כל סרטוני הצימרים בפיד</p>

      {showProposal && <SuperAdminVideoProposalForm onClose={() => setShowProposal(false)} onCreated={load} />}

      <SuperAdminVideoProposals rows={rows} />

      {rows.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>אין סרטונים במערכת עדיין.</p>
        </div>
      ) : (
        <>
          {/* zimmer-wide comments toggle */}
          <div className="rounded-2xl p-5 mb-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <h3 className="font-bold text-sm mb-3" style={{ color: '#1A1A1A' }}>הסתרת תגובות ברמת צימר</h3>
            <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>שינוי כאן ישפיע על כל הסרטונים של אותו צימר בבת אחת.</p>
            <div className="space-y-2">
              {Object.entries(zimmerGroups).map(([zimmerId, g]) => (
                <div key={zimmerId} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{g.zimmer_name || '(ללא שם)'}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{g.owner_name} · {g.count} סרטונים יושפעו</p>
                  </div>
                  <button disabled={busy} onClick={() => setCommentsHiddenZimmer({ zimmer_id: zimmerId }, !g.comments_hidden)}
                    className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                    style={g.comments_hidden ? { background: 'rgba(124,58,237,0.1)', color: '#7C3AED' } : { background: '#0B3838', color: '#fff' }}>
                    {g.comments_hidden ? <><MessageSquareOff size={13} /> תגובות מוסתרות</> : <><MessageSquare size={13} /> תגובות גלויות</>}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* per-video list */}
          <div className="space-y-3">
            {rows.map((v) => (
              <div key={v.id} className="rounded-2xl p-4 flex flex-col sm:flex-row gap-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <div className="w-24 h-40 sm:w-28 sm:h-40 rounded-xl overflow-hidden bg-black flex-shrink-0">
                  <video src={v.video_url} className="w-full h-full object-cover" muted loop playsInline
                    onMouseEnter={(e) => e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{v.zimmer_name || '(ללא צימר)'}</p>
                    {v.hidden && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED' }}>מוסתר</span>}
                    {v.proposal_status === 'הצעה' && <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}><Clock size={10} /> הצעה ממתינה</span>}
                    {v.proposal_status === 'נדחתה' && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>נדחתה</span>}
                  </div>
                  <p className="text-xs mb-1.5" style={{ color: '#6B7280' }}>בעלים: {v.owner_name}</p>
                  {v.caption && <p className="text-sm mb-1.5 line-clamp-2" style={{ color: '#374151' }}>{v.caption}</p>}
                  <div className="flex items-center gap-3 text-xs" style={{ color: '#9CA3AF' }}>
                    <span>❤ {v.likes_count}</span>
                    <span>📅 {v.bookings_count} הזמנות</span>
                    <span>{fmtDate(v.created_date)}</span>
                  </div>
                </div>
                <div className="flex sm:flex-col gap-2 flex-shrink-0">
                  <button disabled={busy} onClick={() => setHidden(v, !v.hidden)}
                    title={v.hidden ? 'הצג' : 'הסתר'}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg"
                    style={v.hidden ? { background: 'rgba(34,197,94,0.1)', color: '#16A34A' } : { background: 'rgba(124,58,237,0.1)', color: '#7C3AED' }}>
                    {v.hidden ? <><Eye size={13} /> הצג</> : <><EyeOff size={13} /> הסתר</>}
                  </button>
                  <button disabled={busy} onClick={() => setCommentsHiddenVideo(v, !v.comments_hidden)}
                    title={v.comments_hidden ? 'הצג תגובות' : 'הסתר תגובות'}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg"
                    style={v.comments_hidden ? { background: 'rgba(124,58,237,0.1)', color: '#7C3AED' } : { background: '#F8F7F4', color: '#6B7280' }}>
                    {v.comments_hidden ? <><MessageSquare size={13} /> תגובות מוסתרו</> : <><MessageSquareOff size={13} /> הסתר תגובות</>}
                  </button>
                  <button disabled={busy} onClick={() => remove(v)}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.06)', color: '#EF4444' }}>
                    <Trash2 size={13} /> מחק
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}