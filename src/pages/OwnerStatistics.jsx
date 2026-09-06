import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import StatisticsCard from '@/components/owner/StatisticsCard';
import { Bot, MessageSquare, Truck, Clock, Loader2 } from 'lucide-react';

function formatTimeSaved(minutes) {
  if (minutes < 60) return `${minutes}`;
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}` : `${hours.toFixed(1)}`;
}
function timeUnitLabel(minutes) {
  return minutes < 60 ? 'דקות' : 'שעות';
}

export default function OwnerStatistics({ ownerId, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.functions.invoke('getOwnerStatistics', {});
        if (alive) setStats(res.data || res);
      } catch {
        if (alive) setStats(null);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [ownerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" dir="rtl">
        <Loader2 size={26} className="animate-spin" style={{ color: '#9CA3AF' }} />
      </div>
    );
  }

  const s = stats || {};
  const pct = s.autoSolvePct;
  const pctText = pct == null ? '—' : `${pct}%`;
  const aiSubtitle = s.totalSessions > 0
    ? `${pctText} פתרון אוטומטי · ${s.totalSessions} שיחות סה"כ`
    : 'אין שיחות עדיין';

  const guestSubtitle = s.guestStatus
    ? `נשלחו ${s.guestStatus.sent} · נכשלו ${s.guestStatus.failed} · ממתינות ${s.guestStatus.pending}`
    : 'אין הודעות עדיין';

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>סטטיסטיקות</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>מדדי יעילות ה-AI והתקשורת שלך עם לקוחות וספקים</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
        <StatisticsCard
          icon={Bot}
          value={s.aiHandled ?? 0}
          label="שאלות שה-AI טיפל בהן"
          subtitle={aiSubtitle}
          accent="green"
          onClick={() => onNavigate?.('updates')}
        />
        <StatisticsCard
          icon={MessageSquare}
          value={s.guestMessages ?? 0}
          label="תשובות שנשלחו ללקוחות"
          subtitle={guestSubtitle}
          accent="orange"
          onClick={() => onNavigate?.('updates')}
        />
        <StatisticsCard
          icon={Truck}
          value={s.supplierMessages ?? 0}
          label="הודעות לספקים"
          subtitle={s.supplierMessages ? 'הודעות B2B שנשלחו' : 'אין הודעות עדיין'}
          accent="purple"
          onClick={() => onNavigate?.('contacts')}
        />
        <StatisticsCard
          icon={Clock}
          value={formatTimeSaved(s.timeSavedMinutes ?? 30)}
          label={`חסכת זמן · ${timeUnitLabel(s.timeSavedMinutes ?? 30)}`}
          subtitle="זמן שה-AI חסך לך בטיפול אוטומטי בשאלות"
          accent="gold"
          highlighted
        />
      </div>
    </div>
  );
}