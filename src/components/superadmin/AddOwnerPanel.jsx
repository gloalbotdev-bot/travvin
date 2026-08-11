import React, { useState } from 'react';
import { api } from '@/api/client';
import { UserPlus, Copy, Check, X } from 'lucide-react';

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

  const loginLink = `${window.location.origin}/owner`;

  const handleSubmit = async () => {
    if (!form.email.trim()) { setError('מייל הוא שדה חובה'); return; }
    setLoading(true);
    setError('');
    try {
      await api.users.inviteUser(form.email.trim(), 'owner');
      // Pre-create OwnerRequest so they land with context
      await api.entities.OwnerRequest.create({
        user_id: '__pending__' + form.email.trim(),
        user_name: form.full_name,
        user_email: form.email.trim(),
        business_name: form.business_name,
        phone: form.phone,
        status: 'אושרה',
      });
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
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-white mb-2">בעל המתחם הוקם בהצלחה!</h2>
        <p className="text-gray-400 text-sm mb-8">הזמנה נשלחה למייל <span className="text-white font-medium">{form.email || 'שצוין'}</span></p>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-right mb-6">
          <p className="text-gray-400 text-sm mb-2">שלח לבעל המתחם את הקישור הזה:</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-300 font-mono select-all">
              {loginLink}
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {copied ? <><Check size={14} /> הועתק</> : <><Copy size={14} /> העתק</>}
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-3">
            בעל המתחם ייכנס עם גוגל בכתובת המייל שהזנת — והמערכת תזהה אותו אוטומטית כבעל מתחם.
          </p>
        </div>

        <button
          onClick={() => { setStep('form'); setForm({ email: '', full_name: '', phone: '', business_name: '', location: '' }); }}
          className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          הוסף בעל מתחם נוסף
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
          <UserPlus size={18} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">הוספת בעל מתחם חדש</h1>
          <p className="text-gray-400 text-sm">מלא פרטים ושלח הזמנה — הוא מתחבר עם Google ומגיע ישירות לפאנל</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">מייל *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="owner@example.com"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500 transition-colors"
          />
          <p className="text-gray-600 text-xs mt-1">חייב להיות זהה לחשבון ה-Google שלו</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">שם מלא</label>
            <input
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="ישראל ישראלי"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">טלפון</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="050-0000000"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">שם העסק / הצימר</label>
          <input
            value={form.business_name}
            onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
            placeholder="צימר הגליל / נופש בכרמל"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">אזור / מיקום</label>
          <input
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="גליל, כרמל, ים המלח..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="bg-gray-800/60 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-400">מה יקרה אחרי השליחה:</strong>
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
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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