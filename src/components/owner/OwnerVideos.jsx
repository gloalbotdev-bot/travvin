import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Plus, Trash2, PenLine, Check, X, Upload, Video, Share2 } from 'lucide-react';
import OwnerVideoProposals from '@/components/owner/OwnerVideoProposals';
import ShareSheet from '@/components/discover/ShareSheet';
import VideoShareBlocks from '@/components/discover/VideoShareBlocks';

const MAX_DURATION = 45;
const MAX_SIZE = 30 * 1024 * 1024;

function fmtDate(s) { try { return new Date(s).toLocaleDateString('he-IL'); } catch { return ''; } }

export default function OwnerVideos({ ownerId }) {
  const [videos, setVideos] = useState([]);
  const [zimmers, setZimmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedZimmerId, setSelectedZimmerId] = useState('');
  const [captionDraft, setCaptionDraft] = useState('');
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [shareVideo, setShareVideo] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.functions.invoke('listOwnerVideos', {});
      const d = res.data || res;
      setVideos(d.videos || []);
      const zs = await api.entities.Zimmer.filter({ owner_id: ownerId });
      setZimmers(zs || []);
    } catch (e) { setError('שגיאה בטעינת הסרטונים.'); }
    setLoading(false);
  };

  useEffect(() => { if (ownerId) load(); }, [ownerId]);

  const handleUpload = (file) => {
    if (zimmers.length === 0) { setError('אין לך צימרים. צור צימר תחילה.'); return; }
    if (!selectedZimmerId) { setError('בחר צימר לסרטון.'); return; }
    if (file.size > MAX_SIZE) { setError('הקובץ גדול מדי — עד 30MB בלבד.'); return; }
    if (!file.type.startsWith('video/')) { setError('יש לבחור קובץ וידאו.'); return; }
    setError('');
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = async () => {
      URL.revokeObjectURL(v.src);
      if (v.duration && v.duration > MAX_DURATION) {
        setError(`הסרטון ארוך מדי — עד ${MAX_DURATION} שניות (משך הקובץ: ${Math.round(v.duration)}s).`);
        return;
      }
      setBusy(true);
      try {
        const { file_url } = await api.integrations.Core.UploadFile({ file });
        await api.functions.invoke('createZimmerVideo', {
          zimmer_id: selectedZimmerId,
          video_url: file_url,
          caption: captionDraft.trim(),
        });
        await load();
        setShowUpload(false);
        setCaptionDraft('');
        setSelectedZimmerId('');
      } catch (e) {
        setError('שגיאה בהעלאת הסרטון. נסה שוב.');
      }
      setBusy(false);
    };
    v.onerror = () => { setError('לא הצלחתי לקרוא את הסרטון. נסה קובץ אחר.'); };
    v.src = URL.createObjectURL(file);
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) handleUpload(f);
  };

  const startEdit = (v) => { setEditId(v.id); setEditDraft(v.caption || ''); };
  const saveEdit = async (v) => {
    try { await api.functions.invoke('updateVideoCaption', { video_id: v.id, caption: editDraft }); setVideos((p) => p.map((x) => x.id === v.id ? { ...x, caption: editDraft } : x)); } catch {}
    setEditId(null);
  };

  const remove = async (v) => {
    if (!confirm('למחוק את הסרטון?')) return;
    try { await api.functions.invoke('deleteVideo', { video_id: v.id }); setVideos((p) => p.filter((x) => x.id !== v.id)); } catch {}
  };

  if (loading) return (
    <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" /></div>
  );

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>וידאו</h1>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>{videos.length} סרטונים · {videos.reduce((s, v) => s + (v.bookings_count || 0), 0)} הזמנות הגיעו דרך הסרטונים</p>
        </div>
        <button onClick={() => { if (zimmers.length === 0) { alert('צור צימר תחילה.'); return; } setShowUpload(true); setError(''); }}
          className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
          style={{ background: '#F97316' }}>
          <Plus size={16} /> העלה סרטון
        </button>
      </div>

      {error && <div className="mb-4 text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>{error}</div>}

      <OwnerVideoProposals videos={videos} onResolved={(id, decision) => setVideos((p) => p.map((x) => x.id === id ? { ...x, proposal_status: decision === 'approve' ? 'פעיל' : 'נדחתה' } : x))} />

      {showUpload && (
        <div className="rounded-2xl p-5 mb-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: '#1A1A1A' }}>העלאת סרטון חדש</h3>
          <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>מגבלות: עד 45 שניות, עד 30MB. פורמט וידאו בלבד.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>בחר צימר</label>
              <select value={selectedZimmerId} onChange={(e) => setSelectedZimmerId(e.target.value)}
                className="w-full px-4 py-3 text-sm" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', borderRadius: '12px', outline: 'none' }}>
                <option value="" disabled>בחר צימר...</option>
                {zimmers.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>תיאור קצר (אופציונלי)</label>
              <input value={captionDraft} onChange={(e) => setCaptionDraft(e.target.value)}
                placeholder="למשל: הנוף מהמרפסת בבוקר..."
                className="w-full px-4 py-3 text-sm" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', borderRadius: '12px', outline: 'none' }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60"
                style={{ background: '#0B3838' }}>
                {busy ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> מעלה...</> : <><Upload size={16} /> בחר קובץ והעלה</>}
              </button>
              <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onPickFile} />
              <button onClick={() => { setShowUpload(false); setError(''); }}
                className="px-5 py-3 rounded-xl text-sm font-semibold" style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {videos.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(249,115,22,0.1)' }}>
            <Video size={28} style={{ color: '#F97316' }} />
          </div>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>אין סרטונים עדיין</p>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>העלה סרטון קצר של הצימר כדי שיופיע בפיד הגילוי</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((v) => (
            <div key={v.id} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <div className="relative aspect-[9/16] bg-black">
                <video src={v.video_url} className="w-full h-full object-cover" muted loop playsInline
                  onMouseEnter={(e) => e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} />
                {v.hidden && <span className="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>מוסתר</span>}
                <div className="absolute bottom-2 left-2 flex gap-1.5">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>❤ {v.likes_count}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>📅 {v.bookings_count}</span>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>{v.zimmer_name} · {fmtDate(v.created_date)}</p>
                {editId === v.id ? (
                  <div className="flex gap-1.5">
                    <input value={editDraft} onChange={(e) => setEditDraft(e.target.value)}
                      className="flex-1 text-sm px-2 py-1.5 rounded-lg" style={{ background: '#F8F7F4', border: '1.5px solid #F97316' }} />
                    <button onClick={() => saveEdit(v)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: '#F97316' }}><Check size={15} /></button>
                    <button onClick={() => setEditId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F0EEE8', color: '#6B7280' }}><X size={15} /></button>
                  </div>
                ) : (
                  <p className="text-sm mb-3 line-clamp-2" style={{ color: v.caption ? '#1A1A1A' : '#9CA3AF' }}>{v.caption || 'ללא תיאור'}</p>
                )}
                {editId !== v.id && (
                  <div className="mb-3"><VideoShareBlocks video={v} /></div>
                )}
                {editId !== v.id && (
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(v)} className="flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1" style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}>
                      <PenLine size={13} /> עריכת תיאור
                    </button>
                    <button onClick={() => setShareVideo(v)} className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1" style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}>
                      <Share2 size={13} /> שתף
                    </button>
                    <button onClick={() => remove(v)} className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: 'rgba(239,68,68,0.06)', color: '#EF4444' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {shareVideo && (
        <div className="fixed inset-0 z-50">
          <ShareSheet video={shareVideo} onClose={() => setShareVideo(null)} />
        </div>
      )}
    </div>
  );
}