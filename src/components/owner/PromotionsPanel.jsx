import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Tag, X, Trash2, Sparkles } from 'lucide-react';
import { calcBookingTotalForZimmer, calcNights, formatILS, clampDiscount } from '@/lib/bookingPrice';
import DateRangeField from '@/components/common/DateRangeField';

const todayStr = () => new Date().toISOString().split('T')[0];
const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000).toISOString().split('T')[0];

function overlap(aIn, aOut, bIn, bOut) {
  return new Date(aIn) < new Date(bOut) && new Date(aOut) > new Date(bIn);
}

export default function PromotionsPanel({ ownerId }) {
  const [zimmers, setZimmers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null); // zimmer being promoted
  const [form, setForm] = useState({ check_in: '', check_out: '', discount: 40 });
  const [saving, setSaving] = useState(false);

  const weekStart = todayStr();
  const weekEnd = addDays(weekStart, 7);

  const load = async () => {
    if (!ownerId) return;
    setLoading(true);
    const [zs, bks, prs] = await Promise.all([
      api.entities.Zimmer.filter({ owner_id: ownerId }),
      api.entities.BookingRequest.filter({ status: 'אושרה' }),
      api.entities.Promotion.filter({ owner_id: ownerId }),
    ]);
    setZimmers(zs);
    setBookings(bks);
    // auto-expire
    const today = weekStart;
    for (const p of prs) {
      if (p.status === 'פעיל' && p.check_out && p.check_out < today) {
        try { await api.entities.Promotion.update(p.id, { status: 'פג תוקף' }); p.status = 'פג תוקף'; } catch (e) {}
      }
    }
    setPromos(prs);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ownerId]);

  // zimmers free for the whole upcoming week (no approved booking overlapping the week window)
  const bookedZimmerIds = new Set(
    bookings.filter(b => overlap(weekStart, weekEnd, b.check_in, b.check_out)).map(b => b.zimmer_id)
  );
  const freeZimmers = zimmers.filter(z => z.approval_status === 'אושר' && !bookedZimmerIds.has(z.id));
  const promoZimmerIds = new Set(promos.filter(p => p.status === 'פעיל').map(p => p.zimmer_id));
  const availableZimmers = freeZimmers.filter(z => !promoZimmerIds.has(z.id));

  const activePromos = promos.filter(p => p.status === 'פעיל');
  const pastPromos = promos.filter(p => p.status !== 'פעיל');

  const openCreate = (zimmer) => {
    setCreating(zimmer);
    setForm({ check_in: weekStart, check_out: addDays(weekStart, 1), discount: 40 });
  };

  const minCheckOut = form.check_in ? addDays(form.check_in, 1) : weekStart;

  const previewTotal = (zimmer) => {
    if (!form.check_in || !form.check_out) return 0;
    const base = calcBookingTotalForZimmer(zimmer, form.check_in, form.check_out, 2, 0);
    return Math.round(base * (1 - clampDiscount(form.discount) / 100));
  };
  const previewBase = (zimmer) => {
    if (!form.check_in || !form.check_out) return 0;
    return calcBookingTotalForZimmer(zimmer, form.check_in, form.check_out, 2, 0);
  };

  const save = async () => {
    if (!creating || !form.check_in || !form.check_out) return;
    setSaving(true);
    await api.entities.Promotion.create({
      zimmer_id: creating.id,
      zimmer_name: creating.name,
      owner_id: ownerId,
      check_in: form.check_in,
      check_out: form.check_out,
      discount_percent: clampDiscount(form.discount),
      status: 'פעיל',
    });
    setSaving(false);
    setCreating(null);
    load();
  };

  const removePromo = async (id) => {
    if (!confirm('למחוק את המבצע?')) return;
    await api.entities.Promotion.delete(id);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <div className="mb-7">
        <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: '#1A1A1A' }}>
          <Tag size={22} style={{ color: '#F97316' }} /> מבצעים וקידומים
        </h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
          בחר צימר פנוי לשבוע הקרוב, קבע לאיזה לילות הנחה ובכמה אחוז (30%–80%). המבצע יקפוץ לכל הלקוחות וייעלם אוטומטית כשייתפס.
        </p>
      </div>

      {/* Active promos */}
      {activePromos.length > 0 && (
        <section className="mb-8">
          <h2 className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#16A34A' }}>מבצעים פעילים</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePromos.map(p => {
              const z = zimmers.find(x => x.id === p.zimmer_id);
              const nights = calcNights(p.check_in, p.check_out);
              return (
                <div key={p.id} className="rounded-2xl p-4 flex items-center gap-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.1)' }}>
                    <Sparkles size={22} style={{ color: '#F97316' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: '#1A1A1A' }}>{p.zimmer_name}</div>
                    <div className="text-xs" style={{ color: '#6B7280' }}>{p.check_in} עד {p.check_out} · {nights} לילות</div>
                    <div className="inline-block mt-1 text-xs font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.12)', color: '#EA580C' }}>הנחה {p.discount_percent}%</div>
                  </div>
                  <button onClick={() => removePromo(p.id)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.06)', color: '#EF4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Available zimmers this week */}
      <section>
        <h2 className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#F97316' }}>צימרים פנויים השבוע ({availableZimmers.length})</h2>
        {availableZimmers.length === 0 ? (
          <div className="text-center py-14 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>אין צימרים פנויים לשבוע הקרוב, או שכולם כבר במבצע.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {availableZimmers.map(z => (
              <button key={z.id} onClick={() => openCreate(z)}
                className="text-right rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <div className="h-36 relative overflow-hidden" style={{ background: '#F8F7F4' }}>
                  {z.images?.[0]
                    ? <img src={z.images[0]} alt={z.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl">🏠</div>}
                  <span className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#F97316' }}>
                    {z.price_per_night ? `₪${z.price_per_night}/לילה` : 'מחיר לפי פנייה'}
                  </span>
                </div>
                <div className="p-3">
                  <div className="font-bold text-sm truncate" style={{ color: '#1A1A1A' }}>{z.name}</div>
                  <div className="text-xs mb-2" style={{ color: '#9CA3AF' }}>{z.location || 'מיקום לא צוין'}</div>
                  <div className="text-xs font-semibold py-2 rounded-lg" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>✦ צור מבצע</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Past promos */}
      {pastPromos.length > 0 && (
        <section className="mt-8">
          <h2 className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>מבצעים קודמים ({pastPromos.length})</h2>
          <div className="space-y-2">
            {pastPromos.map(p => (
              <div key={p.id} className="rounded-xl px-4 py-2.5 flex items-center justify-between text-sm" style={{ background: '#fff', border: '1px solid #F0EEE8' }}>
                <span style={{ color: '#6B7280' }}>{p.zimmer_name} · {p.check_in}–{p.check_out} · {p.discount_percent}%</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F8F7F4', color: '#9CA3AF' }}>{p.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.6)' }} dir="rtl" onClick={() => setCreating(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-base" style={{ color: '#1A1A1A' }}>צור מבצע · {creating.name}</h3>
              <button onClick={() => setCreating(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F8F7F4', color: '#6B7280' }}><X size={16} /></button>
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium block mb-1" style={{ color: '#6B7280' }}>תאריכי המבצע</label>
              <DateRangeField
                start={form.check_in}
                end={form.check_out}
                onChange={(s, e) => setForm(f => ({ ...f, check_in: s, check_out: e }))}
                min={weekStart}
                max={weekEnd}
                placeholder="בחר תאריכים בשבוע הקרוב"
              />
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium" style={{ color: '#6B7280' }}>אחוז הנחה</label>
                <span className="text-lg font-black" style={{ color: '#F97316' }}>{clampDiscount(form.discount)}%</span>
              </div>
              <input type="range" min={30} max={80} value={clampDiscount(form.discount)}
                onChange={e => setForm(f => ({ ...f, discount: Number(e.target.value) }))}
                className="w-full accent-orange-500" />
              <div className="flex justify-between text-xs mt-1" style={{ color: '#9CA3AF' }}><span>מינימום 30%</span><span>מקסימום 80%</span></div>
            </div>

            {form.check_in && form.check_out && (
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(249,115,22,0.06)' }}>
                <div className="text-xs" style={{ color: '#6B7280' }}>תצוגה ללקוח:</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm line-through" style={{ color: '#9CA3AF' }}>{formatILS(previewBase(creating))}</span>
                  <span className="text-lg font-black" style={{ color: '#16A34A' }}>{formatILS(previewTotal(creating))}</span>
                </div>
              </div>
            )}

            <button onClick={save} disabled={saving || !form.check_in || !form.check_out}
              className="w-full text-white py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: '#F97316' }}>
              {saving ? 'שומר...' : 'פרסם מבצע ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}