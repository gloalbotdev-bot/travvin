import React, { useState, useRef } from 'react';
import { Plus, Trash2, X, Upload } from 'lucide-react';
import { api } from '@/api/client';
import { BED_TYPES } from '@/lib/rooms';

const inputStyle = {
  background: '#F8F7F4',
  border: '1.5px solid #E8E5E0',
  color: '#1A1A1A',
  borderRadius: '12px',
};

const inputFocus = (e) => { e.currentTarget.style.borderColor = '#0B3838'; e.currentTarget.style.background = '#fff'; };
const inputBlur = (e) => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#F8F7F4'; };

const ROOM_AMENITY_SUGGESTIONS = ['טלוויזיה', 'מזגן', 'מאוורר', 'מרפסת פרטית', 'מקלחון מפנק', 'אח קטנה', 'קומקום', 'נטפליקס'];

// Normalize any room (old beds_count/bed_type OR new beds[]) to a working shape.
const normalizeRoom = (r) => ({
  ...r,
  room_name: r.room_name || '',
  beds: Array.isArray(r.beds) && r.beds.length
    ? r.beds.map((b) => ({ bed_type: b.bed_type || 'queen', count: Math.max(1, Number(b.count) || 1) }))
    : [{ bed_type: r.bed_type || 'queen', count: Math.max(1, Number(r.beds_count) || 1) }],
  max_guests_in_room: r.max_guests_in_room ?? '',
  has_bathroom: !!r.has_bathroom,
  room_photo: r.room_photo || '',
  amenities: Array.isArray(r.amenities) ? r.amenities : [],
});

export default function RoomsDetailEditor({ value, onChange, additionalBathrooms, onAdditionalBathroomsChange }) {
  const rawRooms = Array.isArray(value) ? value : [];
  const [amenityDraft, setAmenityDraft] = useState({});

  const addRoom = () => onChange([...rawRooms, { room_name: '', beds: [{ bed_type: 'queen', count: 1 }], has_bathroom: false, amenities: [], room_photo: '' }]);
  const updateRoom = (i, patch) => {
    const next = rawRooms.map((r) => normalizeRoom(r));
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const removeRoom = (i) => onChange(rawRooms.filter((_, idx) => idx !== i));

  const addBed = (i) => {
    const room = normalizeRoom(rawRooms[i]);
    updateRoom(i, { beds: [...room.beds, { bed_type: 'single', count: 1 }] });
  };
  const updateBed = (i, bi, patch) => {
    const room = normalizeRoom(rawRooms[i]);
    const beds = room.beds.map((b, idx) => (idx === bi ? { ...b, ...patch } : b));
    updateRoom(i, { beds });
  };
  const removeBed = (i, bi) => {
    const room = normalizeRoom(rawRooms[i]);
    if (room.beds.length <= 1) return; // keep at least one bed entry
    updateRoom(i, { beds: room.beds.filter((_, idx) => idx !== bi) });
  };

  const addAmenity = (i) => {
    const val = (amenityDraft[i] || '').trim();
    if (!val) return;
    const room = normalizeRoom(rawRooms[i]);
    updateRoom(i, { amenities: [...room.amenities, val] });
    setAmenityDraft((d) => ({ ...d, [i]: '' }));
  };
  const removeAmenity = (i, ai) => {
    const room = normalizeRoom(rawRooms[i]);
    updateRoom(i, { amenities: room.amenities.filter((_, idx) => idx !== ai) });
  };

  const handleRoomPhoto = async (i, file) => {
    if (!file) return;
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    updateRoom(i, { room_photo: file_url });
  };

  const rooms = rawRooms.map(normalizeRoom);

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
        לכל חדר הגדר שם (אופציונלי), סוגי מיטות וכמויות, קיבולת אורחים, חדר רחצה צמוד, תמונה ומתקנים מיוחדים. הלקוח יראה סה״כ מיטות, סה״כ חדרי רחצה ופירוט בדף הצימר.
      </p>

      {rooms.length === 0 ? (
        <div className="rounded-xl py-5 text-center" style={{ background: '#F8F7F4', border: '1.5px dashed #E8E5E0' }}>
          <p className="text-sm" style={{ color: '#6B7280' }}>אין פירוט חדרים עדיין</p>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>בלי פירוט, בכרטיס החיפוש לא יופיע "מיטות" — תוצג רק קיבולת אורחים</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room, idx) => (
            <div key={idx} className="rounded-xl p-4" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold" style={{ color: '#0B3838' }}>חדר {idx + 1}</span>
                <button type="button" onClick={() => removeRoom(idx)} className="transition-colors" style={{ color: '#EF4444' }}>
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Room name + photo */}
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>שם חדר (אופציונלי)</label>
                  <input value={room.room_name} onChange={(e) => updateRoom(idx, { room_name: e.target.value })}
                    placeholder="למשל חדר שינה ראשי"
                    className="w-full px-3 py-2 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div className="w-24 flex-shrink-0">
                  <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>תמונת חדר</label>
                  <label className="block aspect-square rounded-lg cursor-pointer overflow-hidden flex items-center justify-center" style={inputStyle}>
                    {room.room_photo ? (
                      <img src={room.room_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Upload size={16} style={{ color: '#9CA3AF' }} />
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleRoomPhoto(idx, e.target.files?.[0])} />
                  </label>
                </div>
              </div>

              {/* Beds list — multiple bed types per room */}
              <div className="mb-3">
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מיטות בחדר</label>
                <div className="space-y-1.5">
                  {room.beds.map((b, bi) => (
                    <div key={bi} className="flex gap-2 items-center">
                      <select value={b.bed_type} onChange={(e) => updateBed(idx, bi, { bed_type: e.target.value })}
                        className="flex-1 px-3 py-2 text-sm outline-none" style={inputStyle}>
                        {BED_TYPES.map((bt) => <option key={bt.key} value={bt.key}>{bt.label}</option>)}
                      </select>
                      <input type="number" min={1} max={20} value={b.count}
                        onChange={(e) => updateBed(idx, bi, { count: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-20 px-3 py-2 text-sm outline-none text-center" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                      <button type="button" onClick={() => removeBed(idx, bi)} disabled={room.beds.length <= 1}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30" style={{ color: '#EF4444' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addBed(idx)} className="flex items-center gap-1 text-xs font-semibold mt-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(11,56,56,0.1)', color: '#0B3838' }}>
                  <Plus size={12} /> סוג מיטה נוסף
                </button>
              </div>

              {/* Capacity + bathroom */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>קיבולת אורחים בחדר</label>
                  <input type="number" min={1} max={30} value={room.max_guests_in_room}
                    onChange={(e) => updateRoom(idx, { max_guests_in_room: e.target.value === '' ? '' : Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} placeholder="אוטומטי" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input type="checkbox" checked={!!room.has_bathroom} onChange={(e) => updateRoom(idx, { has_bathroom: e.target.checked })} className="w-4 h-4" style={{ accentColor: '#0B3838' }} />
                    <span className="text-xs font-medium" style={{ color: '#6B7280' }}>חדר רחצה צמוד</span>
                  </label>
                </div>
              </div>

              {/* Amenities */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>מתקנים מיוחדים בחדר</label>
                {room.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {room.amenities.map((a, ai) => (
                      <span key={ai} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: '#0B3838', color: '#fff' }}>
                        {a}
                        <button type="button" onClick={() => removeAmenity(idx, ai)} className="hover:opacity-70"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={amenityDraft[idx] || ''} onChange={(e) => setAmenityDraft((d) => ({ ...d, [idx]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(idx); } }}
                    placeholder="הקלד מתקן + Enter"
                    className="flex-1 px-3 py-2 text-xs outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                  <button type="button" onClick={() => addAmenity(idx)} className="px-3 rounded-lg text-xs font-semibold" style={{ background: 'rgba(11,56,56,0.1)', color: '#0B3838' }}>
                    <Plus size={13} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {ROOM_AMENITY_SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => { if (!room.amenities.includes(s)) updateRoom(idx, { amenities: [...room.amenities, s] }); }}
                      className="text-xs px-2 py-1 rounded-full border" style={{ borderColor: '#E8E5E0', color: '#6B7280', background: '#fff' }}>
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={addRoom}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all" style={{ background: 'rgba(11,56,56,0.1)', color: '#0B3838' }}>
        <Plus size={13} /> הוסף חדר
      </button>

      <div className="rounded-xl p-4" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
        <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>חדרי רחצה נוספים / משותפים</label>
        <input type="number" min={0} max={20} value={additionalBathrooms ?? 0}
          onChange={(e) => onAdditionalBathroomsChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full md:w-40 px-3 py-2 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
        <p className="text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>למשל שירותי אורחים נפרדים שלא שייכים לחדר שינה ספציפי.</p>
      </div>
    </div>
  );
}