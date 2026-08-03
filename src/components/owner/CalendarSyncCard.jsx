import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, CheckCircle2, AlertCircle, CloudOff, ChevronDown, Settings2, Zap } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

export default function CalendarSyncCard() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.SyncState.list() || [];
      const rec = list[0] || null;
      setState(rec);
      setAutoSync(!!rec?.auto_sync);
    } catch (e) {
      setState(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const manualSync = async () => {
    setSyncing(true);
    try {
      await base44.functions.invoke('syncGoogleCalendar', {});
      await load();
    } catch (e) {
      await load();
    }
    setSyncing(false);
  };

  const toggleAutoSync = async (next) => {
    setAutoSync(next);
    setToggling(true);
    try {
      if (state?.id) {
        await base44.entities.SyncState.update(state.id, { auto_sync: next });
      } else {
        const created = await base44.entities.SyncState.create({ auto_sync: next, last_status: 'ok' });
        setState(created);
      }
      await load();
    } catch (e) {
      setAutoSync(!next);
    }
    setToggling(false);
  };

  const now = Date.now();
  const lastSyncAt = state?.last_sync_at ? new Date(state.last_sync_at).getTime() : 0;
  const diffMin = lastSyncAt ? Math.round((now - lastSyncAt) / 60000) : null;

  let mode = 'unknown';
  if (loading) mode = 'loading';
  else if (state?.last_status === 'error') mode = 'error';
  else if (syncing) mode = 'syncing';
  else if (!state?.last_sync_at) mode = 'never';
  else if (diffMin === 0) mode = 'now';
  else if (diffMin !== null && diffMin < 60) mode = 'recent';
  else if (diffMin !== null) mode = 'old';

  const config = {
    loading: { border: 'rgba(156,163,175,0.30)', icon: RefreshCw, color: '#9CA3AF', label: 'טוען...' },
    syncing: { border: 'rgba(59,130,246,0.35)', icon: RefreshCw, color: '#3B82F6', label: 'מסנכרן...', spin: true },
    error: { border: 'rgba(239,68,68,0.40)', icon: AlertCircle, color: '#EF4444', label: 'שגיאה' },
    never: { border: 'rgba(249,115,22,0.35)', icon: CloudOff, color: '#F97316', label: 'לא מסונכרן' },
    now: { border: 'rgba(34,197,94,0.35)', icon: CheckCircle2, color: '#22C55E', label: 'סונכרן עכשיו' },
    recent: { border: 'rgba(34,197,94,0.30)', icon: CheckCircle2, color: '#16A34A', label: `לפני ${diffMin} דק׳` },
    old: { border: 'rgba(245,158,11,0.35)', icon: RefreshCw, color: '#D97706', label: `לפני ${diffMin} דק׳` },
    unknown: { border: 'rgba(245,158,11,0.35)', icon: RefreshCw, color: '#D97706', label: 'סנכרן' }
  }[mode];

  const Icon = config.icon;
  const busy = loading || syncing;

  return (
    <div dir="rtl" className="inline-flex items-center gap-1.5" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <div
        className="inline-flex items-center gap-2 rounded-full ps-3 pe-1.5 py-1.5 transition-all"
        style={{ background: '#fff', border: `1.5px solid ${config.border}` }}
        title="סנכרון יומן"
      >
        <Icon size={14} style={{ color: config.color }} className={config.spin || busy ? 'animate-spin' : ''} />
        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: config.color }}>{config.label}</span>
        {autoSync && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>
            <Zap size={9} /> אוטומטי
          </span>
        )}
        <button
          onClick={manualSync}
          disabled={busy}
          className="flex items-center justify-center w-6 h-6 rounded-full transition-all disabled:opacity-50 hover:opacity-80"
          style={{ background: config.color }}
          title="סנכרן כעת"
        >
          <RefreshCw size={11} className="text-white" />
        </button>

        {/* Settings arrow → popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="flex items-center justify-center w-6 h-6 rounded-full transition-all hover:bg-gray-100"
              style={{ color: '#6B7280' }}
              title="הגדרות סנכרון"
            >
              <ChevronDown size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-72 p-0" style={{ borderRadius: 16, border: '1.5px solid #F0EEE8', boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                  <Settings2 size={15} style={{ color: '#3B82F6' }} />
                </div>
                <div>
                  <p className="font-black text-sm" style={{ color: '#1A1A1A' }}>הגדרות סנכרון</p>
                  <p className="text-[11px]" style={{ color: '#9CA3AF' }}>יומן Google</p>
                </div>
              </div>

              <div className="rounded-xl p-3" style={{ background: '#F8F7F4' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold" style={{ color: '#1A1A1A' }}>סנכרון אוטומטי</p>
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#6B7280' }}>
                      כשמופעל, המערכת תסנכרן את היומן אוטומטית כל 30 דקות.
                    </p>
                  </div>
                  <Switch
                    checked={autoSync}
                    onCheckedChange={toggleAutoSync}
                    disabled={toggling}
                  />
                </div>
              </div>

              {autoSync && (
                <div className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: '#16A34A' }}>
                  <Zap size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>הסנכרון האוטומטי פעיל — היומן מתעדכן לבד, כולל הזמנות שנוספו או השתנו.</span>
                </div>
              )}
              {!autoSync && (
                <p className="mt-2.5 text-[11px] leading-snug" style={{ color: '#9CA3AF' }}>
                  ללא סנכרון אוטומטי — יש ללחוץ על כפתור הרענון ידנית, או שהסנכרון החי יפעל ממקרה Google.
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}