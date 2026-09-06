import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { User, Bell, Link, ArrowRight, Save, Check, Upload } from 'lucide-react';

const inputStyle = {
  background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A', borderRadius: '12px', outline: 'none',
};
const inputFocus = (e) => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; };
const inputBlur = (e) => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#F8F7F4'; };

export default function AccountSettings({ embedded = false }) {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ full_name: '', phone: '', business_name: '', avatar_url: '' });
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [notifications, setNotifications] = useState({ new_booking: true, booking_approved: true, booking_rejected: false, daily_summary: false });

  useEffect(() => {
    api.auth.me().then(u => {
      setUser(u);
      setProfile({ full_name: u.full_name || '', phone: u.phone || '', business_name: u.business_name || '', avatar_url: u.avatar_url || '' });
      if (u.notifications) setNotifications({ ...notifications, ...u.notifications });
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (tab === 'profile') await api.auth.updateMe({ phone: profile.phone, business_name: profile.business_name, avatar_url: profile.avatar_url });
    else if (tab === 'notifications') await api.auth.updateMe({ notifications });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  const tabItems = [
    { id: 'profile', label: 'פרטים אישיים', icon: User },
    { id: 'notifications', label: 'התראות', icon: Bell },
    { id: 'integrations', label: 'חיבורים', icon: Link },
  ];

  return (
    <div className={embedded ? '' : 'min-h-screen p-8'} style={embedded ? {} : { background: '#F8F7F4', fontFamily: 'Heebo, sans-serif' }} dir="rtl">
      <div className="max-w-2xl">
        {!embedded && (
          <div className="flex items-center gap-3 mb-8">
            <a href="/owner" className="w-9 h-9 rounded-xl flex items-center justify-center transition-all" style={{ background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
              <ArrowRight size={17} />
            </a>
            <div>
              <h1 className="text-xl font-black" style={{ color: '#1A1A1A' }}>הגדרות חשבון</h1>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>{user?.email}</p>
            </div>
          </div>
        )}
        {embedded && (
          <div className="mb-8">
            <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>הגדרות חשבון</h1>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>{user?.email}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl p-1 mb-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          {tabItems.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={tab === t.id ? { background: '#F8F7F4', color: '#1A1A1A' } : { color: '#9CA3AF' }}>
                <Icon size={14} />{t.label}
              </button>
            );
          })}
        </div>

        {/* Profile */}
        {tab === 'profile' && (
          <div className="rounded-2xl p-6 space-y-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <div className="flex items-center gap-4 pb-4" style={{ borderBottom: '1px solid #F0EEE8' }}>
              <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: '#F0EEE8', border: '2px solid #F3EEE3' }}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-xl font-bold" style={{ color: '#9CA3AF' }}>{(profile.full_name || '?')[0]}</span>}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>תמונת פרופיל</p>
                <p className="text-xs mb-2" style={{ color: '#9CA3AF' }}>מוצגת ללקוחות בפיד הוידאו ובצ'אט הישיר</p>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
                  {avatarBusy ? <div className="w-3.5 h-3.5 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" /> : <Upload size={13} />}
                  {avatarBusy ? 'מעלה...' : 'העלה תמונה'}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0]; e.target.value = '';
                    if (!f) return;
                    setAvatarBusy(true);
                    try {
                      const { file_url } = await api.integrations.Core.UploadFile({ file: f });
                      const updated = await api.auth.updateMe({ avatar_url: file_url });
                      setProfile((p) => ({ ...p, avatar_url: file_url }));
                      setUser((u) => ({ ...u, avatar_url: file_url }));
                    } catch { alert('שגיאה בהעלאת התמונה.'); }
                    setAvatarBusy(false);
                  }} />
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>שם מלא</label>
              <input value={profile.full_name} disabled className="w-full px-4 py-3 text-sm cursor-not-allowed" style={{ ...inputStyle, color: '#9CA3AF' }} />
              <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>השם מנוהל דרך חשבון ההתחברות שלך</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>טלפון</label>
              <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                className="w-full px-4 py-3 text-sm" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} placeholder="050-0000000" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>שם העסק</label>
              <input value={profile.business_name} onChange={e => setProfile(p => ({ ...p, business_name: e.target.value }))}
                className="w-full px-4 py-3 text-sm" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} placeholder="שם הצימר / העסק שלך" />
            </div>
          </div>
        )}

        {/* Notifications */}
        {tab === 'notifications' && (
          <div className="rounded-2xl p-6 space-y-1" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            {[
              { key: 'new_booking', label: 'הזמנה חדשה', desc: 'קבל התראה כשמגיעה בקשת הזמנה חדשה' },
              { key: 'booking_approved', label: 'הזמנה אושרה', desc: 'אישור כשהזמנה מאושרת' },
              { key: 'booking_rejected', label: 'הזמנה נדחתה', desc: 'עדכון כשהזמנה נדחית' },
              { key: 'daily_summary', label: 'סיכום יומי', desc: 'סיכום כניסות ויציאות לכל יום' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-3.5" style={{ borderBottom: '1px solid #F0EEE8' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{item.desc}</p>
                </div>
                <button onClick={() => setNotifications(n => ({ ...n, [item.key]: !n[item.key] }))}
                  className="w-11 h-6 rounded-full transition-all relative flex-shrink-0"
                  style={{ background: notifications[item.key] ? '#F97316' : '#E8E5E0' }}>
                  <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                    style={{ right: notifications[item.key] ? '0.125rem' : '1.25rem' }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Integrations */}
        {tab === 'integrations' && (
          <div className="space-y-3">
            <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0" style={{ border: '1.5px solid #F0EEE8' }}>
                  <svg viewBox="0 0 48 48" className="w-6 h-6">
                    <path fill="#4285F4" d="M45.5 24.5c0-1.6-.1-3.1-.4-4.6H24v8.7h12.1c-.5 2.8-2.1 5.1-4.5 6.7v5.5h7.3c4.3-3.9 6.6-9.7 6.6-16.3z"/>
                    <path fill="#34A853" d="M24 46c6.1 0 11.2-2 14.9-5.5l-7.3-5.5c-2 1.4-4.6 2.2-7.6 2.2-5.8 0-10.8-3.9-12.5-9.2H4v5.7C7.7 41.4 15.4 46 24 46z"/>
                    <path fill="#FBBC05" d="M11.5 28c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5V13.3H4C2.4 16.5 1.5 20.1 1.5 24s.9 7.5 2.5 10.7l7.5-6.7z"/>
                    <path fill="#EA4335" d="M24 9.8c3.3 0 6.2 1.1 8.5 3.3l6.4-6.4C35.2 3.1 30 1 24 1 15.4 1 7.7 5.6 4 13.3l7.5 5.7C13.2 13.7 18.2 9.8 24 9.8z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Google Calendar</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>סנכרן הזמנות ישירות ליומן שלך</p>
                </div>
              </div>
              <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}>מחובר ✓</span>
            </div>
            {[
              { label: 'WhatsApp Business', desc: 'שלח עדכונים ללקוחות דרך וואטסאפ', icon: '📱' },
              { label: 'תשלומים מקוונים', desc: 'קבל תשלומים ישירות מהאתר', icon: '💳' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl p-5 flex items-center justify-between opacity-40" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: '#F8F7F4' }}>{item.icon}</div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>{item.label}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{item.desc}</p>
                  </div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#F8F7F4', color: '#9CA3AF' }}>בקרוב</span>
              </div>
            ))}
          </div>
        )}

        {tab !== 'integrations' && (
          <button onClick={handleSave}
            className="mt-5 w-full flex items-center justify-center gap-2 py-3 text-white rounded-xl font-bold text-sm transition-all hover:opacity-90"
            style={{ background: '#F97316' }}>
            {saved ? <><Check size={16} /> נשמר!</> : <><Save size={16} /> שמור שינויים</>}
          </button>
        )}
      </div>
    </div>
  );
}