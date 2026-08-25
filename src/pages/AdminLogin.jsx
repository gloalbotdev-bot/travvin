import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    api.auth.me().then(u => {
      if (u.role === 'admin') navigate('/superadmin');
      else { setStatus('denied'); api.auth.logout('/admin-login'); }
    }).catch(() => setStatus('idle'));
  }, []);

  if (status === 'checking') return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#F8F7F4' }}>
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(160deg, #EAD5FF 0%, #FFD4C2 45%, #C5DEFF 100%)', fontFamily: 'Heebo, sans-serif' }} dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#1A1A1A' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 21l3-10 5 5 3-8 3 8 5-5 3 10H4z" stroke="#F97316" strokeWidth="2" strokeLinejoin="round"/><path d="M4 21h20" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>כניסת אדמין</h1>
          <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>גישה מורשית בלבד</p>
        </div>

        {status === 'denied' && (
          <div className="rounded-2xl p-4 mb-6 text-center" style={{ background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.15)' }}>
            <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>אין לך הרשאות אדמין</p>
            <p className="text-xs mt-1" style={{ color: '#EF4444', opacity: 0.7 }}>פנה למנהל המערכת לקבלת גישה</p>
          </div>
        )}

        <button onClick={() => api.auth.loginWithProvider('google', '/admin-login', 'admin')}
          className="w-full text-white rounded-xl p-3.5 font-bold text-sm transition-all hover:opacity-90 hover:shadow-lg"
          style={{ background: '#F97316' }}>
          כניסה עם Google
        </button>

        <button onClick={() => navigate('/')}
          className="w-full mt-4 text-sm transition-colors py-2"
          style={{ color: '#9CA3AF' }}
          onMouseEnter={e => e.currentTarget.style.color = '#6B7280'}
          onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}>
          ← חזרה לדף הבית
        </button>
      </div>
    </div>
  );
}