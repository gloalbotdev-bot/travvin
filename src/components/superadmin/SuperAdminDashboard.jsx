import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Home, Users, ClipboardList, Wallet, Star, Tag, AlertTriangle, Clock, CheckCircle, XCircle, MessageSquare, TrendingUp, Calendar, LayoutDashboard, Bell, Phone } from 'lucide-react';
import FloatingQuestionsWidget from '@/components/superadmin/FloatingQuestionsWidget';

const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

const STATUS_COLORS = { 'ממתינה': '#D97706', 'אושרה': '#16A34A', 'נדחתה': '#EF4444' };
const MONTHLY_COLOR = '#F97316';

export default function SuperAdminDashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [zimmers, bookings, users, reviews, promos, sessions, questions] = await Promise.all([
        api.entities.Zimmer.list(),
        api.entities.BookingRequest.list('-created_date', 500),
        api.entities.User.list(),
        api.entities.Review.list('-created_date', 200),
        api.entities.Promotion.list(),
        api.entities.ChatSession.list('-created_date', 200),
        api.entities.UnansweredQuestion.list('-created_date', 100),
      ]);

      // Zimmers
      const approvedZimmers = zimmers.filter(z => z.approval_status === 'אושר');
      const pendingZimmers = zimmers.filter(z => z.approval_status === 'ממתין לאישור');
      const rejectedZimmers = zimmers.filter(z => z.approval_status === 'נדחתה');

      // Users
      const owners = users.filter(u => u.role === 'owner' || u.role === 'admin');
      const customers = users.filter(u => u.role === 'user' || (!u.role));

      // Bookings
      const byStatus = {
        'ממתינה': bookings.filter(b => b.status === 'ממתינה').length,
        'אושרה': bookings.filter(b => b.status === 'אושרה').length,
        'נדחתה': bookings.filter(b => b.status === 'נדחתה').length,
      };
      const deletionReq = bookings.filter(b => b.deletion_request_reason);
      const cancelReq = bookings.filter(b => b.cancel_request_reason);
      const revenue = bookings.filter(b => b.status === 'אושרה').reduce((s, b) => s + (b.total_price || 0), 0);

      // Monthly bookings (last 6 months)
      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: HEB_MONTHS[d.getMonth()], count: 0, revenue: 0 });
      }
      bookings.forEach(b => {
        const d = new Date(b.created_date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const m = months.find(x => x.key === key);
        if (m) { m.count++; if (b.status === 'אושרה' && b.total_price) m.revenue += b.total_price; }
      });

      // Top zimmers by bookings
      const counts = {};
      bookings.forEach(b => { if (b.zimmer_id) counts[b.zimmer_id] = (counts[b.zimmer_id] || 0) + 1; });
      const topZimmers = Object.entries(counts)
        .map(([id, c]) => ({ zimmer: zimmers.find(z => z.id === id), count: c }))
        .filter(x => x.zimmer)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Reviews
      const avgRating = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) : 0;
      const activePromos = promos.filter(p => p.status === 'פעיל');
      const openQuestions = questions.filter(q => q.status === 'ממתינה');

      setData({
        zimmers, bookings, users, reviews,
        approvedZimmers, pendingZimmers, rejectedZimmers,
        owners, customers,
        byStatus, deletionReq, cancelReq, revenue,
        months, topZimmers,
        avgRating, activePromos, openQuestions,
        recentBookings: bookings.slice(0, 6),
        recentReviews: reviews.slice(0, 4),
        sessionsCount: sessions.length,
      });
    } catch (e) {
      console.error('Dashboard load error:', e);
    }
    setLoading(false);
  };

  if (loading || !data) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  const { zimmers, bookings, byStatus, deletionReq, cancelReq, revenue, months, topZimmers, avgRating, activePromos, openQuestions, owners, customers, approvedZimmers, pendingZimmers, recentBookings, recentReviews, sessionsCount } = data;

  const alerts = [
    ...(deletionReq.length ? [{ type: 'delete', label: 'בקשות מחיקה מבעלי צימרים', count: deletionReq.length, color: '#EF4444', icon: AlertTriangle, link: '/superadmin' }] : []),
    ...(cancelReq.length ? [{ type: 'cancel', label: 'בקשות ביטול מלקוחות', count: cancelReq.length, color: '#D97706', icon: AlertTriangle }] : []),
    ...(pendingZimmers.length ? [{ type: 'pending', label: 'צימרים ממתינים לאישור', count: pendingZimmers.length, color: '#3B82F6', icon: Clock }] : []),
    ...(openQuestions.length ? [{ type: 'questions', label: 'שאלות לקוחות פתוחות', count: openQuestions.length, color: '#8B5CF6', icon: MessageSquare }] : []),
  ];

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#1A1A1A' }}>
          <LayoutDashboard size={20} style={{ color: '#F97316' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>דאשבורד כללי</h1>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>סקירת כלל הפעילות במערכת — צימרים, לקוחות, הזמנות והכנסות</p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          {alerts.map((a, i) => (
            <div key={i} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#fff', border: `1.5px solid ${a.color}33` }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${a.color}1a` }}>
                <a.icon size={16} style={{ color: a.color }} />
              </div>
              <div>
                <p className="text-lg font-black" style={{ color: a.color }}>{a.count}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{a.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi icon={Home} color="#F97316" label="צימרים" value={zimmers.length} sub={`${approvedZimmers.length} אושרו · ${pendingZimmers.length} ממתינים`} />
        <Kpi icon={Users} color="#3B82F6" label="בעלי מתחמים" value={owners.length} sub={`${customers.length} לקוחות רשומים`} />
        <Kpi icon={ClipboardList} color="#16A34A" label="סה״כ הזמנות" value={bookings.length} sub={`${byStatus['אושרה']} אושרו · ${byStatus['ממתינה']} ממתינות`} />
        <Kpi icon={Wallet} color="#8B5CF6" label="הכנסה מאושרת" value={`₪${revenue.toLocaleString()}`} sub="מהזמנות שאושרו" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Monthly bookings chart */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
            <TrendingUp size={16} style={{ color: '#F97316' }} /> הזמנות לפי חודש (6 חודשים אחרונים)
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={months} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #F0EEE8', fontFamily: 'Heebo', fontSize: 12 }} />
              <Bar dataKey="count" name="הזמנות" fill={MONTHLY_COLOR} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status pie */}
        <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
            <ClipboardList size={16} style={{ color: '#F97316' }} /> הזמנות לפי סטטוס
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={Object.entries(byStatus).map(([k, v]) => ({ name: k, value: v }))} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                {Object.entries(byStatus).map(([k]) => <Cell key={k} fill={STATUS_COLORS[k]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #F0EEE8', fontFamily: 'Heebo', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2 flex-wrap">
            {Object.entries(byStatus).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[k] }}></span>
                {k} ({v})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MiniStat icon={Star} color="#F59E0B" label="דירוג ממוצע" value={avgRating ? avgRating.toFixed(1) : '—'} sub={`${recentReviews.length} ביקורות אחרונות`} />
        <MiniStat icon={Tag} color="#EF4444" label="מבצעים פעילים" value={activePromos.length} sub="להצגה ללקוחות" />
        <MiniStat icon={MessageSquare} color="#8B5CF6" label="שיחות AI" value={sessionsCount} sub="סה״כ שיחות חיפוש" onClick={onNavigate ? () => onNavigate('chat_history') : undefined} />
        <MiniStat icon={AlertTriangle} color="#D97706" label="בקשות מחיקה/ביטול" value={deletionReq.length + cancelReq.length} sub={`${deletionReq.length} מחיקה · ${cancelReq.length} ביטול`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top zimmers */}
        <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
            <Home size={16} style={{ color: '#F97316' }} /> צימרים מובילים לפי הזמנות
          </h2>
          {topZimmers.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#9CA3AF' }}>אין הזמנות עדיין</p>
          ) : (
            <div className="space-y-2.5">
              {topZimmers.map(({ zimmer, count }, i) => (
                <div key={zimmer.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: i === 0 ? '#FEF3C7' : '#F8F7F4', color: i === 0 ? '#D97706' : '#6B7280' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{zimmer.name}</p>
                    <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{zimmer.location || '—'}</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>{count} הזמנות</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent bookings */}
        <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
            <Clock size={16} style={{ color: '#F97316' }} /> הזמנות אחרונות
          </h2>
          {recentBookings.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#9CA3AF' }}>אין הזמנות עדיין</p>
          ) : (
            <div className="space-y-2.5">
              {recentBookings.map(b => (
                <div key={b.id} className="flex items-center gap-3 py-1.5" style={{ borderBottom: '1px solid #F8F7F4' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{b.guest_name} <span className="font-normal" style={{ color: '#9CA3AF' }}>← {b.zimmer_name}</span></p>
                    <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: '#9CA3AF' }}>
                      <Calendar size={11} /> {b.check_in} → {b.check_out}
                      {b.guest_phone && <span className="flex items-center gap-1"><Phone size={11} /> {b.guest_phone}</span>}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0" style={{ background: `${STATUS_COLORS[b.status] || '#9CA3AF'}1a`, color: STATUS_COLORS[b.status] || '#9CA3AF' }}>{b.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent reviews */}
        <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
            <Star size={16} style={{ color: '#F97316' }} /> ביקורות אחרונות
          </h2>
          {recentReviews.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#9CA3AF' }}>אין ביקורות עדיין</p>
          ) : (
            <div className="space-y-3">
              {recentReviews.map(r => (
                <div key={r.id} className="py-2" style={{ borderBottom: '1px solid #F8F7F4' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{r.guest_name || 'אורח'} · <span style={{ color: '#9CA3AF', fontWeight: 'normal' }}>{r.zimmer_name}</span></p>
                    <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: '#D97706' }}>
                      {'★'.repeat(r.rating || 0)}<span style={{ color: '#E5E5E5' }}>{'★'.repeat(5 - (r.rating || 0))}</span>
                    </span>
                  </div>
                  {r.text && <p className="text-xs" style={{ color: '#6B7280' }}>{r.text}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity: pending + cancellation/deletion requests */}
        <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
            <Bell size={16} style={{ color: '#F97316' }} /> נדרש טיפול
          </h2>
          <div className="space-y-2.5">
            {(deletionReq.length === 0 && cancelReq.length === 0 && pendingZimmers.length === 0 && openQuestions.length === 0) ? (
              <p className="text-sm text-center py-6" style={{ color: '#9CA3AF' }}>הכל מטופל ✅</p>
            ) : (
              <>
                {deletionReq.map(b => <PendingRow key={`d${b.id}`} icon={AlertTriangle} color="#EF4444" label={`בקשת מחיקה: ${b.guest_name} — ${b.zimmer_name}`} />)}
                {cancelReq.map(b => <PendingRow key={`c${b.id}`} icon={Clock} color="#D97706" label={`בקשת ביטול: ${b.guest_name} — ${b.zimmer_name}`} />)}
                {pendingZimmers.map(z => <PendingRow key={`z${z.id}`} icon={Home} color="#3B82F6" label={`צימר ממתין לאישור: ${z.name}`} />)}
                {openQuestions.slice(0, 5).map(q => <PendingRow key={`q${q.id}`} icon={MessageSquare} color="#8B5CF6" label={`שאלה פתוחה: ${q.question?.slice(0, 50)} — ${q.zimmer_name}`} />)}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating widget to answer pending customer questions directly */}
      <FloatingQuestionsWidget />
    </div>
  );
}

function Kpi({ icon: Icon, color, label, value, sub }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}1a` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-xs" style={{ color: '#9CA3AF' }}>{label}</span>
      </div>
      <p className="text-2xl font-black" style={{ color: '#1A1A1A' }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{sub}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, color, label, value, sub, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className="rounded-2xl p-3.5 flex items-center gap-3 w-full text-right transition-all" style={{ background: '#fff', border: '1.5px solid #F0EEE8', cursor: onClick ? 'pointer' : 'default' }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}1a` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-black" style={{ color: '#1A1A1A' }}>{value}</p>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>{label}</p>
      </div>
    </Tag>
  );
}

function PendingRow({ icon: Icon, color, label }) {
  return (
    <div className="flex items-center gap-2 text-xs py-1.5" style={{ borderBottom: '1px solid #F8F7F4', color: '#4B5563' }}>
      <Icon size={14} style={{ color, flexShrink: 0 }} />
      <span className="truncate">{label}</span>
    </div>
  );
}