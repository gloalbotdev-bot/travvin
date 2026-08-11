import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Save, CheckCircle } from 'lucide-react';

export default function CustomerProfileTab({ user }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ phone: '', vacation_preferences: '', preferred_regions: '', num_guests_usual: '' });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.entities.CustomerProfile.filter({ user_id: user.id }).then(data => {
      if (data.length > 0) {
        setProfile(data[0]);
        setForm({
          phone: data[0].phone || '',
          vacation_preferences: data[0].vacation_preferences || '',
          preferred_regions: data[0].preferred_regions || '',
          num_guests_usual: data[0].num_guests_usual || '',
        });
      }
      setLoading(false);
    });
  }, [user.id]);

  const handleSave = async () => {
    const data = { user_id: user.id, user_name: user.full_name, user_email: user.email, ...form };
    if (profile) {
      await api.entities.CustomerProfile.update(profile.id, data);
    } else {
      const created = await api.entities.CustomerProfile.create(data);
      setProfile(created);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div></div>;

  const inputCls = "w-full bg-[#F8F7F4] border border-[#E8E5E0] focus:bg-white focus:border-[#F97316] rounded-xl px-4 py-3.5 text-[#1A1A1A] text-sm outline-none transition-colors";

  return (
    <div dir="rtl" className="max-w-xl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <h1 className="text-2xl font-black mb-1 lg:hidden" style={{ color: '#1A1A1A' }}>פרופיל אישי</h1>
      <p className="text-sm mb-5 lg:mb-7" style={{ color: '#9CA3AF' }}>{user.email}</p>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>שם מלא</label>
          <div className="rounded-xl px-4 py-3.5 text-sm" style={{ background: '#F0EEE8', color: '#6B7280' }}>{user.full_name || '—'}</div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>טלפון</label>
          <input
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="050-0000000"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>אזורים מועדפים לנופש</label>
          <input
            value={form.preferred_regions}
            onChange={e => setForm(f => ({ ...f, preferred_regions: e.target.value }))}
            placeholder="צפון, ים המלח, גליל..."
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>מספר אורחים רגיל</label>
          <input
            type="number"
            inputMode="numeric"
            value={form.num_guests_usual}
            onChange={e => setForm(f => ({ ...f, num_guests_usual: e.target.value }))}
            placeholder="2"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>מה אני אוהב בנופש 🌿</label>
          <textarea
            value={form.vacation_preferences}
            onChange={e => setForm(f => ({ ...f, vacation_preferences: e.target.value }))}
            placeholder="לדוגמה: שקט ופרטיות, בריכה, נוף להרים, קרוב לטבע, כשר..."
            rows={4}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        className="mt-5 w-full lg:w-auto flex items-center justify-center gap-2 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
        style={{ background: '#F97316' }}
      >
        {saved ? <><CheckCircle size={18} /> נשמר!</> : <><Save size={18} /> שמור פרופיל</>}
      </button>
    </div>
  );
}