import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import RoleMismatchModal from '@/components/auth/RoleMismatchModal';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, delay: i * 0.08, ease: 'easeOut' },
  }),
};

function authErrorMessage(code) {
  if (code === 'oauth_failed') return 'ההתחברות עם Google נכשלה. נסו שוב.';
  if (code === 'user_not_registered') return 'המשתמש אינו רשום במערכת.';
  return null;
}

export default function Welcome() {
  const [mismatchAs, setMismatchAs] = useState(null);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const err = sp.get('auth_error');
    if (!err) return;
    if (err === 'role_mismatch') {
      setMismatchAs(sp.get('as') || 'user');
    } else {
      setBanner(authErrorMessage(err) || 'אירעה שגיאה בהתחברות.');
    }
    window.history.replaceState({}, '', '/welcome');
  }, []);

  const handleCustomer = () => api.auth.loginWithProvider('google', '/chat', 'user');
  const handleOwner = () => api.auth.loginWithProvider('google', '/owner', 'owner');
  const handleAdmin = () => { window.location.href = '/admin-login'; };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" dir="rtl" style={{ background: 'linear-gradient(160deg, #EAD5FF 0%, #FFD4C2 45%, #C5DEFF 100%)', fontFamily: 'Heebo, sans-serif' }}>
      {mismatchAs && (
        <RoleMismatchModal
          registeredAs={mismatchAs}
          onDismiss={() => setMismatchAs(null)}
        />
      )}

      {/* Logo */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ background: '#1A1A1A' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M5 7h18M5 14h12M5 21h8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/><circle cx="21" cy="20" r="4" fill="#F97316"/><path d="M21 18v2l1 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
        <h1 className="text-3xl font-black tracking-tight" style={{ color: '#1A1A1A' }}>Travvin</h1>
        <p className="mt-1.5 text-sm" style={{ color: '#9CA3AF' }}>בחר את סוג הכניסה שלך</p>
      </motion.div>

      {banner && (
        <div className="w-full max-w-sm mb-4 rounded-2xl p-4 text-center text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1.5px solid rgba(239,68,68,0.15)' }}>
          {banner}
        </div>
      )}

      <div className="w-full max-w-sm space-y-3">
        {/* Customer */}
        <motion.button custom={1} variants={fadeUp} initial="hidden" animate="visible"
          onClick={handleCustomer}
          className="w-full rounded-2xl p-5 flex items-center gap-4 text-right transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group"
          style={{ background: '#fff', border: '1.5px solid #F0EEE8', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: 'rgba(249,115,22,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 18c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round"/><circle cx="11" cy="7" r="3" stroke="#F97316" strokeWidth="1.8"/><path d="M2 18h18" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm" style={{ color: '#1A1A1A' }}>אני מחפש צימר</div>
            <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>כניסה / הרשמה כלקוח</div>
          </div>
          <span className="text-lg transition-transform group-hover:-translate-x-1" style={{ color: '#D1D5DB' }}>←</span>
        </motion.button>

        {/* Owner */}
        <motion.button custom={2} variants={fadeUp} initial="hidden" animate="visible"
          onClick={handleOwner}
          className="w-full rounded-2xl p-5 flex items-center gap-4 text-right transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group"
          style={{ background: '#fff', border: '1.5px solid #F0EEE8', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: 'rgba(249,115,22,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 10.5L11 3l8 7.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1v-8.5z" stroke="#F97316" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 20v-7h6v7" stroke="#F97316" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm" style={{ color: '#1A1A1A' }}>אני בעל מתחם</div>
            <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>כניסה / הרשמה כבעל מתחם</div>
          </div>
          <span className="text-lg transition-transform group-hover:-translate-x-1" style={{ color: '#D1D5DB' }}>←</span>
        </motion.button>

        {/* Divider */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px" style={{ background: '#F0EEE8' }}></div>
          <span className="text-xs" style={{ color: '#9CA3AF' }}>גישה מורשית בלבד</span>
          <div className="flex-1 h-px" style={{ background: '#F0EEE8' }}></div>
        </motion.div>

        {/* Admin */}
        <motion.button custom={4} variants={fadeUp} initial="hidden" animate="visible"
          onClick={handleAdmin}
          className="w-full rounded-2xl p-5 flex items-center gap-4 text-right transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group"
          style={{ background: '#1A1A1A', border: '1.5px solid rgba(255,255,255,0.06)' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 16l2-8 4 4 2-6 2 6 4-4 2 8H3z" stroke="#F97316" strokeWidth="1.8" strokeLinejoin="round"/><path d="M3 16h16" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm text-white">כניסת אדמין</div>
            <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>לחשבונות מורשים בלבד</div>
          </div>
          <span className="text-lg transition-transform group-hover:-translate-x-1" style={{ color: '#4B5563' }}>←</span>
        </motion.button>
      </div>
    </div>
  );
}
