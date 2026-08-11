import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Tag, ArrowRight, MessageSquare, CalendarCheck, Sparkles } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { calcNights, formatILS, promoOriginalPerNight, promoDiscountedPerNight, promoStayTotal } from '@/lib/bookingPrice';

const todayStr = () => new Date().toISOString().split('T')[0];

export default function Promotions() {
  const navigate = useNavigate();
  const [promos, setPromos] = useState([]);
  const [zimmers, setZimmers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const all = await api.entities.Promotion.filter({ status: 'פעיל' });
        const active = all.filter(p => p.check_out && p.check_out >= todayStr());
        setPromos(active);
        if (active.length) {
          const uniqIds = [...new Set(active.map(p => p.zimmer_id))];
          const zs = await Promise.all(uniqIds.map(id => api.entities.Zimmer.get(id).catch(() => null)));
          const map = {};
          zs.forEach(z => { if (z) map[z.id] = z; });
          setZimmers(map);
        }
      } catch (e) { /* silent */ }
      setLoading(false);
    })();
  }, []);

  const openChat = (promo, action) => {
    sessionStorage.setItem('promo_context', JSON.stringify({ promoId: promo.id, action }));
    navigate('/chat');
  };

  return (
    <div className="min-h-screen" dir="rtl" style={{ background: 'linear-gradient(160deg, #FFF7ED 0%, #FFFFFF 40%)', fontFamily: 'Heebo, sans-serif' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 px-5 py-4 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #F0EEE8' }}>
        <button onClick={() => navigate('/chat')} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
          <ArrowRight size={17} />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-black flex items-center gap-2" style={{ color: '#1A1A1A' }}>
            <Sparkles size={18} style={{ color: '#F97316' }} /> מבצעים
          </h1>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>הנחות עד 70% לשבוע הקרוב</p>
        </div>
        <a href="/chat" className="text-xs px-3 py-1.5 rounded-full" style={{ background: '#F8F7F4', color: '#6B7280' }}>צ'אט</a>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        ) : promos.length === 0 ? (
          <div className="text-center py-24 rounded-3xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.1)' }}>
              <Tag size={28} style={{ color: '#F97316' }} />
            </div>
            <h2 className="text-lg font-black mb-1" style={{ color: '#1A1A1A' }}>אין מבצעים פעילים כרגע</h2>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>חזור מאוחר יותר — מבצעים חדשים מתפרסמים כל שבוע.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {promos.map(p => {
              const z = zimmers[p.zimmer_id];
              if (!z) return null;
              const nights = calcNights(p.check_in, p.check_out);
              const origPerNight = promoOriginalPerNight(z, p);
              const discPerNight = promoDiscountedPerNight(z, p);
              const total = promoStayTotal(z, p, 2, 0);
              return (
                <div key={p.id} className="rounded-3xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                  <div className="relative h-44" style={{ background: '#F8F7F4' }}>
                    {z.images?.[0]
                      ? <Image src={z.images[0]} alt={z.name} className="w-full h-full" fittingType="fill" />
                      : <div className="w-full h-full flex items-center justify-center text-4xl">🏠</div>}
                    <span className="absolute top-3 right-3 text-white text-sm font-black px-3 py-1.5 rounded-full" style={{ background: '#EF4444' }}>
                      {p.discount_percent}% הנחה
                    </span>
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white">
                      <span className="text-xs line-through opacity-80">{formatILS(origPerNight)}</span>
                      <span className="text-base font-black" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{formatILS(discPerNight)}/לילה</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-black text-base mb-1" style={{ color: '#1A1A1A' }}>{z.name}</h3>
                    {z.location && <p className="text-xs mb-2" style={{ color: '#9CA3AF' }}>📍 {z.location}</p>}
                    <div className="flex items-center gap-2 text-xs mb-3" style={{ color: '#6B7280' }}>
                      <CalendarCheck size={13} /> {p.check_in} עד {p.check_out} · {nights} לילות
                      {z.max_guests && <span>· עד {z.max_guests} אורחים</span>}
                    </div>
                    {z.description && <p className="text-sm mb-3 line-clamp-2" style={{ color: '#6B7280' }}>{z.description}</p>}
                    <div className="rounded-xl p-2.5 mb-3 flex items-center justify-between" style={{ background: 'rgba(249,115,22,0.06)' }}>
                      <span className="text-xs" style={{ color: '#6B7280' }}>סה"כ ל-{nights} לילות (2 מבוגרים)</span>
                      <span className="text-base font-black" style={{ color: '#16A34A' }}>{formatILS(total)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openChat(p, 'ask')}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                        style={{ background: 'rgba(7,94,84,0.08)', color: '#075E54', border: '1.5px solid rgba(7,94,84,0.18)' }}>
                        <MessageSquare size={14} className="inline ml-1" /> שאל בצ'אט
                      </button>
                      <button onClick={() => openChat(p, 'book')}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                        style={{ background: '#25D366' }}>
                        <CalendarCheck size={14} className="inline ml-1" /> הזמן במבצע
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}