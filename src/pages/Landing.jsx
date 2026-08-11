import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { useRobotsMeta } from '@/hooks/useRobotsMeta';
import { CalendarDays, MessageSquare, Home, Zap, CheckCircle } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: 'easeOut' },
  }),
};

const FEATURES = [
  { icon: Home, title: 'ניהול נכסים', desc: 'כל המידע על כל נכס במקום אחד — תמונות, תיאור, מתקנים, מחירים וכללי אירוח.' },
  { icon: CalendarDays, title: 'יומן וזמינות', desc: 'ראו מה פנוי, מה תפוס ואיפה צריך לעדכן זמינות — הכול בלחיצה אחת.' },
  { icon: MessageSquare, title: 'פניות והזמנות', desc: 'שיחות, שאלות ואישורים — הכול מרוכז. הסוכן עוזר להפוך פנייה להזמנה.' },
  { icon: Zap, title: 'AI תפעולי', desc: 'ה-AI עונה לשאלות חוזרות, משלים מידע חסר ומציע פעולות — אתם בשליטה.' },
];

export default function Landing() {
  useRobotsMeta('index, follow');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.me().then(u => {
      if (u.role === 'admin') navigate('/superadmin');
      else if (u.role === 'owner') navigate('/owner');
      else navigate('/chat');
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #EAD5FF 0%, #FFD4C2 45%, #C5DEFF 100%)' }}>
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden" dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-10 py-4"
        style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="font-black text-xl tracking-tight" style={{ color: '#1A1A1A' }}>
          TRAVVIN
        </motion.div>
        <div className="flex items-center gap-3">
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            onClick={() => api.auth.loginWithProvider('google', '/join')}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:bg-black/5"
            style={{ color: '#1A1A1A' }}>
            אני בעל מתחם
          </motion.button>
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            onClick={() => api.auth.loginWithProvider('google', '/chat')}
            className="px-5 py-2 rounded-full text-sm font-semibold text-white transition-all hover:shadow-lg hover:scale-105"
            style={{ background: '#F97316' }}>
            התחילו בחינם
          </motion.button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 text-center" style={{ background: 'linear-gradient(160deg, #EAD5FF 0%, #FFD4C2 50%, #C5DEFF 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C', border: '1px solid rgba(249,115,22,0.18)' }}>
          ✦ מערכת ניהול אירוח חכמה
        </motion.div>

        <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="visible"
          className="text-5xl md:text-7xl font-black leading-tight tracking-tight max-w-3xl mx-auto mb-6"
          style={{ color: '#1A1A1A' }}>
          די לרדוף אחרי<br />
          <span style={{ color: '#F97316' }}>כל פנייה</span>
        </motion.h1>

        <motion.p custom={2} variants={fadeUp} initial="hidden" animate="visible"
          className="text-lg md:text-xl max-w-xl mx-auto mb-10 leading-relaxed"
          style={{ color: '#6B7280' }}>
          הגיע הזמן לנהל אירוח חכם יותר — מערכת AI שמרכזת הכול ועובדת בשבילך
        </motion.p>

        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible"
          className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={() => api.auth.loginWithProvider('google', '/chat')}
            className="px-8 py-3.5 rounded-full text-base font-bold text-white transition-all hover:scale-105 hover:shadow-xl"
            style={{ background: '#F97316' }}>
            אני רוצה להתארח ←
          </button>
          <button
            onClick={() => api.auth.loginWithProvider('google', '/join')}
            className="px-8 py-3.5 rounded-full text-base font-semibold transition-all hover:scale-105 hover:shadow-md"
            style={{ background: '#fff', color: '#1A1A1A', border: '1.5px solid rgba(0,0,0,0.1)' }}>
            אני בעל מתחם
          </button>
        </motion.div>

        {/* floating pills */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="mt-12 flex flex-wrap justify-center gap-2">
          {['ניהול יומן ✓', 'מענה מהיר לאורחים', 'פחות טלפונים', 'AI חכם ✦'].map((pill, i) => (
            <span key={i} className="px-4 py-1.5 rounded-full text-sm font-medium" style={{ background: '#fff', color: '#6B7280', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              {pill}
            </span>
          ))}
        </motion.div>
      </section>

      {/* Chat mockup */}
      <section className="pb-20 px-4">
        <motion.div custom={0} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-md mx-auto rounded-3xl p-5 shadow-2xl"
          style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}>
          <div className="flex items-center gap-3 mb-4 pb-4" style={{ borderBottom: '1px solid #F0EEE8' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: '#F97316' }}>Z</div>
            <div className="text-right">
              <p className="text-sm font-bold" style={{ color: '#1A1A1A' }}>TRAVVIN AI</p>
              <p className="text-xs" style={{ color: '#22C55E' }}>פעיל עכשיו</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-xs text-right" style={{ background: '#F0EEE8', color: '#374151' }}>
                תוכל להוסיף הזמנה למשפחה עם 5 נפשות, לסוף שבוע הקרוב?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-xs text-right text-white" style={{ background: '#F97316' }}>
                כמובן! בדקתי — הצימר פנוי. אוסיף את ההזמנה ליומן ואשלח אישור ✓
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ background: '#F8F7F4' }}>
            <span className="flex-1 text-sm text-right" style={{ color: '#9CA3AF' }}>כתוב הודעה...</span>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs" style={{ background: '#F97316' }}>↑</div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-20 px-4" style={{ background: '#FAFAFA' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div custom={0} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#F97316' }}>מה אנחנו מציעים</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: '#1A1A1A' }}>מערכת אחת לכל תהליך האירוח</h2>
            <p className="mt-4 text-lg max-w-xl mx-auto" style={{ color: '#6B7280' }}>TRAVVIN מרכזת את מה שצריך, מחברת את מה שחשוב</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="group p-7 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{ border: '1.5px solid #F0EEE8', background: '#FAFAF8' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                  style={{ background: 'rgba(249,115,22,0.1)' }}>
                  <f.icon size={20} style={{ color: '#F97316' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#1A1A1A' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stat */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(160deg, #EAD5FF 0%, #FFD4C2 45%, #C5DEFF 100%)' }}>
        <motion.div custom={0} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center">
          <p className="text-6xl md:text-8xl font-black mb-4" style={{ color: '#1A1A1A' }}>90%</p>
          <p className="text-xl max-w-md mx-auto" style={{ color: '#4B5563' }}>חיסכון בזמן ההתעסקות עם לקוחות — המערכת עובדת גם כשאתם לא</p>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4" style={{ background: '#FAFAFA' }}>
        <motion.div custom={0} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-3xl p-12 md:p-16 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #EAD5FF 0%, #FFD4C2 50%, #C5DEFF 100%)' }}>
          <div className="relative z-10">
            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#9333EA' }}>מהחיפוש ועד הצ׳ק-אאוט</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4" style={{ color: '#1A1A1A' }}>מוכנים לנהל אירוח<br />בצורה חכמה יותר?</h2>
            <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: '#6B7280' }}>הצטרפו לבעלי מתחמים שכבר חוסכים שעות בשבוע</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => api.auth.loginWithProvider('google', '/chat')}
                className="px-8 py-3.5 rounded-full text-base font-bold transition-all hover:scale-105 hover:shadow-xl"
                style={{ background: '#1A1A1A', color: '#fff' }}>
                אני מחפש צימר ←
              </button>
              <button onClick={() => api.auth.loginWithProvider('google', '/join')}
                className="px-8 py-3.5 rounded-full text-base font-semibold transition-all hover:scale-105"
                style={{ border: '1.5px solid rgba(0,0,0,0.15)', background: 'rgba(255,255,255,0.6)', color: '#1A1A1A' }}>
                אני בעל מתחם
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-sm" style={{ borderTop: '1px solid #F0EEE8', color: '#9CA3AF' }}>
        <p>© 2026 TRAVVIN · כל הזכויות שמורות</p>
        <button onClick={() => navigate('/admin-login')}
          className="mt-2 text-xs underline underline-offset-2 transition-colors hover:opacity-60"
          style={{ color: '#9CA3AF' }}>
          כניסת אדמין
        </button>
      </footer>
    </div>
  );
}