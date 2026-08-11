import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import GoogleIcon from '@/components/GoogleIcon';

export default function JoinAsOwner() {
  const [step, setStep] = useState('landing');

  useEffect(() => {
    api.auth.me().then(u => {
      if (!u) return;
      if (u.role === 'owner' || u.role === 'admin') { window.location.href = '/owner'; }
      else { grantOwnerAccess(u); }
    }).catch(() => {});
  }, []);

  const grantOwnerAccess = async (u) => {
    setStep('loading');
    try {
      await api.auth.updateMe({ role: 'owner' });
    } catch (_) {
      try { await api.users.inviteUser(u.email, 'owner'); } catch (_2) {}
    }
    window.location.href = '/owner';
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(160deg, #EAD5FF 0%, #FFD4C2 45%, #C5DEFF 100%)', fontFamily: 'Heebo, sans-serif' }} dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ background: '#1A1A1A' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4L4 11v13h7v-7h6v7h7V11L14 4z" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/></svg>
          </div>
          <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>הצטרף כבעל מתחם</h1>
          <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>נהל את הצימרים שלך עם עוזר AI חכם</p>
        </div>

        {step === 'landing' && (
          <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <p className="text-sm text-center mb-5" style={{ color: '#6B7280' }}>התחבר עם גוגל כדי להמשיך</p>
            <button onClick={() => api.auth.loginWithProvider('google', window.location.href)}
              className="w-full flex items-center justify-center gap-3 bg-white py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-md"
              style={{ border: '1.5px solid #E8E5E0', color: '#1A1A1A' }}>
              <GoogleIcon />התחבר עם Google
            </button>
          </div>
        )}

        {step === 'loading' && (
          <div className="rounded-2xl p-10 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm" style={{ color: '#6B7280' }}>מגדיר את החשבון שלך...</p>
          </div>
        )}
      </div>
    </div>
  );
}