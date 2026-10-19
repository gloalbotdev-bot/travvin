import React, { useState } from 'react';
import { Plus, Trash2, X, Upload } from 'lucide-react';
import { api } from '@/api/client';
import { OUTDOOR_ITEM_CATALOG, OUTDOOR_PRIVACY_LABELS, isDetailedOutdoorItem } from '@/lib/rooms';

const inputStyle = {
  background: '#F8F7F4',
  border: '1.5px solid #E8E5E0',
  color: '#1A1A1A',
  borderRadius: '12px',
};

const inputFocus = (e) => { e.currentTarget.style.borderColor = '#0B3838'; e.currentTarget.style.background = '#fff'; };
const inputBlur = (e) => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#F8F7F4'; };

const chipActive = { background: '#0B3838', color: '#fff' };
const chipIdle = { background: '#fff', color: '#6B7280', border: '1.5px solid #E8E5E0' };

const draftArea = (v) => ({
  description: v?.description || '',
  size_sqm: v?.size_sqm ?? '',
  privacy: v?.privacy || '',
  photos: Array.isArray(v?.photos) ? v.photos : [],
  items: Array.isArray(v?.items) ? v.items : [],
});

function PrivacyToggle({ value, onChange, allowInherit = false, ariaLabel }) {
  const options = [
    ...(allowInherit ? [['', 'כמו החצר']] : [['', 'לא צוין']]),
    ['private', OUTDOOR_PRIVACY_LABELS.private],
    ['shared', OUTDOOR_PRIVACY_LABELS.shared],
  ];
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={ariaLabel}>
      {options.map(([val, lbl]) => {
        const active = (value || '') === val;
        return (
          <button key={val || 'none'} type="button" role="radio" aria-checked={active} onClick={() => onChange(val)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all" style={active ? chipActive : chipIdle}>
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

export default function OutdoorAreaEditor({ value, onChange, onPhotoUploaded }) {
  const area = draftArea(value);
  const [itemDraft, setItemDraft] = useState('');
  const [uploading, setUploading] = useState(false);

  const patch = (p) => onChange({ ...area, ...p });
  const hasItem = (name) => area.items.some((it) => it.name === name);
  const addItem = (name) => {
    const n = String(name ?? itemDraft).trim();
    if (!n || hasItem(n)) { setItemDraft(''); return; }
    patch({ items: [...area.items, { name: n }] });
    setItemDraft('');
  };
  const updateItem = (i, p) => patch({ items: area.items.map((it, idx) => (idx === i ? { ...it, ...p } : it)) });
  const removeItem = (i) => patch({ items: area.items.filter((_, idx) => idx !== i) });

  const handlePhotos = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setUploading(true);
    const urls = [];
    try {
      for (const file of list) {
        const { file_url } = await api.integrations.Core.UploadFile({ file });
        urls.push(file_url);
        onPhotoUploaded?.(file_url);
      }
    } finally {
      setUploading(false);
      if (urls.length) patch({ photos: [...area.photos, ...urls] });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
        פירוט החצר והאבזור שבחוץ — בריכה, ג׳קוזי, מנגל, דשא וכו׳. הלקוח יראה אזור "מתחם חיצוני" נפרד בדף הצימר, וה-AI ישתמש במידע כדי לענות על שאלות.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>גודל החצר (מ״ר)</label>
          <input type="number" min={0} value={area.size_sqm}
            onChange={(e) => patch({ size_sqm: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })}
            placeholder="למשל 200"
            className="w-full px-3 py-2 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>החצר</label>
          <PrivacyToggle value={area.privacy} onChange={(v) => patch({ privacy: v })} ariaLabel="פרטיות החצר" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>תיאור החצר</label>
        <textarea value={area.description} onChange={(e) => patch({ description: e.target.value })}
          rows={3} placeholder="למשל: חצר מגודרת עם דשא, נוף לכנרת ופינת ישיבה מוצלת"
          className="w-full px-3 py-2 text-sm outline-none transition-all resize-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      </div>

      {/* Items */}
      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>אבזור ומתקנים בחצר ({area.items.length})</label>
        {area.items.length > 0 && (
          <div className="space-y-2 mb-2">
            {area.items.map((it, i) => {
              const detailed = isDetailedOutdoorItem(it.name);
              return (
                <div key={`${it.name}-${i}`} className="rounded-xl p-3" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold" style={{ color: '#0B3838' }}>{it.name}</span>
                    <button type="button" onClick={() => removeItem(i)} aria-label={`הסר ${it.name}`} style={{ color: '#EF4444' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <PrivacyToggle value={it.privacy} onChange={(v) => updateItem(i, { privacy: v || undefined })} allowInherit ariaLabel={`פרטיות ${it.name}`} />
                    {detailed && (
                      <>
                        <div className="flex flex-wrap gap-3">
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#6B7280' }}>
                            <input type="checkbox" checked={!!it.heated} onChange={(e) => updateItem(i, { heated: e.target.checked })} className="w-4 h-4" style={{ accentColor: '#0B3838' }} />
                            מחומם
                          </label>
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#6B7280' }}>
                            <input type="checkbox" checked={!!it.covered} onChange={(e) => updateItem(i, { covered: e.target.checked })} className="w-4 h-4" style={{ accentColor: '#0B3838' }} />
                            מקורה / מוצל
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={it.size || ''} onChange={(e) => updateItem(i, { size: e.target.value })}
                            placeholder="גודל (למשל 4x8 מ׳)" aria-label={`גודל ${it.name}`}
                            className="px-3 py-2 text-xs outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                          <input value={it.hours || ''} onChange={(e) => updateItem(i, { hours: e.target.value })}
                            placeholder="שעות פעילות (למשל 08:00-22:00)" aria-label={`שעות ${it.name}`}
                            className="px-3 py-2 text-xs outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                        </div>
                      </>
                    )}
                    <input value={it.note || ''} onChange={(e) => updateItem(i, { note: e.target.value })}
                      placeholder="הערה (אופציונלי)" aria-label={`הערה ${it.name}`}
                      className="w-full px-3 py-2 text-xs outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          <input value={itemDraft} onChange={(e) => setItemDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
            placeholder="הקלד מתקן + Enter"
            className="flex-1 px-3 py-2 text-xs outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
          <button type="button" onClick={() => addItem()} aria-label="הוסף מתקן" className="px-3 rounded-lg text-xs font-semibold" style={{ background: 'rgba(11,56,56,0.1)', color: '#0B3838' }}>
            <Plus size={13} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {OUTDOOR_ITEM_CATALOG.map((c) => (
            <button key={c.name} type="button" onClick={() => addItem(c.name)} disabled={hasItem(c.name)}
              className="text-xs px-2 py-1 rounded-full border disabled:opacity-40" style={{ borderColor: '#E8E5E0', color: '#6B7280', background: '#fff' }}>
              + {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Photos */}
      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>תמונות החצר ({area.photos.length})</label>
        <div className="grid grid-cols-4 gap-2">
          {area.photos.map((p, i) => (
            <div key={`${p}-${i}`} className="relative aspect-square rounded-lg overflow-hidden group" style={{ background: '#F8F7F4' }}>
              <img src={p} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => patch({ photos: area.photos.filter((_, idx) => idx !== i) })} aria-label="הסר תמונה"
                className="absolute top-1 left-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={10} />
              </button>
            </div>
          ))}
          <label className="aspect-square rounded-lg cursor-pointer flex items-center justify-center" style={inputStyle}>
            {uploading
              ? <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
              : <Upload size={16} style={{ color: '#9CA3AF' }} />}
            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
          </label>
        </div>
      </div>
    </div>
  );
}
