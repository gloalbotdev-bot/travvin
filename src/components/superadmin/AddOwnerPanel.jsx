import React, { useState } from 'react';
import { api } from '@/api/client';
import { UserPlus, Copy, Check } from 'lucide-react';

const inputStyle = {
  background: '#F8F7F4',
  border: '1.5px solid #E8E5E0',
  color: '#1A1A1A',
  outline: 'none',
  borderRadius: '12px',
};

export default function AddOwnerPanel({ onInvited }) {
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    business_name: '',
    location: '',
  });
  const [step, setStep] = useState('form'); // 'form' | 'done'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedName, setSavedName] = useState('');

  const loginLink = `${window.location.origin}/owner`;

  const handleSubmit = async () => {
    if (!form.email.trim()) { setError('מייל הוא שדה חובה'); return; }
    setLoading(true);
    setError('');
    try {
      const invited = await api.users.inviteUser(form.email.trim(), 'owner');
      const name = form.full_name.trim();
      if (invited?.id && (name || form.phone.trim() || form.business_name.trim())) {
        const patch = {};
        if (name) patch.full_name = name;
        if (form.phone.trim()) patch.phone = form.phone.trim();
        if (form.business_name.trim()) patch.business_name = form.business_name.trim();
        await api.entities.User.update(invited.id, patch);
      }
      // Pre-create OwnerRequest so they land with context
      await api.entities.OwnerRequest.create({
        user_id: '__pending__' + form.email.trim(),
        user_name: name || form.full_name,
        user_email: form.email.trim(),
        business_name: form.business_name,
        phone: form.phone,
        status: 'אושרה',
      });
      setSavedName(name);
      setStep('done');
      if (onInvited) onInvited();
    } catch (e) {
      setError('שגיאה בשליחת ההזמנה. ייתכן שהמייל כבר קיים במערכת.');
    }
    setLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(loginLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(34,197,94,0.1)' }}
        >
          <Check size={22} style={{ color: '#16A34A' }} />
        </div>
        <h2 className="text-2xl font-black mb-2" style={{ color: '#1A1A1A' }}>בעל המתחם הוקם בהצלחה!</h2>
        <p className="text-sm mb-2" style={{ color: '#6B7280' }}>
          הזמנה נשלחה למייל <span className="font-medium" style={{ color: '#1A1A1A' }}>{form.email || 'שצוין'}</span>
        </p>
        {savedName ? (
          <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
            נשמר בשם <span className="font-medium" style={{ color: '#1A1A1A' }}>{savedName}</span>
          </p>
        ) : (
          <div className="mb-8" />
        )}

        <div className="rounded-2xl p-5 text-right mb-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <p className="text-sm mb-2" style={{ color: '#6B7280' }}>שלח לבעל המתחם את הקישור הזה:</p>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-mono select-all break-all"
              style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#6B7280' }}
            >
              {loginLink}
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: '#F97316' }}
            >
              {copied ? <><Check size={14} /> הועתק</> : <><Copy size={14} /> העתק</>}
            </button>
          </div>
          <p className="text-xs mt-3" style={{ color: '#9CA3AF' }}>
            בעל המתחם ייכנס עם גוגל בכתובת המייל שהזנת — והמערכת תזהה אותו אוטומטית כבעל מתחם.
          </p>
        </div>

        <button
          onClick={() => {
            setStep('form');
            setSavedName('');
            setForm({ email: '', full_name: '', phone: '', business_name: '', location: '' });
          }}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ border: '1.5px solid #E8E5E0', color: '#6B7280', background: '#fff' }}
        >
          הוסף בעל מתחם נוסף
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(249,115,22,0.12)' }}
        >
          <UserPlus size={18} style={{ color: '#F97316' }} />
        </div>
        <div>
          <h1 className="text-xl font-black" style={{ color: '#1A1A1A' }}>הוספת בעל מתחם חדש</h1>
          <p className="text-sm" style={{ color: '#6B7280' }}>מלא פרטים ושלח הזמנה — הוא מתחבר עם Google ומגיע ישירות לפאנל</p>
        </div>
      </div>

      <div className="rounded-2xl p-6 space-y-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <div>
          <label className="block text-sm mb-1.5" style={{ color: '#6B7280' }}>מייל *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="owner@example.com"
            className="w-full px-4 py-2.5 text-sm"
            style={inputStyle}
          />
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>חייב להיות זהה לחשבון ה-Google שלו</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: '#6B7280' }}>שם מלא</label>
            <input
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="ישראל ישראלי"
              className="w-full px-4 py-2.5 text-sm"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: '#6B7280' }}>טלפון</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="050-0000000"
              className="w-full px-4 py-2.5 text-sm"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1.5" style={{ color: '#6B7280' }}>שם העסק / הצימר</label>
          <input
            value={form.business_name}
            onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
            placeholder="צימר הגליל / נופש בכרמל"
            className="w-full px-4 py-2.5 text-sm"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-sm mb-1.5" style={{ color: '#6B7280' }}>אזור / מיקום</label>
          <input
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="גליל, כרמל, ים המלח..."
            className="w-full px-4 py-2.5 text-sm"
            style={inputStyle}
          />
        </div>

        {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}

        <div className="rounded-xl p-4 text-xs leading-relaxed" style={{ background: '#F8F7F4', color: '#9CA3AF' }}>
          <strong style={{ color: '#6B7280' }}>מה יקרה אחרי השליחה:</strong>
          <ol className="mt-2 space-y-1 list-decimal list-inside">
            <li>המייל שהזנת יקבל הזמנה להצטרף לאפליקציה</li>
            <li>בעל המתחם לוחץ על הקישור ומתחבר עם Google</li>
            <li>המערכת מזהה את המייל → הוא נכנס ישירות ל-OwnerPanel</li>
            <li>תוכל לשלוח לו גם את הקישור הישיר לפאנל</li>
          </ol>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !form.email.trim()}
          className="w-full py-3 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90"
          style={{ background: '#F97316' }}
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> שולח...</>
          ) : (
            <><UserPlus size={16} /> שלח הזמנה והקם בעל מתחם</>
          )}
        </button>
      </div>
    </div>
  );
}
