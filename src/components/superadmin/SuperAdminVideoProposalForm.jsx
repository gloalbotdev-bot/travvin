import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/api/client';
import { Upload, X, Send, Plus } from 'lucide-react';

const MAX_DURATION = 45;
const MAX_SIZE = 30 * 1024 * 1024;

// Admin form to propose a video to a zimmer owner. The video is created in
// proposal_status='הצעה' (hidden from the public feed) and the owner gets a
// SystemMessage to approve/reject from their panel.
export default function SuperAdminVideoProposalForm({ onClose, onCreated }) {
  const [zimmers, setZimmers] = useState([]);
  const [loadingZimmers, setLoadingZimmers] = useState(true);
  const [zimmerId, setZimmerId] = useState('');
  const [caption, setCaption] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    api.entities.Zimmer.list('-created_date', 500).then((zs) => {
      setZimmers((zs || []).filter((z) => z.owner_id));
      setLoadingZimmers(false);
    }).catch(() => setLoadingZimmers(false));
  }, []);

  const handleFile = (file) => {
    if (file.size > MAX_SIZE) { setError('הקובץ גדול מדי — עד 30MB בלבד.'); return; }
    if (!file.type.startsWith('video/')) { setError('יש לבחור קובץ וידאו.'); return; }
    setError('');
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = async () => {
      URL.revokeObjectURL(v.src);
      if (v.duration && v.duration > MAX_DURATION) {
        setError(`הסרטון ארוך מדי — עד ${MAX_DURATION} שניות (משך: ${Math.round(v.duration)}s).`);
        return;
      }
      setBusy(true);
      try {
        const { file_url } = await api.integrations.Core.UploadFile({ file });
        setFileUrl(file_url);
        setFileName(file.name);
      } catch (e) {
        setError('שגיאה בהעלאת הסרטון.');
      }
      setBusy(false);
    };
    v.onerror = () => { setError('לא הצלחתי לקרוא את הסרטון.'); };
    v.src = URL.createObjectURL(file);
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) handleFile(f);
  };

  const submit = async () => {
    if (!zimmerId) { setError('בחר צימר.'); return; }
    if (!fileUrl) { setError('העלה קובץ וידאו.'); return; }
    setBusy(true);
    setError('');
    try {
      await api.functions.invoke('createVideoProposal', {
        zimmer_id: zimmerId,
        video_url: fileUrl,
        caption: caption.trim(),
        note: note.trim(),
      });
      onCreated();
      onClose();
    } catch (e) {
      setError('שגיאה ביצירת ההצעה. ודא שלצימר יש בעלים.');
    }
    setBusy(false);
  };

  const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', borderRadius: '12px', outline: 'none' };

  return (
    <div className="rounded-2xl p-5 mb-6" dir="rtl" style={{ background: '#fff', border: '1.5px solid #F0EEE8', fontFamily: 'Heebo, sans-serif' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: '#1A1A1A' }}>
          <Plus size={15} style={{ color: '#F97316' }} /> הצעת סרטון לבעל צימר
        </h3>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F0EEE8', color: '#6B7280' }}><X size={15} /></button>
      </div>
      <p className="text-xs mb-4" style={{ color: '#9CA3AF' }}>הסרטון ייווצר בסטטוס "הצעה" ולא יופיע בפיד עד שהבעלים יאשר. נשלחת הודעה לבעלים.</p>

      {error && <div className="mb-3 text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>{error}</div>}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>בחר צימר</label>
          <select value={zimmerId} onChange={(e) => setZimmerId(e.target.value)} disabled={loadingZimmers}
            className="w-full px-4 py-3 text-sm" style={inputStyle}>
            <option value="" disabled>{loadingZimmers ? 'טוען...' : 'בחר צימר...'}</option>
            {zimmers.map((z) => <option key={z.id} value={z.id}>{z.name}{z.owner_name ? ` · ${z.owner_name}` : ''}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>קובץ וידאו (עד 45 שנ׳, 30MB)</label>
          {fileUrl ? (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(34,197,94,0.06)', border: '1.5px solid #BBF7D0' }}>
              <span className="text-xs font-medium flex-1 truncate" style={{ color: '#16A34A' }}>{fileName || 'קובץ הועלה'}</span>
              <button onClick={() => { setFileUrl(''); setFileName(''); }} className="text-xs" style={{ color: '#EF4444' }}><X size={14} /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60" style={{ background: '#0B3838' }}>
              {busy ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> מעלה...</> : <><Upload size={16} /> בחר קובץ</>}
            </button>
          )}
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onPick} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>תיאור קצר (אופציונלי)</label>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="למשל: הנוף מהמרפסת..."
            className="w-full px-4 py-3 text-sm" style={inputStyle} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>הערה לבעלים (אופציונלי)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="הקשר או הנחיה לבעלים..."
            className="w-full px-4 py-3 text-sm" style={inputStyle} />
        </div>

        <button onClick={submit} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60" style={{ background: '#F97316' }}>
          <Send size={16} /> {busy ? 'שולח...' : 'שלח הצעה לבעלים'}
        </button>
      </div>
    </div>
  );
}