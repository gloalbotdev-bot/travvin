import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowRight, Plus, Trash2, Upload, X } from 'lucide-react';

const SOURCE_TYPES = ['שיחת טלפון', 'שיחת וואטסאפ', 'טקסט חופשי', 'שאלות ותשובות'];

const inputStyle = {
  background: '#F8F7F4',
  border: '1.5px solid #E8E5E0',
  color: '#1A1A1A',
  borderRadius: '12px',
};

const inputFocus = (e) => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; };
const inputBlur = (e) => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#F8F7F4'; };

export default function ZimmerEditor({ zimmer, onSave, onCancel }) {
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
    seasonal_pricing: zimmer.seasonal_pricing || []
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const addSeasonal = () => setForm(f => ({
    ...f,
    seasonal_pricing: [...(f.seasonal_pricing || []), { start_date: '', end_date: '', adjustment: 'increase', percentage: '' }]
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
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, images: [...f.images, file_url] }));
    }
    setUploadingImg(false);
  };

  const removeImage = (idx) => setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

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
      min_guests: form.partial_pricing_enabled ? num(form.min_guests) : null,
      price_per_adult: form.partial_pricing_enabled ? num(form.price_per_adult) : null,
      price_per_child: form.partial_pricing_enabled ? num(form.price_per_child) : null,
      seasonal_pricing: (form.seasonal_pricing || []).map(r => ({ ...r, percentage: r.percentage === '' ? null : Number(r.percentage) })),
    };
    setSaving(true);
    await onSave(cleaned);
    setSaving(false);
  };

  return (
    <div className="min-h-screen" dir="rtl" style={{ background: '#F8F7F4', fontFamily: 'Heebo, sans-serif' }}>
      <div className="max-w-3xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic Info */}
          <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <h2 className="font-bold text-xs uppercase tracking-widest mb-5" style={{ color: '#F97316' }}>פרטי בסיס</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
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
              <div className="md:col-span-2">
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
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מספר חדרים</label>
                <input type="number" value={form.num_rooms || ''} onChange={e => update('num_rooms', e.target.value)}
                  className="w-full px-4 py-3 text-sm outline-none transition-all"
                  style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                  placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>אורחים מקסימלי</label>
                <input type="number" value={form.max_guests || ''} onChange={e => update('max_guests', e.target.value)}
                  className="w-full px-4 py-3 text-sm outline-none transition-all"
                  style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                  placeholder="0" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>תיאור חופשי</label>
                <textarea value={form.description || ''} onChange={e => update('description', e.target.value)}
                  rows={4} placeholder="תאר את הצימר בחופשיות..."
                  className="w-full px-4 py-3 text-sm outline-none transition-all resize-none"
                  style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
              </div>
            </div>
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
                  כשהתמחור החלקי מופעל, ניתן להשכיר את הצימר לקבוצה קטנה מהתפוסה המלאה (ולפחות ממספר האורחים המינימלי) לפי מחיר למבוגר ולילד. מתאים להשכרת צימר גדול לזוג במחיר נמוך יותר.
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
              העלאה עד 100% בתקופות שיא, הורדה עד 75% בעונות מנה. האחוז חל על כל לילה שנופל בתוך התקופה שנבחרה.
            </p>
            {(form.seasonal_pricing || []).length === 0 ? (
              <div className="text-center py-6" style={{ color: '#9CA3AF' }}>
                <p className="text-sm">אין תקופות עונתיות</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(form.seasonal_pricing || []).map((rule, idx) => {
                  const maxPct = rule.adjustment === 'decrease' ? 75 : 100;
                  return (
                    <div key={idx} className="rounded-xl p-4" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>תקופה {idx + 1}</span>
                        <button type="button" onClick={() => removeSeasonal(idx)} className="transition-colors" style={{ color: '#EF4444' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>התחלה</label>
                          <input type="date" value={rule.start_date || ''} onChange={e => updateSeasonal(idx, 'start_date', e.target.value)}
                            className="w-full px-3 py-2 text-xs outline-none" style={{ ...inputStyle, borderRadius: '10px' }} onFocus={inputFocus} onBlur={inputBlur} />
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>סיום</label>
                          <input type="date" value={rule.end_date || ''} onChange={e => updateSeasonal(idx, 'end_date', e.target.value)}
                            className="w-full px-3 py-2 text-xs outline-none" style={{ ...inputStyle, borderRadius: '10px' }} onFocus={inputFocus} onBlur={inputBlur} />
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>סוג</label>
                          <select value={rule.adjustment || 'increase'} onChange={e => updateSeasonal(idx, 'adjustment', e.target.value)}
                            className="w-full px-3 py-2 text-xs outline-none" style={{ ...inputStyle, borderRadius: '10px' }}>
                            <option value="increase">עלייה (שיא)</option>
                            <option value="decrease">ירידה (מנה)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>אחוז (עד {maxPct}%)</label>
                          <input type="number" min={0} max={maxPct} value={rule.percentage}
                            onChange={e => updateSeasonal(idx, 'percentage', Math.min(maxPct, Math.max(0, Number(e.target.value) || 0)))}
                            className="w-full px-3 py-2 text-xs outline-none" style={{ ...inputStyle, borderRadius: '10px' }} onFocus={inputFocus} onBlur={inputBlur} placeholder="0" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Images */}
          <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <h2 className="font-bold text-xs uppercase tracking-widest mb-5" style={{ color: '#F97316' }}>תמונות ({form.images.length}/20)</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
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

          {/* Actions */}
          <div className="flex gap-3 pb-8">
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