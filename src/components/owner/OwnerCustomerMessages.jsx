import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Key, MapPin, Clock, DoorOpen, MessageSquareText, Star, Plus, X, Save, Pencil, CalendarClock } from 'lucide-react';

const TRIGGER_OPTIONS = [
  { key: 'pre_checkin', label: 'יום לפני ההגעה', desc: 'פרטי הגעה + ניווט', placeholder: 'שלום! החופשה מתקרבת. פרטי ההגעה יצורפו אוטומטית...' },
  { key: 'checkin_day', label: "בוקר הצ'ק-אין", desc: 'המלצות AI לאזור', placeholder: 'בוקר טוב! ברוכים הבאים. מצורפות המלצות AI...' },
  { key: 'checkin', label: "בשעת הצ'ק-אין", desc: 'אישור הגעה תקינה', placeholder: "ברוכים הבאים! נא לאשר שהכול תקין..." },
  { key: 'post_checkin', label: "שעה לאחר הצ'ק-אין", desc: 'חופשה נעימה, זמינים לכל שאלה', placeholder: 'חופשה נעימה! אנחנו כאן לכל שאלה...' },
  { key: 'morning_checkout', label: "בוקר הצ'ק-אאוט", desc: 'הוראות יציאה', placeholder: "בוקר טוב! היום יום העזיבה. הוראות יציאה יצורפו..." },
  { key: 'pre_checkout', label: "לפני הצ'ק-אאוט (~2 שעות)", desc: 'תזכורת יציאה', placeholder: 'תזכורת: שעת העזיבה מתקרבת...' },
];

// Customer automatic messages — per-zimmer stay_settings (check-in details,
// welcome message, review request). Same pattern as the supplier panel: nothing
// shown upfront but a summary + a "הגדר הודעה" button that opens a modal with
// zimmer selection and all the details inside.
export default function OwnerCustomerMessages({ ownerId }) {
  const [zimmers, setZimmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editZimmer, setEditZimmer] = useState(null);

  useEffect(() => { load(); }, [ownerId]);

  const load = async () => {
    if (!ownerId) return;
    setLoading(true);
    const data = await api.entities.Zimmer.filter({ owner_id: ownerId }, 'name');
    setZimmers(data || []);
    setLoading(false);
  };

  const hasField = (z, k) => !!(z.stay_settings && z.stay_settings[k]);
  const hasConfig = (z) => {
    const s = z.stay_settings || {};
    if (!!(s.address || s.nav_link || s.entry_code || s.key_location || s.welcome_message || s.review_request_message)) return true;
    return Array.isArray(s.customer_triggers) && s.customer_triggers.some(t => t && t.enabled !== false);
  };
  const activeTriggers = (z) => {
    const s = z.stay_settings || {};
    return (Array.isArray(s.customer_triggers) ? s.customer_triggers : []).filter(t => t && t.enabled !== false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const configured = zimmers.filter(hasConfig);

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black" style={{ color: '#1A1A1A' }}>הודעות אוטומטיות ללקוחות</h2>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>פרטי צ'ק-אין, ברוכים הבאים ובקשת ביקורת — מוזנים אוטומטית להודעות ללקוח.</p>
        </div>
        <button onClick={() => { setEditZimmer(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
          style={{ background: '#F97316' }}>
          <Plus size={16} /> הגדר הודעה
        </button>
      </div>

      {configured.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <MessageSquareText size={28} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p className="text-sm" style={{ color: '#9CA3AF' }}>אין הודעות מוגדרות. לחצו על "הגדר הודעה" כדי להתחיל.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {configured.map(z => {
            const s = z.stay_settings || {};
            return (
              <div key={z.id} className="rounded-2xl p-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: '#1A1A1A' }}>{z.name}</div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {hasField(z, 'welcome_message') && <Badge icon={MessageSquareText} label="ברוכים הבאים" />}
                      {hasField(z, 'review_request_message') && <Badge icon={Star} label="בקשת ביקורת" />}
                      {hasField(z, 'address') && <Badge icon={MapPin} label="כתובת" />}
                      {hasField(z, 'entry_code') && <Badge icon={DoorOpen} label="קוד כניסה" />}
                      {hasField(z, 'key_location') && <Badge icon={Key} label="מפתח" />}
                      {activeTriggers(z).length > 0 && <Badge icon={CalendarClock} label={`תזמון · ${activeTriggers(z).length}`} />}
                    </div>
                  </div>
                  <button onClick={() => { setEditZimmer(z); setShowForm(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 transition-all"
                    style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.16)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.08)'}>
                    <Pencil size={13} /> עריכה
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px]" style={{ color: '#9CA3AF' }}>
                  <span className="flex items-center gap-1"><Clock size={11} /> צ'ק-אין {s.checkin_time || '15:00'}</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> צ'ק-אאוט {s.checkout_time || '11:00'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <CustomerMessageForm zimmers={zimmers} editing={editZimmer}
          onCancel={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function Badge({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#F8F7F4', color: '#6B7280' }}>
      <Icon size={10} /> {label}
    </span>
  );
}

function CustomerMessageForm({ zimmers, editing, onCancel, onSaved }) {
  const [zimmerId, setZimmerId] = useState(editing?.id || '');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const z = editing || zimmers.find(z => z.id === zimmerId);
    const s = z?.stay_settings || {};
    setForm({
      address: s.address || '', nav_link: s.nav_link || '', entry_code: s.entry_code || '',
      key_location: s.key_location || '', checkin_time: s.checkin_time || '15:00', checkout_time: s.checkout_time || '11:00',
      welcome_message: s.welcome_message || '', review_request_message: s.review_request_message || '',
      customer_triggers: Array.isArray(s.customer_triggers) ? s.customer_triggers : [],
    });
  }, [zimmerId, editing]);

  const set = (k, v) => setForm(prev => prev ? { ...prev, [k]: v } : prev);

  const getTrigger = (key) => {
    const t = (form?.customer_triggers || []).find(t => t.trigger === key);
    return { enabled: t ? t.enabled !== false : true, text: t?.text || '' };
  };
  const setTrigger = (key, patch) => setForm(prev => {
    if (!prev) return prev;
    const cur = Array.isArray(prev.customer_triggers) ? [...prev.customer_triggers] : [];
    const idx = cur.findIndex(t => t.trigger === key);
    if (idx >= 0) cur[idx] = { ...cur[idx], ...patch };
    else cur.push({ trigger: key, enabled: true, text: '', ...patch });
    return { ...prev, customer_triggers: cur };
  });

  const save = async () => {
    setErr('');
    if (!zimmerId) { setErr('בחר צימר'); return; }
    setSaving(true);
    try {
      await api.entities.Zimmer.update(zimmerId, { stay_settings: form });
      onSaved();
    } catch (e) { setErr('שמירה נכשלה: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  if (!form) return null;
  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #E8E5E0', background: '#fff', fontSize: '14px', color: '#1A1A1A', fontFamily: 'Heebo, sans-serif', outline: 'none' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onCancel}>
      <div className="w-full max-w-lg rounded-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-auto" style={{ background: '#fff' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black" style={{ color: '#1A1A1A' }}>{editing ? 'עריכת הודעה' : 'הגדר הודעה'}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>צימר</label>
          <select style={inputStyle} value={zimmerId} onChange={e => setZimmerId(e.target.value)} disabled={!!editing}>
            <option value="">בחר צימר...</option>
            {zimmers.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>

        <Field icon={MapPin} label="כתובת מדויקת לניווט">
          <input style={inputStyle} value={form.address} onChange={e => set('address', e.target.value)} placeholder="רחוב, מספר, יישוב" />
        </Field>
        <Field icon={MapPin} label="קישור לניווט (Waze / Google Maps)">
          <input style={inputStyle} value={form.nav_link} onChange={e => set('nav_link', e.target.value)} placeholder="https://waze.com/..." dir="ltr" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field icon={Clock} label="שעת צ'ק-אין">
            <input style={inputStyle} type="time" value={form.checkin_time} onChange={e => set('checkin_time', e.target.value)} />
          </Field>
          <Field icon={Clock} label="שעת צ'ק-אאוט">
            <input style={inputStyle} type="time" value={form.checkout_time} onChange={e => set('checkout_time', e.target.value)} />
          </Field>
        </div>
        <Field icon={DoorOpen} label="קוד כניסה / תיבת מפתח">
          <input style={inputStyle} value={form.entry_code} onChange={e => set('entry_code', e.target.value)} placeholder="קוד דלת / מספר תיבה" />
        </Field>
        <Field icon={Key} label="מיקום המפתח / הוראות כניסה">
          <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={form.key_location} onChange={e => set('key_location', e.target.value)} placeholder="המפתח נמצא מתחת לעציץ..." />
        </Field>
        <Field icon={MessageSquareText} label="הודעת ברוכים הבאים מותאמת אישית">
          <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} value={form.welcome_message} onChange={e => set('welcome_message', e.target.value)} placeholder="ברוכים הבאים! מקווים שתהנו..." />
        </Field>
        <Field icon={Star} label="טקסט בקשת ביקורת לאחר החופשה">
          <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.review_request_message} onChange={e => set('review_request_message', e.target.value)} placeholder="מקווים שנהניתם! נשמח לביקורת..." />
          <p className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>ריק = טקסט ברירת מחדל של המערכת.</p>
        </Field>

        {/* תזמון שליחה */}
        <div className="p-4 rounded-xl" style={{ background: '#F8F7F4' }}>
          <div className="flex items-center gap-1.5 text-xs font-bold mb-1" style={{ color: '#1A1A1A' }}>
            <CalendarClock size={14} style={{ color: '#EA580C' }} /> תזמון שליחה
          </div>
          <p className="text-[11px] mb-3" style={{ color: '#9CA3AF' }}>בחרו אילו הודעות אוטומטיות להפעיל וטקסט מותאם (ריק = טקסט ברירת המחדל). ההודעה תישלח במועד שנבחר.</p>
          <div className="space-y-2">
            {TRIGGER_OPTIONS.map(opt => {
              const cfg = getTrigger(opt.key);
              return (
                <div key={opt.key} className="rounded-xl p-3" style={{ background: '#fff', border: `1.5px solid ${cfg.enabled ? '#F97316' : '#E8E5E0'}`, opacity: cfg.enabled ? 1 : 0.65 }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold" style={{ color: '#1A1A1A' }}>{opt.label}</div>
                      <div className="text-[11px]" style={{ color: '#9CA3AF' }}>{opt.desc}</div>
                    </div>
                    <button type="button" onClick={() => setTrigger(opt.key, { enabled: !cfg.enabled })}
                      className="flex items-center gap-1.5 text-xs font-semibold flex-shrink-0" style={{ color: cfg.enabled ? '#EA580C' : '#6B7280' }}>
                      <div className="rounded-full flex items-center px-0.5" style={{ width: '32px', height: '18px', background: cfg.enabled ? '#F97316' : '#E8E5E0' }}>
                        <div className="rounded-full bg-white transition-transform" style={{ width: '14px', height: '14px', transform: cfg.enabled ? 'translateX(-14px)' : 'translateX(0)' }} />
                      </div>
                      {cfg.enabled ? 'פעיל' : 'מושבת'}
                    </button>
                  </div>
                  {cfg.enabled && (
                    <textarea
                      value={cfg.text}
                      onChange={e => setTrigger(opt.key, { text: e.target.value })}
                      placeholder={opt.placeholder}
                      className="mt-2 w-full px-3 py-2 rounded-xl text-xs outline-none resize-none"
                      style={{ background: '#F8F7F4', border: '1px solid #E8E5E0', color: '#1A1A1A', fontFamily: 'Heebo, sans-serif', minHeight: '56px' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {err && <div className="text-sm font-semibold" style={{ color: '#EF4444' }}>{err}</div>}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: '#F97316' }}>
            <Save size={16} /> {saving ? 'שומר...' : 'שמור'}
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#F8F7F4', color: '#6B7280' }}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
        <Icon size={13} /> {label}
      </label>
      {children}
    </div>
  );
}