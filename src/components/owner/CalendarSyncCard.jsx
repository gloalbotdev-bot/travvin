import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import { getApiBase, getStoredToken } from '@/api/own/http';
import { RefreshCw, CheckCircle2, AlertCircle, CloudOff, ChevronDown, Settings2, Zap, Link2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

export default function CalendarSyncCard({ ownerId }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [calStatus, setCalStatus] = useState({ connected: false });
  const [connectError, setConnectError] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (!token) return;
      const res = await fetch(`${getApiBase()}/api/connectors/google-calendar/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCalStatus(await res.json());
    } catch {
      /* ignore when connector status unavailable */
    }
  }, []);

  const load = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const list =
        (await api.entities.SyncState.filter(
          { owner_id: ownerId, provider: 'google' },
          '-updated_date',
          5,
        )) || [];
      const rec = list[0] || null;
      setState(rec);
      setAutoSync(!!rec?.auto_sync);
    } catch (e) {
      setState(null);
    }
    setLoading(false);
  }, [ownerId]);

  useEffect(() => {
    load();
    loadStatus();
    const id = setInterval(() => {
      load();
      loadStatus();
    }, 30000);
    return () => clearInterval(id);
  }, [load, loadStatus]);

  // Surface OAuth callback result (?calendar=connected|calendar_error=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get('calendar_error');
    const ok = params.get('calendar');
    if (err) {
      setConnectError(err);
      loadStatus();
    } else if (ok === 'connected') {
      setConnectError(null);
      loadStatus();
      load();
    }
    if (err || ok) {
      params.delete('calendar_error');
      params.delete('calendar');
      const qs = params.toString();
      const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, '', next);
    }
  }, [load, loadStatus]);

  const connectCalendar = () => {
    const token = getStoredToken();
    if (!token) {
      setConnectError('not_logged_in');
      return;
    }
    setConnectError(null);
    const url = `${getApiBase()}/api/connectors/google-calendar/oauth?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent('/owner')}`;
    window.location.href = url;
  };

  const manualSync = async () => {
    setSyncing(true);
    try {
      await api.functions.invoke('syncGoogleCalendar', {});
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
        await api.entities.SyncState.update(state.id, { auto_sync: next });
      } else {
        const created = await api.entities.SyncState.create({
          owner_id: ownerId,
          provider: 'google',
          auto_sync: next,
          last_status: 'ok',
        });
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
  else if (!calStatus.connected) mode = 'disconnected';
  else if (state?.last_status === 'error') mode = 'error';
  else if (syncing) mode = 'syncing';
  else if (!state?.last_sync_at) mode = 'never';
  else if (diffMin === 0) mode = 'now';
  else if (diffMin !== null && diffMin < 60) mode = 'recent';
  else if (diffMin !== null) mode = 'old';

  const config = {
    loading: { border: 'rgba(156,163,175,0.30)', icon: RefreshCw, color: '#9CA3AF', label: 'טוען...' },
    disconnected: { border: 'rgba(249,115,22,0.35)', icon: Link2, color: '#F97316', label: 'לא מחובר' },
    syncing: { border: 'rgba(59,130,246,0.35)', icon: RefreshCw, color: '#3B82F6', label: 'מסנכרן...', spin: true },
    error: { border: 'rgba(239,68,68,0.40)', icon: AlertCircle, color: '#EF4444', label: 'שגיאה' },
    never: { border: 'rgba(249,115,22,0.35)', icon: CloudOff, color: '#F97316', label: 'לא מסונכרן' },
    now: { border: 'rgba(34,197,94,0.35)', icon: CheckCircle2, color: '#22C55E', label: 'סונכרן עכשיו' },
    recent: { border: 'rgba(34,197,94,0.30)', icon: CheckCircle2, color: '#16A34A', label: `לפני ${diffMin} דק׳` },
    old: { border: 'rgba(245,158,11,0.35)', icon: RefreshCw, color: '#D97706', label: `לפני ${diffMin} דק׳` },
    unknown: { border: 'rgba(245,158,11,0.35)', icon: RefreshCw, color: '#D97706', label: 'סנכרן' },
  }[mode];

  const Icon = config.icon;
  const busy = loading || syncing;

  return (
    <div dir="rtl" className="inline-flex flex-col items-end gap-1" style={{ fontFamily: 'Heebo, sans-serif' }}>
      {connectError && (
        <p className="text-[11px] font-semibold max-w-xs" style={{ color: '#EF4444' }} dir="rtl">
          חיבור יומן נכשל:{' '}
          {connectError === 'missing_refresh_token'
            ? 'לא התקבל refresh token מ-Google — נסי שוב ואשרי את כל ההרשאות'
            : connectError === 'db_schema_missing'
              ? 'חסרה טבלת יומן ב-DB — הרץ בשרת: npm run db:apply-calendar'
              : connectError === 'db_unreachable'
                ? 'אין גישה למסד הנתונים כרגע — נסי שוב בעוד רגע'
                : connectError === 'owner_not_found'
                  ? 'המשתמש לא נמצא ב-DB — התחברי מחדש לאפליקציה'
                  : connectError === 'save_failed'
                    ? 'שמירת החיבור נכשלה — נסי שוב'
                    : connectError}
        </p>
      )}
      <div
        className="inline-flex items-center gap-2 rounded-full ps-3 pe-1.5 py-1.5 transition-all"
        style={{ background: '#fff', border: `1.5px solid ${config.border}` }}
        title="סנכרון יומן"
      >
        <Icon size={14} style={{ color: config.color }} className={config.spin || busy ? 'animate-spin' : ''} />
        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: config.color }}>{config.label}</span>
        {autoSync && calStatus.connected && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>
            <Zap size={9} /> אוטומטי
          </span>
        )}
        {calStatus.connected ? (
          <button
            onClick={manualSync}
            disabled={busy}
            className="flex items-center justify-center w-6 h-6 rounded-full transition-all disabled:opacity-50 hover:opacity-80"
            style={{ background: config.color }}
            title="סנכרן כעת"
          >
            <RefreshCw size={11} className="text-white" />
          </button>
        ) : (
          <button
            onClick={connectCalendar}
            className="flex items-center justify-center w-6 h-6 rounded-full transition-all hover:opacity-80"
            style={{ background: config.color }}
            title="חבר Google Calendar"
          >
            <Link2 size={11} className="text-white" />
          </button>
        )}

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

              {!calStatus.connected ? (
                <button
                  type="button"
                  onClick={connectCalendar}
                  className="w-full rounded-xl py-2.5 text-sm font-bold text-white mb-2"
                  style={{ background: '#F97316' }}
                >
                  חבר Google Calendar
                </button>
              ) : (
                <p className="text-[11px] mb-2" style={{ color: '#6B7280' }}>
                  מחובר{calStatus.account_email ? ` כ־${calStatus.account_email}` : ''}
                </p>
              )}

              <div className="rounded-xl p-3" style={{ background: '#F8F7F4' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold" style={{ color: '#1A1A1A' }}>סנכרון אוטומטי</p>
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#6B7280' }}>
                      כשמופעל, המערכת תסנכרן את היומן שלך אוטומטית כל 30 דקות.
                    </p>
                  </div>
                  <Switch
                    checked={autoSync}
                    onCheckedChange={toggleAutoSync}
                    disabled={toggling || !calStatus.connected}
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
