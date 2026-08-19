import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Truck, Bell, CalendarClock, Droplets, Plus, Trash2, X, Check, MapPin, Sparkles, Clock, CalendarDays } from 'lucide-react';

// Supplier automations as first-class records (SupplierAutomation entity).
// Top: summary of active automations with on/off toggle + delete + schedule label.
// "הפעלת הודעה אוטומטית" opens a config modal (supplier, message type, schedule,
// zimmer assignment). Zimmers are NOT shown at the top, only inside the form.
const MESSAGE_TYPES = {
  checkout_notify: { label: 'הודעה בצ\'ק-אאוט', icon: Bell, desc: 'נשלחת מיד כשאורח מבצע צ\'ק-אאוט (ללא תזמון)', scheduled: false },
  weekly_cleaning: { label: 'לו"ז ניקיון', icon: CalendarClock, desc: 'סיכום כניסות/יציאות — מתוזמן', scheduled: true },
  daily_laundry: { label: 'הזמנת מכבסה', icon: Droplets, desc: 'כמויות מגבות/מצעים — מתוזמן', scheduled: true },
};
const TYPES_FOR_CATEGORY = {
  'מנקה': ['checkout_notify', 'weekly_cleaning'],
  'מכבסה': ['daily_laundry'],
  'מפעיל צימר': ['checkout_notify'],
  'גנן': [],
  'טכנאי': [],
};
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const FREQ_LABELS = { weekly: 'שבועי', biweekly: 'דו-שבועי', monthly: 'חודשי' };

function scheduleLabel(a) {
  if (a.message_type === 'checkout_notify') return 'בעת צ\'ק-אאוט';
  const freq = a.frequency || 'weekly';
  const time = a.time || '09:00';
  if (freq === 'monthly') return `${FREQ_LABELS.monthly} · יום ${a.month_day || 1} בחודש · ${time}`;
  const day = DAYS[a.day_of_week] || DAYS[0];
  return `${FREQ_LABELS[freq]} · ${day} · ${time}`;
}

export default function SupplierAutomationPanel({ ownerId }) {
  const [automations, setAutomations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [zimmers, setZimmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [toggling, setToggling] = useState(null);

  useEffect(() => { load(); }, [ownerId]);

  const load = async () => {
    if (!ownerId) return;
    setLoading(true);
    const [autos, sup, zims] = await Promise.all([
      api.entities.SupplierAutomation.filter({ owner_id: ownerId }, '-created_date'),
      api.entities.Contact.filter({ owner_id: ownerId, type: 'ספק' }, 'name'),
      api.entities.Zimmer.filter({ owner_id: ownerId }, 'name'),
    ]);
    setAutomations(autos || []);
    setContacts(sup || []);
    setZimmers(zims || []);
    setLoading(false);
  };

  const zimmerName = (id) => zimmers.find(z => z.id === id)?.name || 'צימר';

  const toggleEnabled = async (a) => {
    setToggling(a.id);
    try {
      await api.entities.SupplierAutomation.update(a.id, { enabled: !a.enabled });
      setAutomations(prev => prev.map(x => x.id === a.id ? { ...x, enabled: !x.enabled } : x));
    } catch (e) { alert('עדכון נכשל: ' + (e?.message || String(e))); }
    setToggling(null);
  };

  const remove = async (a) => {
    if (!confirm('למחוק את ההודעה האוטומטית?')) return;
    try {
      await api.entities.SupplierAutomation.delete(a.id);
      setAutomations(prev => prev.filter(x => x.id !== a.id));
    } catch (e) { alert('מחיקה נכשלה: ' + (e?.message || String(e))); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!contacts.length) {
    return (
      <div className="rounded-2xl p-10 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <Truck size={32} className="mx-auto mb-3" style={{ color: '#9CA3AF' }} />
        <p className="text-sm" style={{ color: '#9CA3AF' }}>אין ספקים. הוסף אנשי קשר מסוג "ספק" בכרטיסיית אנשי קשר כדי להגדיר הודעות אוטומטיות.</p>
      </div>
    );
  }

  const activeCount = automations.filter(a => a.enabled).length;

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black" style={{ color: '#1A1A1A' }}>הודעות אוטומטיות לספקים</h2>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{activeCount} פעילות · {automations.length} סה"כ</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
          style={{ background: '#F97316' }}>
          <Plus size={16} /> הפעלת הודעה אוטומטית
        </button>
      </div>

      {automations.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <Sparkles size={28} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p className="text-sm" style={{ color: '#9CA3AF' }}>אין הודעות אוטומטיות פעילות. לחצו על "הפעלת הודעה אוטומטית" כדי להתחיל.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {automations.map(a => {
            const mt = MESSAGE_TYPES[a.message_type] || { label: a.message_type, icon: Bell };
            const Icon = mt.icon;
            const zids = Array.isArray(a.zimmer_ids) ? a.zimmer_ids : [];
            return (
              <div key={a.id} className="rounded-2xl p-4 transition-all"
                style={{ background: '#fff', border: `1.5px solid ${a.enabled ? '#F97316' : '#F0EEE8'}`, opacity: a.enabled ? 1 : 0.6 }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: a.enabled ? 'rgba(249,115,22,0.1)' : '#F8F7F4' }}>
                    <Icon size={16} style={{ color: a.enabled ? '#EA580C' : '#9CA3AF' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{a.contact_name || 'ספק'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#F8F7F4', color: '#6B7280' }}>{a.supplier_category || '—'}</span>
                    </div>
                    <div className="text-xs font-semibold mt-0.5" style={{ color: '#EA580C' }}>{mt.label}</div>
                    <div className="flex items-center gap-1 mt-1 text-[11px]" style={{ color: '#9CA3AF' }}>
                      <Clock size={11} /> {scheduleLabel(a)}
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <MapPin size={11} style={{ color: '#9CA3AF' }} />
                      {zids.length === 0
                        ? <span className="text-[11px]" style={{ color: '#9CA3AF' }}>כל הצימרים</span>
                        : zids.slice(0, 3).map(z => (
                          <span key={z} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#F8F7F4', color: '#6B7280' }}>{zimmerName(z)}</span>
                        ))}
                      {zids.length > 3 && <span className="text-[10px]" style={{ color: '#9CA3AF' }}>+{zids.length - 3}</span>}
                    </div>
                    {a.last_sent_at && <div className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>שליחה אחרונה: {new Date(a.last_sent_at).toLocaleString('he-IL')}</div>}
                  </div>
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleEnabled(a)} disabled={toggling === a.id} title={a.enabled ? 'כבה' : 'הפעל'}
                      className="rounded-full flex items-center px-0.5 transition-all disabled:opacity-50"
                      style={{ width: '36px', height: '20px', background: a.enabled ? '#F97316' : '#E8E5E0' }}>
                      <div className="rounded-full bg-white transition-transform" style={{ width: '16px', height: '16px', transform: a.enabled ? 'translateX(-16px)' : 'translateX(0)' }} />
                    </button>
                    <button onClick={() => remove(a)} title="מחק" className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <AutomationForm ownerId={ownerId} contacts={contacts} zimmers={zimmers}
          onCancel={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function AutomationForm({ ownerId, contacts, zimmers, onCancel, onSaved }) {
  const [contactId, setContactId] = useState('');
  const [messageType, setMessageType] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [dayOfWeek, setDayOfWeek] = useState(6);
  const [time, setTime] = useState('20:00');
  const [monthDay, setMonthDay] = useState(1);
  const [zids, setZids] = useState([]);
  const [allZimmers, setAllZimmers] = useState(false);
  const [towels, setTowels] = useState(2);
  const [linens, setLinens] = useState(1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const contact = contacts.find(c => c.id === contactId);
  const category = contact?.category || '';
  const availableTypes = TYPES_FOR_CATEGORY[category] || [];
  const isScheduled = !!messageType && MESSAGE_TYPES[messageType]?.scheduled;

  // when supplier changes, reset message type to first available
  useEffect(() => {
    if (availableTypes.length && !availableTypes.includes(messageType)) setMessageType(availableTypes[0]);
    if (!availableTypes.length) setMessageType('');
  }, [category]);

  // sensible defaults when message type changes
  useEffect(() => {
    if (messageType === 'weekly_cleaning') { setFrequency('weekly'); setDayOfWeek(6); setTime('20:00'); }
    else if (messageType === 'daily_laundry') { setFrequency('weekly'); setDayOfWeek(0); setTime('07:00'); }
  }, [messageType]);

  const toggleZimmer = (id) => setZids(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const save = async () => {
    setErr('');
    if (!contactId) { setErr('בחר ספק'); return; }
    if (!messageType) { setErr('בחר סוג הודעה'); return; }
    if (isScheduled) {
      if (!time) { setErr('בחר שעה'); return; }
      if ((frequency === 'weekly' || frequency === 'biweekly') && (dayOfWeek === null || dayOfWeek === undefined || Number.isNaN(dayOfWeek))) { setErr('בחר יום בשבוע'); return; }
      if (frequency === 'monthly' && (!monthDay || monthDay < 1 || monthDay > 31)) { setErr('בחר יום חוקי בחודש (1-31)'); return; }
    }
    if (!allZimmers && zids.length === 0) { setErr('בחר לפחות צימר אחד או סמן "כל הצימרים"'); return; }
    setSaving(true);
    try {
      await api.entities.SupplierAutomation.create({
        owner_id: ownerId,
        contact_id: contactId,
        contact_name: contact.name,
        supplier_category: category,
        message_type: messageType,
        frequency: isScheduled ? frequency : null,
        day_of_week: isScheduled && (frequency === 'weekly' || frequency === 'biweekly') ? Number(dayOfWeek) : null,
        time: isScheduled ? time : null,
        month_day: isScheduled && frequency === 'monthly' ? Number(monthDay) : null,
        zimmer_ids: allZimmers ? [] : zids,
        enabled: true,
        towels_per_guest: messageType === 'daily_laundry' ? Number(towels) : 2,
        linens_per_guest: messageType === 'daily_laundry' ? Number(linens) : 1,
      });
      onSaved();
    } catch (e) { setErr('שמירה נכשלה: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #E8E5E0', background: '#fff', fontSize: '14px', color: '#1A1A1A', fontFamily: 'Heebo, sans-serif', outline: 'none' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onCancel}>
      <div className="w-full max-w-lg rounded-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-auto" style={{ background: '#fff' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black" style={{ color: '#1A1A1A' }}>הפעלת הודעה אוטומטית</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>ספק</label>
          <select style={inputStyle} value={contactId} onChange={e => setContactId(e.target.value)}>
            <option value="">בחר ספק...</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.category ? ` · ${c.category}` : ''}{c.phone ? ` · ${c.phone}` : ''}</option>
            ))}
          </select>
        </div>

        {contactId && (
          <>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>סוג הודעה אוטומטית</label>
              {availableTypes.length === 0 ? (
                <p className="text-xs p-3 rounded-xl" style={{ background: '#FEF3C7', color: '#92400E' }}>
                  אין הודעות אוטומטיות זמינות לקטגוריית "{category}" כרגע.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {availableTypes.map(t => {
                    const mt = MESSAGE_TYPES[t];
                    const Icon = mt.icon;
                    const on = messageType === t;
                    return (
                      <button key={t} onClick={() => setMessageType(t)} type="button"
                        className="flex items-start gap-2 p-3 rounded-xl text-right transition-all"
                        style={on ? { background: 'rgba(249,115,22,0.1)', border: '1.5px solid #F97316' } : { background: '#F8F7F4', border: '1.5px solid transparent' }}>
                        <Icon size={15} style={{ color: on ? '#EA580C' : '#9CA3AF' }} className="mt-0.5" />
                        <div>
                          <div className="text-sm font-bold" style={{ color: '#1A1A1A' }}>{mt.label}</div>
                          <div className="text-[11px]" style={{ color: '#9CA3AF' }}>{mt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isScheduled && (
              <div className="p-4 rounded-xl" style={{ background: '#F8F7F4' }}>
                <div className="flex items-center gap-1.5 text-xs font-bold mb-3" style={{ color: '#1A1A1A' }}>
                  <CalendarDays size={14} style={{ color: '#EA580C' }} /> תזמון שליחה
                </div>
                <div className="mb-3">
                  <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>תדירות</label>
                  <div className="flex gap-2">
                    {[{ v: 'weekly', l: 'שבועי' }, { v: 'biweekly', l: 'דו-שבועי' }, { v: 'monthly', l: 'חודשי' }].map(f => (
                      <button key={f.v} onClick={() => setFrequency(f.v)} type="button"
                        className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={frequency === f.v ? { background: '#F97316', color: '#fff' } : { background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
                        {f.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(frequency === 'weekly' || frequency === 'biweekly') && (
                    <div className="col-span-1">
                      <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>יום בשבוע</label>
                      <select style={inputStyle} value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}>
                        {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>
                  )}
                  {frequency === 'monthly' && (
                    <div className="col-span-1">
                      <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>יום בחודש</label>
                      <input style={inputStyle} type="number" min={1} max={31} value={monthDay} onChange={e => setMonthDay(Number(e.target.value))} />
                      <p className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>1–31</p>
                    </div>
                  )}
                  <div className="col-span-1">
                    <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>שעה</label>
                    <input style={inputStyle} type="time" value={time} onChange={e => setTime(e.target.value)} />
                  </div>
                </div>
                <p className="text-[10px] mt-2" style={{ color: '#9CA3AF' }}>ההודעה תישלח בשעה שנבחרה. חלון הנתונים מתרחב לפי התדירות (7/14/30 ימים).</p>
              </div>
            )}

            {messageType && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold flex items-center gap-1" style={{ color: '#6B7280' }}>
                      <MapPin size={12} /> שיוך לצימרים
                    </label>
                    <button onClick={() => setAllZimmers(!allZimmers)} type="button"
                      className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: allZimmers ? '#EA580C' : '#6B7280' }}>
                      <div className="rounded-full flex items-center px-0.5" style={{ width: '32px', height: '18px', background: allZimmers ? '#F97316' : '#E8E5E0' }}>
                        <div className="rounded-full bg-white transition-transform" style={{ width: '14px', height: '14px', transform: allZimmers ? 'translateX(-14px)' : 'translateX(0)' }} />
                      </div>
                      כל הצימרים
                    </button>
                  </div>
                  {allZimmers ? (
                    <p className="text-xs p-3 rounded-xl" style={{ background: '#F8F7F4', color: '#6B7280' }}>ההודעה תחול על כל הצימרים של העסק.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {zimmers.map(z => {
                        const on = zids.includes(z.id);
                        return (
                          <button key={z.id} onClick={() => toggleZimmer(z.id)} type="button"
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                            style={on ? { background: '#F97316', color: '#fff' } : { background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
                            {z.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {messageType === 'daily_laundry' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>מגבות לאורח (ליום)</label>
                      <input style={inputStyle} type="number" min={0} value={towels} onChange={e => setTowels(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>מצעים לאורח (ליום)</label>
                      <input style={inputStyle} type="number" min={0} value={linens} onChange={e => setLinens(e.target.value)} />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {err && <div className="text-sm font-semibold" style={{ color: '#EF4444' }}>{err}</div>}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: '#F97316' }}>
            <Check size={16} /> {saving ? 'שומר...' : 'הפעל הודעה אוטומטית'}
          </button>
          <button onClick={onCancel} type="button" className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#F8F7F4', color: '#6B7280' }}>ביטול</button>
        </div>
      </div>
    </div>
  );
}