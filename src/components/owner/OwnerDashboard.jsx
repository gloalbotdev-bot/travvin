import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, LogIn, LogOut, TrendingUp, Sparkles, RefreshCw, MessageCircleQuestion, Bot, Plus, ArrowLeft, X, AlertTriangle, CalendarDays, Clock, Moon } from 'lucide-react';
import { calcNights, getBookingTotal, formatILS } from '@/lib/bookingPrice';
import FloatingPendingWidget from '@/components/owner/FloatingPendingWidget';
import CalendarSyncCard from '@/components/owner/CalendarSyncCard';

const CARD_THEME = {
  checkin:   { image: 'https://media.base44.com/images/public/6a5f84f82507df5bf4e65847/c87169a7f_generated_image.png', icon: LogIn,                accent: '#22C55E' },
  checkout:  { image: 'https://media.base44.com/images/public/6a5f84f82507df5bf4e65847/fbdf4d5dc_generated_image.png', icon: LogOut,               accent: '#F97316' },
  staying:   { image: 'https://media.base44.com/images/public/6a5f84f82507df5bf4e65847/9895cf729_generated_image.png', icon: Users,                accent: '#3B82F6' },
  revenue:   { image: 'https://media.base44.com/images/public/6a5f84f82507df5bf4e65847/fc950581a_generated_image.png', icon: TrendingUp,           accent: '#F97316' },
  month:     { image: 'https://media.base44.com/images/public/6a5f84f82507df5bf4e65847/4b17d81b2_generated_image.png', icon: CalendarDays,         accent: '#F97316' },
  pending:   { image: 'https://media.base44.com/images/public/6a5f84f82507df5bf4e65847/e4ec24067_generated_image.png', icon: Clock,                accent: '#F59E0B' },
  available: { image: 'https://media.base44.com/images/public/6a5f84f82507df5bf4e65847/770709429_generated_image.png', icon: Moon,                accent: '#22C55E' },
  questions: { image: 'https://media.base44.com/images/public/6a5f84f82507df5bf4e65847/e5b12156f_generated_image.png', icon: MessageCircleQuestion, accent: '#F97316' },
};

export default function OwnerDashboard({ ownerId, zimmers, onNavigate, onAction }) {
  const [bookings, setBookings] = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [ownerChats, setOwnerChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiTips, setAiTips] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [activeStat, setActiveStat] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  useEffect(() => {
    if (!ownerId) return;
    loadBookings();
  }, [ownerId]);

  const loadBookings = async () => {
    setLoading(true);
    const [data, questions, chats] = await Promise.all([
      base44.entities.BookingRequest.filter({ owner_id: ownerId }),
      base44.entities.UnansweredQuestion.filter({ owner_id: ownerId, status: 'ממתינה' }),
      base44.entities.DirectChat.filter({ owner_id: ownerId }, '-updated_date'),
    ]);
    setBookings(data);
    setPendingQuestions(questions);
    setOwnerChats(chats);
    setLoading(false);
  };

  const checkinsToday = bookings.filter(b => b.check_in === today && b.status === 'אושרה');
  const checkoutsToday = bookings.filter(b => b.check_out === today && b.status === 'אושרה');
  const currentlyStaying = bookings.filter(b => b.status === 'אושרה' && b.check_in <= today && b.check_out > today);
  const monthBookings = bookings.filter(b => b.status === 'אושרה' && b.check_in?.startsWith(thisMonth));
  const monthRevenue = monthBookings.reduce((sum, b) => {
    const nights = Math.max(1, Math.ceil((new Date(b.check_out) - new Date(b.check_in)) / 86400000));
    const zimmer = zimmers.find(z => z.id === b.zimmer_id);
    return sum + (zimmer?.price_per_night || 0) * nights;
  }, 0);
  const pendingCount = bookings.filter(b => b.status === 'ממתינה').length;

  // Available nights in the next 30 days, per zimmer (free nights = 30 − occupied nights)
  const horizonDays = 30;
  const todayObj = new Date(today);
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays);
  const occupiedByZimmer = {};
  bookings.filter(b => b.status === 'אושרה').forEach(b => {
    if (!b.zimmer_id || !b.check_in || !b.check_out) return;
    const start = new Date(b.check_in);
    const end = new Date(b.check_out);
    for (let d = new Date(Math.max(start.getTime(), todayObj.getTime())); d < end; d.setDate(d.getDate() + 1)) {
      if (d < horizonEnd) {
        (occupiedByZimmer[b.zimmer_id] = occupiedByZimmer[b.zimmer_id] || new Set()).add(d.toISOString().slice(0, 10));
      }
    }
  });
  const availabilityData = zimmers.map(z => {
    const occupied = (occupiedByZimmer[z.id] || new Set()).size;
    return { id: z.id, name: z.name, available_nights: Math.max(0, horizonDays - occupied) };
  });
  const totalAvailableNights = availabilityData.reduce((s, a) => s + a.available_nights, 0);

  const pendingApprovals = bookings.filter(b => b.status === 'ממתינה' && !b.cancel_request_reason);
  const cancelRequests = bookings.filter(b => b.cancel_request_reason);
  const chatAwaitReply = ownerChats.filter(t => (t.messages || []).length > 0 && (t.messages || []).slice(-1)[0]?.role === 'customer');
  const dashboardActions = [
    ...pendingApprovals.map(b => ({ id: b.id, type: 'approve_booking', title: `אישור הזמנה: ${b.guest_name}`, sub: `${b.zimmer_name} · ${b.check_in} → ${b.check_out}` })),
    ...cancelRequests.map(b => ({ id: b.id, type: 'cancel_booking', title: `בקשת ביטול: ${b.guest_name}`, sub: `${b.zimmer_name} · ${b.cancel_request_reason}` })),
    ...pendingQuestions.map(q => ({ id: q.id, type: 'answer_question', title: `שאלה מלקוח: ${q.zimmer_name}`, sub: q.question })),
    ...chatAwaitReply.map(t => ({ id: t.id, type: 'open_chat', title: `צ'אט מלקוח: ${t.customer_name || 'לקוח'}`, sub: `${t.zimmer_name} · ${(t.messages || []).slice(-1)[0]?.content || ''}` })),
  ];

  const getAiTips = async () => {
    setLoadingAi(true);
    const zimmerNames = zimmers.map(z => z.name).join(', ');
    const tip = await base44.integrations.Core.InvokeLLM({
      prompt: `אתה יועץ עסקי לבעל צימרים בישראל. בעל המתחם מנהל את הצימרים: ${zimmerNames || 'צימר'}.
נתונים: ${checkinsToday.length} צ'קאין היום, ${checkoutsToday.length} צ'קאאוט היום, ${currentlyStaying.length} אורחים כרגע, ${monthBookings.length} הזמנות החודש, הכנסה חזויה ₪${monthRevenue.toLocaleString()}, ${pendingCount} בקשות ממתינות.
תן 3-4 המלצות קצרות ומעשיות לשיפור העסק. כל המלצה בשורה נפרדת עם ✨ בהתחלה. בעברית בלבד.`
    });
    setAiTips(typeof tip === 'string' ? tip : tip?.content || '');
    setLoadingAi(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div dir="rtl" className="rounded-3xl p-4 sm:p-6 lg:p-8" style={{ background: 'radial-gradient(120% 90% at 100% 0%, #F7F1E8 0%, #F3E9DA 45%, #EFE3D2 100%)', boxShadow: '0 10px 40px rgba(120,90,50,0.08)' }}>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black mb-1" style={{ color: '#1A1A1A' }}>דשבורד</h1>
          <p className="text-sm" style={{ color: '#8A7A66' }}>
            {new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <CalendarSyncCard />
      </div>

      {dashboardActions.length > 0 && (
        <div className="mb-6 rounded-2xl p-5" style={{ background: 'rgba(249,115,22,0.05)', border: '1.5px solid rgba(249,115,22,0.3)' }}>
          <h3 className="font-black text-sm mb-3 flex items-center gap-2" style={{ color: '#EA580C' }}>
            <AlertTriangle size={15} /> פעולות שדורשות טיפול ({dashboardActions.length})
          </h3>
          <div className="space-y-2">
            {dashboardActions.map(a => (
              <div key={a.id + a.type} className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(249,115,22,0.22)' }}>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: '#fff' }}>{a.title}</p>
                  <p className="text-xs truncate" style={{ color: '#A8A29E' }}>{a.sub}</p>
                </div>
                <button onClick={() => onAction?.(a.type, a.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap flex-shrink-0 hover:opacity-90 transition-all" style={{ background: 'linear-gradient(135deg,#FB923C,#F97316)', color: '#fff' }}>
                  טפל עכשיו <ArrowLeft size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-6">
        <StatCube type="checkin"  label="צ'קאין היום"  value={checkinsToday.length}    onClick={() => setActiveStat('checkin')} />
        <StatCube type="checkout" label="צ'קאאוט היום" value={checkoutsToday.length}   onClick={() => setActiveStat('checkout')} />
        <StatCube type="staying"  label="אורחים כרגע"  value={currentlyStaying.length}  onClick={() => setActiveStat('staying')} />
        <StatCube type="revenue"  label="הכנסה חזויה"  value={`₪${monthRevenue.toLocaleString()}`} onClick={() => setActiveStat('revenue')} />
      </div>

      {/* Secondary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-6">
        <StatCube type="month"     label="הזמנות החודש"            value={monthBookings.length}    onClick={() => setActiveStat('month')} />
        <StatCube type="pending"   label="ממתינות לאישור"           value={pendingCount}            onClick={() => setActiveStat('pending')} />
        <StatCube type="available" label="לילות פנויים (חודש קדימה)" value={totalAvailableNights}   onClick={() => setActiveStat('available')} />
        <StatCube type="questions" label="שאלות לקוחות"             value={pendingQuestions.length} sub={pendingQuestions.length > 0 ? 'ממתינות למענה' : null} onClick={() => setActiveStat('questions')} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <button
          onClick={() => onNavigate?.('assistant')}
          className="rounded-2xl p-5 text-right flex items-center gap-4 transition-all hover:shadow-xl hover:-translate-y-0.5 group"
          style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.10) 0%, rgba(249,115,22,0.03) 100%)', border: '1.5px solid rgba(249,115,22,0.22)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.14)' }}>
            <Bot size={20} style={{ color: '#F97316' }} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm" style={{ color: '#1A1A1A' }}>עוזר ניהול AI</div>
            <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>שאל שאלות על הלוח שנה, הכנסות ועוד</div>
          </div>
          <ArrowLeft size={16} style={{ color: '#9CA3AF' }} />
        </button>
        <button
          onClick={() => onNavigate?.('booking_creator')}
          className="rounded-2xl p-5 text-right flex items-center gap-4 transition-all hover:shadow-xl hover:-translate-y-0.5 group"
          style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.1)' }}>
            <Plus size={20} style={{ color: '#F97316' }} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm" style={{ color: '#1A1A1A' }}>הוסף הזמנה בטקסט</div>
            <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>הכנס הזמנה בשפה חופשית</div>
          </div>
          <ArrowLeft size={16} style={{ color: '#9CA3AF' }} />
        </button>
      </div>

      {/* Today's detail */}
      {(checkinsToday.length > 0 || checkoutsToday.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {checkinsToday.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8', borderRight: '3px solid #22C55E' }}>
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#16A34A' }}>
                <LogIn size={15} /> כניסות היום
              </h3>
              <div className="space-y-2">
                {checkinsToday.map(b => (
                  <div key={b.id} className="text-sm flex justify-between">
                    <span style={{ color: '#1A1A1A' }}>{b.guest_name}</span>
                    <span style={{ color: '#9CA3AF' }}>{b.zimmer_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {checkoutsToday.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8', borderRight: '3px solid #F97316' }}>
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#EA580C' }}>
                <LogOut size={15} /> יציאות היום
              </h3>
              <div className="space-y-2">
                {checkoutsToday.map(b => (
                  <div key={b.id} className="text-sm flex justify-between">
                    <span style={{ color: '#1A1A1A' }}>{b.guest_name}</span>
                    <span style={{ color: '#9CA3AF' }}>{b.zimmer_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Tips */}
      <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2 text-sm" style={{ color: '#1A1A1A' }}>
            <Sparkles size={16} style={{ color: '#F59E0B' }} /> המלצות AI לעסק שלך
          </h3>
          <button onClick={getAiTips} disabled={loadingAi}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
            <RefreshCw size={12} className={loadingAi ? 'animate-spin' : ''} />
            {aiTips ? 'רענן' : 'קבל המלצות'}
          </button>
        </div>
        {loadingAi && (
          <div className="flex items-center gap-3 text-sm" style={{ color: '#9CA3AF' }}>
            <div className="w-4 h-4 border-2 border-orange-200 border-t-orange-400 rounded-full animate-spin"></div>
            מנתח את הנתונים שלך...
          </div>
        )}
        {aiTips && !loadingAi && (
          <div className="space-y-2">
            {aiTips.split('\n').filter(l => l.trim()).map((line, i) => (
              <p key={i} className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>{line}</p>
            ))}
          </div>
        )}
        {!aiTips && !loadingAi && (
          <p className="text-sm" style={{ color: '#9CA3AF' }}>לחץ על "קבל המלצות" לקבלת עצות AI מותאמות אישית</p>
        )}
      </div>

      <AnimatePresence>
        {activeStat && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            dir="rtl"
            onClick={() => setActiveStat(null)}
          >
            <StatDrawer
              type={activeStat}
              onClose={() => setActiveStat(null)}
              checkinsToday={checkinsToday}
              checkoutsToday={checkoutsToday}
              monthBookings={monthBookings}
              currentlyStaying={currentlyStaying}
              pendingApprovals={pendingApprovals}
              pendingQuestions={pendingQuestions}
              availabilityData={availabilityData}
              horizonDays={horizonDays}
              zimmers={zimmers}
              monthRevenue={monthRevenue}
              thisMonth={thisMonth}
              onAction={onAction}
              onNavigate={onNavigate}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <FloatingPendingWidget ownerId={ownerId} onAction={onAction} />
    </div>
  );
}

function StatDrawer({ type, onClose, checkinsToday, checkoutsToday, monthBookings, currentlyStaying, pendingApprovals, pendingQuestions, availabilityData, horizonDays, zimmers, monthRevenue, thisMonth, onAction, onNavigate }) {
  const theme = CARD_THEME[type] || {};
  const config = {
    checkin: { title: "צ'קאין היום", accent: '#22C55E', items: checkinsToday },
    checkout: { title: "צ'קאאוט היום", accent: '#F97316', items: checkoutsToday },
    revenue: { title: `הכנסות ${thisMonth}`, accent: '#F97316', items: monthBookings, isRevenue: true },
    staying: { title: 'אורחים כרגע', accent: '#3B82F6', items: currentlyStaying },
    month: { title: `הזמנות ${thisMonth}`, accent: '#F97316', items: monthBookings },
    pending: { title: 'ממתינות לאישור', accent: '#F59E0B', items: pendingApprovals },
    available: { title: `לילות פנויות · ${horizonDays} ימים קדימה`, accent: '#22C55E', items: availabilityData, isAvailable: true },
    questions: { title: 'שאלות לקוחות', accent: '#F97316', items: pendingQuestions, isQuestions: true },
  }[type];

  return (
    <motion.div
      key="card"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: 'top center' }}
      onClick={e => e.stopPropagation()}
      className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
    >
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${theme.image}")`, opacity: 0.07 }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(20,18,16,0.94) 0%, rgba(15,13,12,0.97) 100%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 0 1.5px ${config.accent}59` }} />

      <div className="relative z-10 max-h-[70vh] overflow-y-auto" style={{ fontFamily: 'Heebo, sans-serif' }}>
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ background: 'rgba(15,12,11,0.72)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${config.accent}33` }}>
          <h3 className="font-black text-lg flex items-center gap-2" style={{ color: config.accent }}>{config.title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.06)', color: '#fff' }}><X size={16} /></button>
        </div>
        <div className="p-6">
          {config.isRevenue && (
            <div className="mb-4 rounded-xl p-4 flex items-center justify-between" style={{ background: 'rgba(249,115,22,0.10)', border: `1.5px solid ${config.accent}40` }}>
              <span className="text-sm font-medium" style={{ color: '#D6D3D1' }}>סך הכנסה חזויה</span>
              <span className="text-2xl font-black" style={{ color: config.accent }}>{formatILS(monthRevenue)}</span>
            </div>
          )}
          {config.isAvailable ? (
            (config.items || []).length === 0 ? (
              <Empty text="אין צימרים להצגה" />
            ) : (
              <div className="space-y-2">
                {config.items.map(a => (
                  <div key={a.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${config.accent}33` }}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-sm truncate" style={{ color: '#fff' }}>{a.name}</p>
                      <div className="text-left flex-shrink-0 flex items-baseline gap-1">
                        <span className="text-lg font-black" style={{ color: '#86EFAC' }}>{a.available_nights}</span>
                        <span className="text-xs" style={{ color: '#A8A29E' }}>/{horizonDays} לילות</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.10)' }}>
                      <div style={{ width: `${horizonDays > 0 ? (a.available_nights / horizonDays) * 100 : 0}%`, background: config.accent, height: '100%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : config.isQuestions ? (
            (config.items || []).length === 0 ? (
              <Empty text="אין שאלות ממתינות" />
            ) : (
              <div className="space-y-2">
                {config.items.map(q => (
                  <div key={q.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${config.accent}33` }}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-bold" style={{ color: config.accent }}>{q.zimmer_name}</p>
                      {q.customer_name && <span className="text-xs" style={{ color: '#A8A29E' }}>{q.customer_name}</span>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#EDE9E3' }}>{q.question}</p>
                    <button onClick={() => { onAction?.('answer_question', q.id); onClose(); }} className="mt-2 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity" style={{ background: config.accent, color: '#fff' }}>
                      טפל עכשיו <ArrowLeft size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : config.items.length === 0 ? (
            <Empty text="אין נתונים להצגה" />
          ) : (
            <div className="space-y-2">
              {config.items.map(b => {
                const total = getBookingTotal(b, zimmers.find(z => z.id === b.zimmer_id));
                const nights = calcNights(b.check_in, b.check_out);
                return (
                  <div key={b.id} className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${config.accent}33` }}>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#fff' }}>{b.guest_name}</p>
                      <p className="text-xs truncate" style={{ color: '#A8A29E' }}>{b.zimmer_name} · 📞 {b.guest_phone}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#A8A29E' }}>📅 {b.check_in} → {b.check_out}{nights > 0 ? ` · ${nights} לילות` : ''}</p>
                    </div>
                    {config.isRevenue && total > 0 && (
                      <div className="text-left flex-shrink-0 mr-3">
                        <div className="font-black text-base" style={{ color: '#86EFAC' }}>{formatILS(total)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {type === 'pending' && (
            <button
              onClick={() => { onClose(); onNavigate?.('bookings'); }}
              className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
              style={{ background: config.accent, color: '#fff' }}
            >
              פתח ברשימת ההזמנות <ArrowLeft size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Empty({ text }) {
  return (
    <div className="text-center py-12">
      <p className="text-sm" style={{ color: '#A8A29E' }}>{text}</p>
    </div>
  );
}

function StatCube({ type, label, value, sub, onClick }) {
  const { image, icon: Icon, accent } = CARD_THEME[type] || {};
  const interactive = !!onClick;
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl w-full text-right will-change-transform transition-all duration-300 ${interactive ? 'cursor-pointer hover:shadow-2xl hover:-translate-y-1.5 hover:[transform:perspective(900px)_rotateX(5deg)_rotateY(-3deg)_translateY(-6px)]' : ''}`}
      style={{ height: '116px', border: `1.5px solid ${accent}40` }}
    >
      <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110" style={{ backgroundImage: `url("${image}")` }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(150deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.72) 100%)' }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ boxShadow: `inset 0 0 0 1.5px ${accent}, inset 0 0 30px ${accent}66` }} />
      <div className="relative z-10 h-full p-4 flex flex-col justify-between min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-white/90 truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{label}</span>
          {Icon && <span className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0" style={{ background: `${accent}4d` }}><Icon size={14} className="text-white" /></span>}
        </div>
        <div className="min-w-0">
          <div className="text-xl sm:text-2xl font-black text-white leading-none truncate" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>{value}</div>
          {sub && <div className="text-[10px] mt-1 font-semibold text-white/85 truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{sub}</div>}
        </div>
      </div>
    </Tag>
  );
}