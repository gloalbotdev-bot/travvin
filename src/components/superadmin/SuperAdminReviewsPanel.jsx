import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Star, Plus, X, Trash2 } from 'lucide-react';
import OwnerReviewCard from '@/components/reviews/OwnerReviewCard';
import ReviewActionModal from '@/components/reviews/ReviewActionModal';
import { getBookingTotal, formatILS } from '@/lib/bookingPrice';

const SOURCE_OPTIONS = ['ידני', 'Google', 'Booking.com', 'Airbnb', 'WhatsApp'];

export default function SuperAdminReviewsPanel() {
  const [reviews, setReviews] = useState([]);
  const [zimmers, setZimmers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ zimmer_id: '', guest_name: '', rating: 5, text: '', source: 'ידני', review_date: '' });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    const [revs, zims, users] = await Promise.all([
      base44.entities.Review.list('-created_date', 500),
      base44.entities.Zimmer.list(),
      base44.entities.User.list(),
    ]);
    setReviews(revs || []);
    setZimmers(zims || []);
    setOwners(users || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const ownerName = (ownerId) => owners.find(o => o.id === ownerId)?.full_name || '—';
  const zimmerName = (zid) => zimmers.find(z => z.id === zid)?.name || '—';

  const openAction = async (review, mode) => {
    let booking = null;
    let bookingTotal = 0;
    if (review.booking_id) {
      try {
        booking = await base44.entities.BookingRequest.get(review.booking_id);
        const z = zimmers.find(zz => zz.id === review.zimmer_id);
        bookingTotal = getBookingTotal(booking, z);
      } catch {}
    }
    if (mode === 'delete') { setConfirmDelete(review); return; }
    setModal({ mode, review, booking, bookingTotal });
  };

  const runAction = async (data) => {
    setSaving(true);
    const r = modal.review;
    const now = new Date().toISOString();
    try {
      if (modal.mode === 'respond') {
        await base44.entities.Review.update(r.id, { status: 'published', owner_response: data.owner_response, owner_response_at: now, published_at: now });
      } else if (modal.mode === 'compromise') {
        await base44.entities.Review.update(r.id, {
          status: 'compromise_offered',
          settlement_offer: { percentage: data.percentage, amount: data.amount, owner_note: data.owner_note, status: 'pending', offered_at: now },
        });
        if (r.customer_id) {
          await base44.functions.invoke('pushInAppNotification', {
            audience: 'customer', target_user_ids: [r.customer_id], category: 'הודעה',
            title: 'הצעת פשרה על ביקורתך',
            body: `הוצע לך החזר של ${data.percentage}% (${formatILS(data.amount)}) תמורת הסרת הביקורת.`,
            action_type: 'open_review', action_entity_id: r.id,
          });
        }
      } else if (modal.mode === 'dispute') {
        await base44.entities.Review.update(r.id, { status: 'disputed', dispute_reason: data.dispute_reason, disputed_at: now });
      }
      await load();
    } catch (e) { alert('שגיאה: ' + e.message); }
    setSaving(false);
    setModal(null);
  };

  const doDelete = async (review) => {
    await base44.entities.Review.update(review.id, { status: 'removed' });
    setConfirmDelete(null);
    load();
  };

  const hardDelete = async (review) => {
    await base44.entities.Review.delete(review.id);
    setConfirmDelete(null);
    load();
  };

  const saveManual = async (e) => {
    e.preventDefault();
    const zimmer = zimmers.find(z => z.id === manual.zimmer_id);
    await base44.entities.Review.create({
      ...manual,
      owner_id: zimmer?.owner_id || '',
      zimmer_name: zimmer?.name || '',
      rating: Number(manual.rating),
      status: 'published',
      published_at: new Date().toISOString(),
    });
    setShowManual(false);
    setManual({ zimmer_id: '', guest_name: '', rating: 5, text: '', source: 'ידני', review_date: '' });
    load();
  };

  const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A', outline: 'none', borderRadius: '12px' };

  const filtered = reviews.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterOwner && r.owner_id !== filterOwner) return false;
    if (search && !(r.zimmer_name || '').includes(search) && !(r.guest_name || '').includes(search) && !(r.customer_name || '').includes(search) && !(r.text || '').includes(search)) return false;
    return true;
  });

  const published = reviews.filter(r => r.status === 'published');
  const avgRating = published.length ? (published.reduce((a, r) => a + (r.rating || 0), 0) / published.length).toFixed(1) : null;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" /></div>;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>ניהול ביקורות</h1>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>{reviews.length} ביקורות · ממוצע פורסם {avgRating || '—'}</p>
        </div>
        <button onClick={() => setShowManual(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90" style={{ background: '#F97316' }}>
          <Plus size={15} /> הוסף ביקורת ידנית
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-2.5 text-sm" style={inputStyle}>
          <option value="">כל הסטטוסים</option>
          <option value="pending_publish">ממתין לפרסום</option>
          <option value="pending_owner">ממתין לבעל מתחם</option>
          <option value="compromise_offered">הוצעה פשרה</option>
          <option value="published">פורסמה</option>
          <option value="disputed">בערעור</option>
          <option value="removed">נמחקה</option>
        </select>
        <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className="px-4 py-2.5 text-sm" style={inputStyle}>
          <option value="">כל בעלי המתחם</option>
          {owners.filter(o => zimmers.some(z => z.owner_id === o.id)).map(o => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש חופשי..." className="flex-1 min-w-[160px] px-4 py-2.5 text-sm" style={inputStyle} />
        {(filterStatus || filterOwner || search) && (
          <button onClick={() => { setFilterStatus(''); setFilterOwner(''); setSearch(''); }} className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl" style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}><X size={13} /> נקה</button>
        )}
      </div>

      <div className="space-y-3">
        {filtered.map(r => (
          <div key={r.id} id={'rev-' + r.id}>
            <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: '#9CA3AF' }}>
              <span style={{ color: '#F97316' }}>{ownerName(r.owner_id)}</span> · {r.zimmer_name}
            </div>
            <OwnerReviewCard review={r} onAction={(mode) => openAction(r, mode)} isAdmin />
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <Star size={40} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>אין ביקורות תואמות</p>
          </div>
        )}
      </div>

      {/* Manual add */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-lg" style={{ color: '#1A1A1A' }}>הוסף ביקורת ידנית</h2>
              <button onClick={() => setShowManual(false)} type="button"><X size={18} style={{ color: '#9CA3AF' }} /></button>
            </div>
            <form onSubmit={saveManual} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>צימר *</label>
                <select required value={manual.zimmer_id} onChange={e => setManual(f => ({ ...f, zimmer_id: e.target.value }))} className="w-full px-4 py-3 text-sm" style={inputStyle}>
                  <option value="">בחר צימר</option>
                  {zimmers.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>שם האורח</label>
                  <input value={manual.guest_name} onChange={e => setManual(f => ({ ...f, guest_name: e.target.value }))} placeholder="שם האורח" className="w-full px-4 py-3 text-sm" style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>תאריך</label>
                  <input type="date" value={manual.review_date} onChange={e => setManual(f => ({ ...f, review_date: e.target.value }))} className="w-full px-4 py-3 text-sm" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מקור</label>
                <select value={manual.source} onChange={e => setManual(f => ({ ...f, source: e.target.value }))} className="w-full px-4 py-3 text-sm" style={inputStyle}>
                  {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>דירוג *</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setManual(f => ({ ...f, rating: n }))}>
                      <Star size={20} fill={n <= manual.rating ? '#F97316' : 'none'} style={{ color: n <= manual.rating ? '#F97316' : '#D1D5DB' }} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>תוכן הביקורת</label>
                <textarea value={manual.text} onChange={e => setManual(f => ({ ...f, text: e.target.value }))} rows={4} placeholder="מה כתב האורח..." className="w-full px-4 py-3 text-sm resize-none" style={inputStyle} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowManual(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>ביטול</button>
                <button type="submit" className="flex-1 py-3 rounded-xl text-sm font-bold text-white" style={{ background: '#F97316' }}>שמור</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action modal */}
      {modal && (
        <ReviewActionModal mode={modal.mode} review={modal.review} booking={modal.booking} bookingTotal={modal.bookingTotal} onSubmit={runAction} onCancel={() => setModal(null)} saving={saving} />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ background: '#fff' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Trash2 size={22} style={{ color: '#EF4444' }} />
            </div>
            <h3 className="text-lg font-black mb-1" style={{ color: '#1A1A1A' }}>מחיקת ביקורת</h3>
            <p className="text-sm mb-1" style={{ color: '#6B7280' }}>{confirmDelete.zimmer_name}</p>
            <p className="text-xs mb-5" style={{ color: '#9CA3AF' }}>סה"כ מספר ביקורות: {reviews.length} · ביקורות פורסמו: {published.length}</p>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>ביטול</button>
              <button onClick={() => doDelete(confirmDelete)} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>הסתרה (soft)</button>
            </div>
            <button onClick={() => hardDelete(confirmDelete)} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#EF4444' }}>מחיקה מלאה</button>
          </div>
        </div>
      )}
    </div>
  );
}