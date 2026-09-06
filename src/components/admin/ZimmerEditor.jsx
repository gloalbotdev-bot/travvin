import React, { useState } from 'react';
import { api } from '@/api/client';
import { ArrowRight, Plus, Trash2, Upload, X } from 'lucide-react';
import RoomsDetailEditor from '@/components/chat/RoomsDetailEditor';
import DateRangeField from '@/components/common/DateRangeField';
import ZimmerLocationTab from '@/components/admin/ZimmerLocationTab';

const SOURCE_TYPES = ['שיחת טלפון', 'שיחת וואטסאפ', 'טקסט חופשי', 'שאלות ותשובות'];

const inputStyle = {
  background: '#F8F7F4',
  border: '1.5px solid #E8E5E0',
  color: '#1A1A1A',
  borderRadius: '12px',
};

const inputFocus = (e) => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; };
const inputBlur = (e) => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#F8F7F4'; };

const TABS = [
  { id: 'basic', label: 'מפרט בסיסי' },
  { id: 'rooms', label: 'חדרים ומתקנים' },
  { id: 'price', label: 'מחיר ותנאים' },
  { id: 'settings', label: 'הגדרות וחשיפה' },
  { id: 'location', label: 'מיקום וכתובת' },
];

export default function ZimmerEditor({ zimmer, onSave, onCancel, onDelete, initialTab = 'basic' }) {
  const [form, setForm] = useState({
    ...zimmer,
    images: zimmer.images || [],
    data_zones: zimmer.data_zones || [],
    weekday_price: zimmer.weekday_price ?? '',
    weekend_price: zimmer.weekend_price ?? '',
    partial_pricing_enabled: zimmer.partial_pricing_enabled || false,
    min_guests: zimmer.min_guests ?? '',
    price_per_adult: zimmer.price_per_adult ?? '',
    price_per_child: zimmer.price_per_child ?? '',
    seasonal_pricing: zimmer.seasonal_pricing || [],
    rooms_detail: Array.isArray(zimmer.rooms_detail) ? zimmer.rooms_detail : [],
    additional_bathrooms_count: zimmer.additional_bathrooms_count ?? 0,
    contact_phone: zimmer.contact_phone ?? '',
    expose_availability_calendar: zimmer.expose_availability_calendar || false,
    amenities: Array.isArray(zimmer.amenities) ? zimmer.amenities : [],
    size_sqm: zimmer.size_sqm ?? '',
    max_guests_event: zimmer.max_guests_event ?? '',
    extra_guest_fee: zimmer.extra_guest_fee ?? '',
    breakfast_fee: zimmer.breakfast_fee ?? '',
    cancellation_policy_text: zimmer.cancellation_policy_text ?? '',
    payment_methods: Array.isArray(zimmer.payment_methods) ? zimmer.payment_methods : [],
    smoking_policy: zimmer.smoking_policy ?? '',
    nearby_landmarks: zimmer.nearby_landmarks || []
  });
  const [tab, setTab] = useState(initialTab);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [amenityDraft, setAmenityDraft] = useState('');
  const [landmarkDraft, setLandmarkDraft] = useState({ name: '', travel_time_minutes: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const addSeasonal = () => setForm(f => ({
    ...f,
    seasonal_pricing: [...(f.seasonal_pricing || []), { label: '', start_date: '', end_date: '', adjustment: 'increase', percentage: '' }]
  }));
  const updateSeasonal = (idx, field, val) => setForm(f => {
    const rules = [...(f.seasonal_pricing || [])];
    rules[idx] = { ...rules[idx], [field]: val };
    return { ...f, seasonal_pricing: rules };
  });
  const removeSeasonal = (idx) => setForm(f => ({ ...f, seasonal_pricing: (f.seasonal_pricing || []).filter((_, i) => i !== idx) }));

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingImg(true);
    for (const file of files) {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, images: [...f.images, file_url] }));
    }
    setUploadingImg(false);
  };

  const removeImage = (idx) => setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  // Amenities (flat list)
  const AMENITY_SUGGESTIONS = ['Wi-Fi', 'מזגן', 'טלוויזיה', 'מקלחת פינוקית', 'מטבחון', 'מקרר', 'מדיח כלים', 'בריכה פרטית', "ג'קוזי", 'סאונה', 'מנגל', 'חניה', 'חימום', 'אח', 'מגבות', 'מייבש שיער', 'נטפליקס', 'חצר פרטית', 'נוף מרשים', 'ערסל', 'משחקי ילדים'];
  const addAmenity = (val) => {
    const v = (val ?? amenityDraft).trim();
    if (!v) return;
    setForm(f => f.amenities.includes(v) ? f : ({ ...f, amenities: [...f.amenities, v] }));
    setAmenityDraft('');
  };
  const removeAmenity = (i) => setForm(f => ({ ...f, amenities: f.amenities.filter((_, idx) => idx !== i) }));

  // Nearby landmarks
  const addLandmark = () => {
    const name = landmarkDraft.name.trim();
    if (!name) return;
    setForm(f => ({ ...f, nearby_landmarks: [...f.nearby_landmarks, { name, travel_time_minutes: landmarkDraft.travel_time_minutes === '' ? null : Number(landmarkDraft.travel_time_minutes) }] }));
    setLandmarkDraft({ name: '', travel_time_minutes: '' });
  };
  const removeLandmark = (i) => setForm(f => ({ ...f, nearby_landmarks: f.nearby_landmarks.filter((_, idx) => idx !== i) }));
  const togglePayment = (method) => setForm(f => ({ ...f, payment_methods: f.payment_methods.includes(method) ? f.payment_methods.filter(m => m !== method) : [...f.payment_methods, method] }));

  const PAYMENT_METHODS = ['מזומן', 'העברה בנקאית', 'כרטיס אשראי'];
  const SMOKING_OPTIONS = ['', 'אסור לגמרי', 'מותר במרפסות בלבד', 'מותר'];

  const addZone = () => {
    if (form.data_zones.length >= 10) return;
    setForm(f => ({ ...f, data_zones: [...f.data_zones, { content: '', source_label: '', source_type: 'טקסט חופשי', source_date: '' }] }));
  };

  const updateZone = (idx, field, val) => {
    setForm(f => {
      const zones = [...f.data_zones];
      zones[idx] = { ...zones[idx], [field]: val };
      return { ...f, data_zones: zones };
    });
  };

  const removeZone = (idx) => setForm(f => ({ ...f, data_zones: f.data_zones.filter((_, i) => i !== idx) }));

  // Rooms detail (beds per room, bed type, bathroom, amenities)
  const updateRooms = (rooms) => setForm(f => ({ ...f, rooms_detail: rooms }));
  const updateAdditionalBathrooms = (n) => setForm(f => ({ ...f, additional_bathrooms_count: n }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
    const cleaned = {
      ...form,
      price_per_night: num(form.price_per_night),
      weekday_price: num(form.weekday_price),
      weekend_price: num(form.weekend_price),
      num_rooms: num(form.num_rooms),
      max_guests: num(form.max_guests),
      max_guests_event: num(form.max_guests_event),
      size_sqm: num(form.size_sqm),
      extra_guest_fee: num(form.extra_guest_fee),
      breakfast_fee: num(form.breakfast_fee),
      min_guests: form.partial_pricing_enabled ? num(form.min_guests) : null,
      price_per_adult: form.partial_pricing_enabled ? num(form.price_per_adult) : null,
      price_per_child: form.partial_pricing_enabled ? num(form.price_per_child) : null,
      seasonal_pricing: (form.seasonal_pricing || []).map(r => ({ ...r, label: (r.label || '').trim() || null, percentage: r.percentage === '' ? null : Number(r.percentage) })),
      rooms_detail: (form.rooms_detail || []).map(r => {
        const beds = Array.isArray(r.beds) && r.beds.length
          ? r.beds.map(b => ({ bed_type: b.bed_type || 'queen', count: Math.max(1, Number(b.count) || 1) }))
          : [{ bed_type: r.bed_type || 'queen', count: Math.max(1, Number(r.beds_count) || 1) }];
        const beds_count = beds.reduce((s, b) => s + b.count, 0);
        return {
          room_name: r.room_name || null,
          beds,
          beds_count,
          bed_type: beds[0]?.bed_type || 'queen',
          max_guests_in_room: r.max_guests_in_room === '' || r.max_guests_in_room == null ? null : Number(r.max_guests_in_room),
          has_bathroom: !!r.has_bathroom,
          room_photo: r.room_photo || null,
          amenities: (r.amenities || []).filter(a => String(a).trim())
        };
      }),
      additional_bathrooms_count: Math.max(0, Number(form.additional_bathrooms_count) || 0),
      amenities: (form.amenities || []).filter(a => String(a).trim()),
      cancellation_policy_text: (form.cancellation_policy_text || '').trim() || null,
      payment_methods: form.payment_methods || [],
      smoking_policy: form.smoking_policy || null,
      nearby_landmarks: (form.nearby_landmarks || []).map(l => ({ name: String(l.name || '').trim(), travel_time_minutes: l.travel_time_minutes == null ? null : Number(l.travel_time_minutes) })).filter(l => l.name),
      contact_phone: (form.contact_phone || '').trim() || null,
      expose_availability_calendar: !!form.expose_availability_calendar,
      // Reset AI description-cards cache so it regenerates against the new description text
      description_cards: [],
      description_cards_snapshot: null
    };
    setSaving(true);
    await onSave(cleaned);
    setSaving(false);
  };

  return (
    <div className="min-h-screen" dir="rtl" style={{ background: '#F8F7F4', fontFamily: 'Heebo, sans-serif' }}>
      <div className="max-w-3xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onCancel}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white"
            style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
            <ArrowRight size={17} />
          </button>
          <div>
            <h1 className="text-xl font-black" style={{ color: '#1A1A1A' }}>{zimmer.id ? 'עריכת צימר' : 'צימר חדש'}</h1>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>מלא את פרטי הצימר</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto" style={{ background: '#ECEAE4' }}>
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className="flex-1 min-w-fit py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap"
              style={tab === t.id ? { background: '#fff', color: '#1A1A1A', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: '#6B7280' }}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ===== TAB 1: מפרט בסיסי ===== */}
          {tab === 'basic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left — Media */}
              <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <h2 className="font-bold text-xs uppercase tracking-widest mb-5 flex items-center gap-2" style={{ color: '#F97316' }}>
                  <Upload size={13} /> מדיה ותמונות ({form.images.length}/20)
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {form.images.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden group" style={{ background: '#F8F7F4' }}>
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeImage(i)}
                        className="absolute top-1 left-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  {form.images.length < 20 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:border-orange-300"
                      style={{ borderColor: '#E8E5E0' }}>
                      {uploadingImg
                        ? <div className="w-5 h-5 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                        : <><Upload size={18} style={{ color: '#9CA3AF' }} /><span className="text-xs mt-1" style={{ color: '#9CA3AF' }}>הוסף</span></>
                      }
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>
                <p className="text-[11px] mt-3 leading-relaxed" style={{ color: '#9CA3AF' }}>PNG, JPG ופורמטים נוספים. עד 20 תמונות.</p>
              </section>

              {/* Right — General details */}
              <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <h2 className="font-bold text-xs uppercase tracking-widest mb-5" style={{ color: '#F97316' }}>פרטים כלליים</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>שם הצימר *</label>
                    <input required value={form.name} onChange={e => update('name', e.target.value)}
                      className="w-full px-4 py-3 text-sm outline-none transition-all"
                      style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                      placeholder="שם הצימר" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מיקום</label>
                    <input value={form.location || ''} onChange={e => update('location', e.target.value)}
                      className="w-full px-4 py-3 text-sm outline-none transition-all"
                      style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                      placeholder="עיר / אזור" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מספר חדרים</label>
                      <input type="number" value={form.num_rooms || ''} onChange={e => update('num_rooms', e.target.value)}
                        className="w-full px-4 py-3 text-sm outline-none transition-all"
                        style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                        placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>אורחים לשינה</label>
                      <input type="number" value={form.max_guests || ''} onChange={e => update('max_guests', e.target.value)}
                        className="w-full px-4 py-3 text-sm outline-none transition-all"
                        style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                        placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>אורחים לאירוע (מקס׳)</label>
                    <input type="number" value={form.max_guests_event || ''} onChange={e => update('max_guests_event', e.target.value)}
                      className="w-full px-4 py-3 text-sm outline-none transition-all"
                      style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                      placeholder="0" />
                    <p className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>לאירועים/אירוע יוקרתי — אופציונלי.</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>תיאור חופשי</label>
                    <textarea value={form.description || ''} onChange={e => update('description', e.target.value)}
                      rows={4} placeholder="תאר את הצימר בחופשיות..."
                      className="w-full px-4 py-3 text-sm outline-none transition-all resize-none"
                      style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ===== TAB 2: חדרים ומתקנים ===== */}
          {tab === 'rooms' && (
            <>
              {/* Rooms detail */}
              <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <h2 className="font-bold text-xs uppercase tracking-widest mb-5" style={{ color: '#0B3838' }}>פירוט חדרים ומתקנים</h2>
                <RoomsDetailEditor
                  value={form.rooms_detail}
                  onChange={updateRooms}
                  additionalBathrooms={form.additional_bathrooms_count}
                  onAdditionalBathroomsChange={updateAdditionalBathrooms}
                />
              </section>

              {/* Amenities + size */}
              <section className="rounded-2xl p-6 space-y-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#0B3838' }}>מתקנים וממדים</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>גודל הנכס (מ״ר)</label>
                    <input type="number" min={0} value={form.size_sqm} onChange={e => update('size_sqm', e.target.value)}
                      className="w-full px-4 py-3 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} placeholder="למשל 80" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-2" style={{ color: '#6B7280' }}>מתקנים ברמת הנכס ({form.amenities.length})</label>
                  {form.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {form.amenities.map((a, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: '#0B3838', color: '#fff' }}>
                          {a}
                          <button type="button" onClick={() => removeAmenity(i)} className="hover:opacity-70"><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input value={amenityDraft} onChange={e => setAmenityDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(); } }}
                      placeholder="הקלד מתקן + Enter"
                      className="flex-1 px-4 py-2.5 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                    <button type="button" onClick={() => addAmenity()} className="px-4 rounded-xl text-sm font-semibold" style={{ background: 'rgba(11,56,56,0.1)', color: '#0B3838' }}>
                      <Plus size={15} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {AMENITY_SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => addAmenity(s)} disabled={form.amenities.includes(s)}
                        className="text-xs px-2 py-1 rounded-full border disabled:opacity-40" style={{ borderColor: '#E8E5E0', color: '#6B7280', background: '#fff' }}>
                        + {s}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] mt-2" style={{ color: '#9CA3AF' }}>
                    המתקנים מסווגים אוטומטית ל-3 קבוצות בדף הצימר (בנכס / בחוץ / בסביבה) לפי מילות מפתח.
                  </p>
                </div>
              </section>

              {/* Nearby landmarks */}
              <section className="rounded-2xl p-6 space-y-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#0B3838' }}>אתרים מוכרים בסביבה ({form.nearby_landmarks.length})</h2>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>למשל חוף הכינרת · 8 דק, מצפה · 15 דק. מוצג ללקוח כתגיות מרחק.</p>
                {form.nearby_landmarks.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.nearby_landmarks.map((l, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8', color: '#0B3838' }}>
                        {l.name}{l.travel_time_minutes != null && <span style={{ color: '#9CA3AF' }}>· {l.travel_time_minutes} דק</span>}
                        <button type="button" onClick={() => removeLandmark(i)} className="hover:opacity-70"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={landmarkDraft.name} onChange={e => setLandmarkDraft(d => ({ ...d, name: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLandmark(); } }}
                    placeholder="שם האתר"
                    className="flex-1 px-4 py-2.5 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                  <input type="number" min={0} value={landmarkDraft.travel_time_minutes}
                    onChange={e => setLandmarkDraft(d => ({ ...d, travel_time_minutes: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLandmark(); } }}
                    placeholder="דק'"
                    className="w-24 px-4 py-2.5 text-sm outline-none transition-all text-center" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                  <button type="button" onClick={addLandmark} className="px-4 rounded-xl text-sm font-semibold" style={{ background: 'rgba(11,56,56,0.1)', color: '#0B3838' }}>
                    <Plus size={15} />
                  </button>
                </div>
              </section>
            </>
          )}

          {/* ===== TAB 3: מחיר ותנאים ===== */}
          {tab === 'price' && (
            <>
              {/* Base prices */}
              <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <h2 className="font-bold text-xs uppercase tracking-widest mb-5" style={{ color: '#F97316' }}>מחירים</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מחיר בסיס ללילה (₪)</label>
                    <input type="number" value={form.price_per_night || ''} onChange={e => update('price_per_night', e.target.value)}
                      className="w-full px-4 py-3 text-sm outline-none transition-all"
                      style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                      placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מחיר אמצ"ש א'-ה' (₪)</label>
                    <input type="number" value={form.weekday_price || ''} onChange={e => update('weekday_price', e.target.value)}
                      className="w-full px-4 py-3 text-sm outline-none transition-all"
                      style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                      placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מחיר סופ"ש ה'-ש' (₪)</label>
                    <input type="number" value={form.weekend_price || ''} onChange={e => update('weekend_price', e.target.value)}
                      className="w-full px-4 py-3 text-sm outline-none transition-all"
                      style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                      placeholder="0" />
                  </div>
                </div>
                <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: '#9CA3AF' }}>
                  מחיר נפרד לאמצע השבוע (א'-ה') ולסוף השבוע (ה'-ש'). ריק = שימוש במחיר הבסיס. לילות חמישי ושישי נחשבים סוף שבוע.
                </p>
              </section>

              {/* Partial pricing */}
              <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#F97316' }}>תמחור חלקי (תפוסה)</h2>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form.partial_pricing_enabled}
                      onChange={e => update('partial_pricing_enabled', e.target.checked)}
                      className="w-4 h-4 accent-orange-500" />
                    <span className="text-xs font-medium" style={{ color: '#6B7280' }}>הפעל תמחור לפי אדם</span>
                  </label>
                </div>
                {form.partial_pricing_enabled ? (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
                      כשהתמחור החלקי מופעל, ניתן להשכיר את הצימר לקבוצה קטנה מהתפוסה המלאה לפי מחיר למבוגר ולילד.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>אורחים מינימליים</label>
                        <input type="number" min={1} value={form.min_guests} onChange={e => update('min_guests', e.target.value)}
                          className="w-full px-4 py-3 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} placeholder="2" />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מחיר למבוגר (₪/לילה)</label>
                        <input type="number" min={0} value={form.price_per_adult} onChange={e => update('price_per_adult', e.target.value)}
                          className="w-full px-4 py-3 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} placeholder="0" />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מחיר לילד (₪/לילה)</label>
                        <input type="number" min={0} value={form.price_per_child} onChange={e => update('price_per_child', e.target.value)}
                          className="w-full px-4 py-3 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} placeholder="0" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>כבוי — הצימר מושכר במחיר מלא בלבד, ללא תלות במספר האורחים.</p>
                )}
              </section>

              {/* Seasonal pricing */}
              <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#F97316' }}>תמחור עונתי ({(form.seasonal_pricing || []).length})</h2>
                  <button type="button" onClick={addSeasonal}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
                    <Plus size={13} /> הוסף תקופה
                  </button>
                </div>
                <p className="text-xs mb-4 leading-relaxed" style={{ color: '#9CA3AF' }}>
                  גרור את הפס להעלאה או הורדה של המחיר (מינוס 80% עד פלוס 200%). לחלופין, הזן מחיר מוחלט — והוא יעקוף את האחוזים.
                </p>
                {(form.seasonal_pricing || []).length === 0 ? (
                  <div className="text-center py-6" style={{ color: '#9CA3AF' }}>
                    <p className="text-sm">אין תקופות עונתיות</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(form.seasonal_pricing || []).map((rule, idx) => {
                      const hasAbsolute = rule.price_per_night !== '' && rule.price_per_night != null;
                      const pct = rule.adjustment === 'decrease' ? -(rule.percentage || 0) : (rule.percentage || 0);
                      return (
                        <div key={idx} className="rounded-xl p-4" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
                          <div className="flex items-center justify-between mb-3 gap-2">
                            <input
                              type="text"
                              value={rule.label || ''}
                              onChange={e => updateSeasonal(idx, 'label', e.target.value)}
                              placeholder="תקופה"
                              className="text-sm font-bold bg-transparent outline-none flex-1 min-w-0 transition-all"
                              style={{
                                background: 'linear-gradient(90deg, #9CA3AF 0%, #6B7280 100%)',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                color: 'transparent',
                                cursor: 'text',
                              }}
                            />
                            <button type="button" onClick={() => removeSeasonal(idx)} className="transition-colors flex-shrink-0" style={{ color: '#EF4444' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            <div>
                              <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>תקופה</label>
                              <DateRangeField
                                start={rule.start_date || ''}
                                end={rule.end_date || ''}
                                allowPast
                                onChange={(s, e) => { updateSeasonal(idx, 'start_date', s); updateSeasonal(idx, 'end_date', e); }}
                                placeholder="בחר תקופה"
                                compact
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>מחיר מוחלט (₪)</label>
                              <input type="number" min={0} value={rule.price_per_night ?? ''} onChange={e => updateSeasonal(idx, 'price_per_night', e.target.value)}
                                className="w-full px-3 py-2 text-xs outline-none" style={{ ...inputStyle, borderRadius: '10px' }} onFocus={inputFocus} onBlur={inputBlur} placeholder="ריק = לפי אחוזים" />
                            </div>
                          </div>
                          <div className={hasAbsolute ? 'opacity-40 pointer-events-none' : ''}>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-medium" style={{ color: '#6B7280' }}>התאמת אחוז</label>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: pct > 0 ? 'rgba(249,115,22,0.12)' : pct < 0 ? 'rgba(59,130,246,0.12)' : '#F0EEE8', color: pct > 0 ? '#EA580C' : pct < 0 ? '#1D4ED8' : '#9CA3AF' }}>
                                {pct > 0 ? '+' : ''}{pct}%
                              </span>
                            </div>
                            <input type="range" min={-80} max={200} step={5} value={pct}
                              onChange={e => {
                                const v = Number(e.target.value);
                                updateSeasonal(idx, 'adjustment', v >= 0 ? 'increase' : 'decrease');
                                updateSeasonal(idx, 'percentage', Math.abs(v));
                              }}
                              className="w-full accent-orange-500" />
                            <div className="flex justify-between mt-1 text-[10px]" style={{ color: '#9CA3AF' }}>
                              <span>−80%</span><span>0</span><span>+200%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Extras */}
              <section className="rounded-2xl p-6 space-y-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#0B3838' }}>תוספות מחיר</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>תוספת אורח מעבר למחיר המלא (₪/לילה)</label>
                    <input type="number" min={0} value={form.extra_guest_fee} onChange={e => update('extra_guest_fee', e.target.value)}
                      className="w-full px-4 py-3 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>תוספת ארוחת בוקר (₪/לילה/אורח)</label>
                    <input type="number" min={0} value={form.breakfast_fee} onChange={e => update('breakfast_fee', e.target.value)}
                      className="w-full px-4 py-3 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} placeholder="0" />
                  </div>
                </div>
              </section>

              {/* Policy & cancellation */}
              <section className="rounded-2xl p-6 space-y-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#0B3838' }}>מדיניות, תשלום ועישון</h2>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מדיניות ביטול</label>
                  <textarea value={form.cancellation_policy_text} onChange={e => update('cancellation_policy_text', e.target.value)}
                    rows={3} placeholder="למשל: ביטול עד 7 ימים לפני ההגעה — החזר מלא. ביטול מאוחר יותר — חיוב לילה ראשון."
                    className="w-full px-4 py-3 text-sm outline-none transition-all resize-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                  <p className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>שדה עובדתי — מלא רק את המדיניות שאישרת בפועל.</p>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>אמצעי תשלום מקובלים</label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHODS.map((m) => (
                      <button key={m} type="button" onClick={() => togglePayment(m)}
                        className="text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                        style={form.payment_methods.includes(m)
                          ? { background: '#0B3838', color: '#fff' }
                          : { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
                        {form.payment_methods.includes(m) ? '✓ ' : ''}{m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מדיניות עישון</label>
                  <select value={form.smoking_policy} onChange={e => update('smoking_policy', e.target.value)}
                    className="w-full px-4 py-3 text-sm outline-none" style={inputStyle}>
                    {SMOKING_OPTIONS.map((o, i) => <option key={i} value={o}>{o || '— לא צוין —'}</option>)}
                  </select>
                </div>
              </section>
            </>
          )}

          {/* ===== TAB 4: הגדרות וחשיפה ===== */}
          {tab === 'settings' && (
            <>
              {/* Availability + contact */}
              <section className="rounded-2xl p-6 space-y-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#0B3838' }}>יצירת קשר וחשיפת זמינות</h2>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>טלפון / וואטסאפ ליצירת קשר</label>
                  <input type="tel" value={form.contact_phone || ''} onChange={e => update('contact_phone', e.target.value)}
                    className="w-full px-4 py-3 text-sm outline-none transition-all" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                    placeholder="050-1234567 או 972501234567" />
                  <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: '#888888' }}>
                    יומר אוטומטית לפורמט בינלאומי (wa.me). ריק = לא יוצג כפתור וואטסאפ ללקוח.
                  </p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer rounded-xl p-3" style={{ background: '#F2F2F2', border: '1px solid #DCDCDC' }}>
                  <input type="checkbox" checked={!!form.expose_availability_calendar}
                    onChange={e => update('expose_availability_calendar', e.target.checked)}
                    className="w-4 h-4" style={{ accentColor: '#333333' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#333333' }}>הצג מיני-יומן זמינות ללקוחות</p>
                    <p className="text-xs" style={{ color: '#777777' }}>כשמופעל, דף הצימר יציג ללקוחות יומן זמינות קומפקטי ל-6 שבועות קרובים.</p>
                  </div>
                </label>
              </section>

              {/* Data Zones */}
              <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: '#F97316' }}>אזורי מידע ({form.data_zones.length}/10)</h2>
                  {form.data_zones.length < 10 && (
                    <button type="button" onClick={addZone}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                      style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
                      <Plus size={13} /> הוסף אזור
                    </button>
                  )}
                </div>
                <p className="text-xs mb-4 leading-relaxed" style={{ color: '#9CA3AF' }}>
                  מידע שנאסף משיחות עם לקוחות — מוזן ל-AI כדי לשפר את התשובות בצ'אט ואת סיכום המידע ללקוח.
                </p>
                {form.data_zones.length === 0 ? (
                  <div className="text-center py-8" style={{ color: '#9CA3AF' }}>
                    <p className="text-sm">אין אזורי מידע עדיין</p>
                    <p className="text-xs mt-1">הוסף מידע שנאסף משיחות עם לקוחות</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {form.data_zones.map((zone, idx) => (
                      <div key={idx} className="rounded-xl p-4" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>אזור {idx + 1}</span>
                          <button type="button" onClick={() => removeZone(idx)} className="transition-colors" style={{ color: '#EF4444' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <textarea value={zone.content || ''} onChange={e => updateZone(idx, 'content', e.target.value)}
                            rows={3} placeholder="הדבק/כתוב כאן את המידע שנאסף..."
                            className="w-full px-3 py-2.5 text-sm outline-none resize-none"
                            style={{ ...inputStyle, borderRadius: '10px' }} onFocus={inputFocus} onBlur={inputBlur} />
                          <div className="grid grid-cols-3 gap-3">
                            <select value={zone.source_type || 'טקסט חופשי'} onChange={e => updateZone(idx, 'source_type', e.target.value)}
                              className="px-3 py-2 text-xs outline-none" style={{ ...inputStyle, borderRadius: '10px' }}>
                              {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input value={zone.source_label || ''} onChange={e => updateZone(idx, 'source_label', e.target.value)}
                              placeholder="תיאור המקור"
                              className="px-3 py-2 text-xs outline-none" style={{ ...inputStyle, borderRadius: '10px' }}
                              onFocus={inputFocus} onBlur={inputBlur} />
                            <input type="date" value={zone.source_date || ''} onChange={e => updateZone(idx, 'source_date', e.target.value)}
                              className="px-3 py-2 text-xs outline-none" style={{ ...inputStyle, borderRadius: '10px' }}
                              onFocus={inputFocus} onBlur={inputBlur} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Danger zone — delete zimmer */}
              {zimmer.id && onDelete && (
               <section className="rounded-2xl p-6" style={{ background: '#FFF5F5', border: '1px solid #FFD6D6' }}>
                 <div className="flex items-start gap-3">
                   <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FFE5E5' }}>
                     <Trash2 size={18} style={{ color: '#FF5E5E' }} />
                   </div>
                   <div className="flex-1">
                     <p className="text-sm font-bold" style={{ color: '#FF5E5E' }}>מחיקת צימר</p>
                     <p className="text-xs mt-1 leading-relaxed" style={{ color: '#D9534F' }}>
                       זהירות: מחיקת הצימר תמחק לצמיתות את כל המידע שלו — תמונות, הגדרות, אזורי מידע וביקורות. פעולה זו בלתי הפיכה.
                     </p>
                     <label className="flex items-center gap-2 mt-3 cursor-pointer">
                       <input type="checkbox" checked={confirmDelete}
                         onChange={e => setConfirmDelete(e.target.checked)}
                         className="w-4 h-4" style={{ accentColor: '#FF5E5E' }} />
                       <span className="text-xs font-semibold" style={{ color: '#D9534F' }}>מאשר/ת למחוק</span>
                     </label>
                     <button type="button" disabled={!confirmDelete}
                       onClick={() => { if (confirm('למחוק את הצימר לצמיתות? כל המידע יימחק.')) onDelete(zimmer.id); }}
                       className="mt-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                       style={{ background: '#FF5E5E', color: '#fff' }}>
                       מחק צימר לצמיתות
                     </button>
                   </div>
                 </div>
               </section>
              )}
            </>
          )}

          {/* ===== TAB 5: מיקום וכתובת ===== */}
          {tab === 'location' && (
            <ZimmerLocationTab
              location={form.location || ''}
              staySettings={form.stay_settings || {}}
              onUpdate={({ location: loc, staySettings }) => { update('location', loc); update('stay_settings', staySettings); }}
            />
          )}

          {/* Actions */}
          <div className="flex gap-3 pb-8 pt-2">
            <button type="button" onClick={onCancel}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all hover:bg-white"
              style={{ border: '1.5px solid #E8E5E0', color: '#6B7280', background: 'transparent' }}>
              ביטול
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 text-white py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: '#F97316' }}>
              {saving ? 'שומר...' : zimmer.id ? 'שמור שינויים' : 'צור צימר'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}