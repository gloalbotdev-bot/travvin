import React, { useState, useRef } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import StarRating from './StarRating';
import { Image } from '@/components/ui/image';

const CATS = [
  { key: 'match', label: 'התאמה לתמונות ותיאור' },
  { key: 'cleanliness', label: 'ניקיון' },
  { key: 'service', label: 'שירות בעל המקום' },
  { key: 'location', label: 'מיקום' },
  { key: 'value', label: 'תמורה למחיר' },
];

const MAX_IMAGES = 6;

export default function ReviewForm({ booking, zimmer, onSubmit, onCancel, saving }) {
  const [general, setGeneral] = useState(5);
  const [cats, setCats] = useState({ match: 5, cleanliness: 5, service: 5, location: 5, value: 5 });
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    onSubmit({ general, cats, text, images });
  };

  const handleFiles = async (files) => {
    const remaining = MAX_IMAGES - images.length;
    const list = Array.from(files).slice(0, remaining);
    if (!list.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const f of list) {
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
          if (file_url) uploaded.push(file_url);
        } catch {}
      }
      if (uploaded.length) setImages(prev => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', borderRadius: '12px', outline: 'none', color: '#1A1A1A' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} dir="rtl">
      <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: '#fff' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-lg" style={{ color: '#1A1A1A' }}>כתיבת ביקורת</h2>
          <button onClick={onCancel} type="button"><X size={18} style={{ color: '#9CA3AF' }} /></button>
        </div>

        <div className="mb-4 p-3 rounded-xl" style={{ background: '#F8F7F4' }}>
          <p className="text-sm font-bold" style={{ color: '#1A1A1A' }}>{zimmer?.name}</p>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>{booking?.check_in} → {booking?.check_out}</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="text-sm font-bold block mb-2" style={{ color: '#1A1A1A' }}>דירוג כללי</label>
            <StarRating value={general} onChange={setGeneral} size={28} />
          </div>
          {CATS.map(c => (
            <div key={c.key}>
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>{c.label}</label>
              <StarRating value={cats[c.key]} onChange={v => setCats(s => ({ ...s, [c.key]: v }))} size={20} />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>תוכן הביקורת *</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              required
              placeholder="ספר/י על החוויה שלך..."
              className="w-full px-4 py-3 text-sm resize-none"
              style={inputStyle}
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>
              תמונות ({images.length}/{MAX_IMAGES})
            </label>
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {images.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden" style={{ border: '1.5px solid #F0EEE8' }}>
                    <Image src={url} className="w-full h-full" fittingType="fill" />
                    <button type="button" onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {images.length < MAX_IMAGES && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                style={{ background: '#F8F7F4', border: '1.5px dashed #D1D5DB', color: '#6B7280' }}>
                {uploading ? <><Loader2 size={14} className="animate-spin" /> מעלה תמונות…</> : <><Camera size={14} /> הוספת תמונות</>}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => handleFiles(e.target.files)} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
              ביטול
            </button>
            <button type="submit" disabled={saving || uploading}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#F97316' }}>
              {saving ? 'שולח...' : 'שלח ביקורת'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}