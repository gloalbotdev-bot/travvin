import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Camera, CheckCircle2, Star, Send, AlertTriangle, Loader2 } from 'lucide-react';

// Customer checkout screen — lets the guest close out their stay, upload checkout
// photos, rate the vacation, and report any damage. Invokes `performCheckout`,
// which closes the booking and triggers the review request + cleaner notification.
export default function CustomerCheckoutTab({ user }) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [report, setReport] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [user?.id]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const all = await api.entities.BookingRequest.filter({ created_by_id: user.id, status: 'אושרה' }, '-check_in');
      const today = new Date().toISOString().slice(0, 10);
      const active = (all || []).find(b => !b.checked_out && b.check_in <= today && b.check_out >= today);
      // Prefer an in-stay booking; otherwise show the most recent approved one not yet checked out.
      const chosen = active || (all || []).find(b => !b.checked_out) || null;
      setBooking(chosen);
      setDone(!!chosen?.checked_out);
    } catch (e) { setError(e?.message || String(e)); }
    setLoading(false);
  };

  const onPickPhotos = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const f of Array.from(files)) {
        const { file_url } = await api.integrations.Core.UploadFile({ file: f });
        if (file_url) urls.push(file_url);
      }
      setPhotos(prev => [...prev, ...urls]);
    } catch (e) { setError('העלאת תמונה נכשלה: ' + (e?.message || String(e))); }
    setUploading(false);
  };

  const removePhoto = (idx) => setPhotos(prev => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    setError('');
    if (!booking) return;
    setSubmitting(true);
    try {
      await api.functions.invoke('performCheckout', {
        booking_id: booking.id,
        by: 'customer',
        photos,
        notes: notes.trim(),
        rating: rating || null,
        report: report.trim(),
      });
      setDone(true);
    } catch (e) {
      setError(e?.message || String(e));
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" dir="rtl">
        <Loader2 size={28} className="animate-spin" style={{ color: '#F97316' }} />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="rounded-2xl p-10 text-center" dir="rtl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: '#9CA3AF' }} />
        <p className="text-sm" style={{ color: '#9CA3AF' }}>אין שהות פעילה לביצוע צ'ק-אאוט כעת.</p>
      </div>
    );
  }

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #E8E5E0', background: '#fff', fontSize: '14px', color: '#1A1A1A', fontFamily: 'Heebo, sans-serif', outline: 'none' };

  return (
    <div dir="rtl" className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>צ'ק-אאוט</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>{booking.zimmer_name} · {booking.check_in} עד {booking.check_out}</p>
      </div>

      {done ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <CheckCircle2 size={32} style={{ color: '#16A34A' }} />
          </div>
          <h2 className="text-lg font-black mb-1" style={{ color: '#1A1A1A' }}>תודה שביצעת צ'ק-אאוט! 🙏</h2>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>ההזמנה נסגרה. המערכת מכינה את היחידה לאורח הבא ושולחת בקשת ביקורת אליך.</p>
        </div>
      ) : (
        <div className="rounded-2xl p-5 sm:p-6 space-y-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          {/* Photos */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: '#6B7280' }}>
              <Camera size={13} /> צילום הצימר לפני היציאה (למניעת אי-הבנות)
            </label>
            <div className="flex flex-wrap gap-2">
              {photos.map((u, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden" style={{ border: '1px solid #F0EEE8' }}>
                  <img src={u} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]" style={{ background: 'rgba(0,0,0,0.6)' }}>×</button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-xl flex items-center justify-center cursor-pointer transition-all" style={{ border: '1.5px dashed #E8E5E0', color: '#9CA3AF' }}>
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                <input type="file" multiple accept="image/*" className="hidden" onChange={e => onPickPhotos(e.target.files)} />
              </label>
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: '#6B7280' }}>דירוג החופשה</label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRating(n)}>
                  <Star size={28} style={{ color: n <= rating ? '#F97316' : '#E8E5E0', fill: n <= rating ? '#F97316' : 'transparent' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>הערות לבעל המתחם</label>
            <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות כלליות..." />
          </div>

          {/* Report */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold mb-1.5" style={{ color: '#EF4444' }}>
              <AlertTriangle size={13} /> דיווח על תקלה / נזק (אופציונלי)
            </label>
            <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={report} onChange={e => setReport(e.target.value)} placeholder="תאר את התקלה או הנזק..." />
          </div>

          {error && <div className="text-sm" style={{ color: '#EF4444' }}>{error}</div>}

          <button onClick={submit} disabled={submitting || uploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: '#F97316' }}>
            {submitting ? <><Loader2 size={16} className="animate-spin" /> מבצע צ'ק-אאוט...</> : <><Send size={16} /> ביצעתי צ'ק-אאוט</>}
          </button>
        </div>
      )}
    </div>
  );
}