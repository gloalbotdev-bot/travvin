import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { UserPlus, RefreshCw } from 'lucide-react';

const ROLE_HE = { user: 'לקוח', owner: 'בעל מתחם' };

export default function RoleAccessRequestsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const list = await api.roleAccessRequests.list('pending');
      setRows(Array.isArray(list) ? list : []);
    } catch (err) {
      setMsg(err?.message || 'טעינה נכשלה');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id, decision) => {
    setBusyId(id);
    setMsg('');
    try {
      await api.roleAccessRequests.decide(id, decision);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setMsg(
        decision === 'switch'
          ? 'התפקיד הוחלף'
          : decision === 'both'
            ? 'אושרו שני תפקידים'
            : 'הבקשה נדחתה',
      );
    } catch (err) {
      setMsg(err?.message || 'הפעולה נכשלה');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4" dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserPlus size={20} style={{ color: '#F97316' }} />
          <h2 className="text-lg font-black" style={{ color: '#1A1A1A' }}>
            בקשות תפקיד
          </h2>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
          style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#6B7280' }}
        >
          <RefreshCw size={14} />
          רענון
        </button>
      </div>

      <p className="text-sm" style={{ color: '#9CA3AF' }}>
        משתמשים שביקשו גישה לתפקיד נוסף. אפשר להחליף תפקיד, לאפשר כניסה לשני התפקידים, או לדחות.
      </p>

      {msg && (
        <p className="text-sm font-semibold" style={{ color: '#6B7280' }}>
          {msg}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center text-sm"
          style={{ background: '#fff', border: '1.5px solid #F0EEE8', color: '#9CA3AF' }}
        >
          אין בקשות ממתינות
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl p-4"
              style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="font-bold text-sm" style={{ color: '#1A1A1A' }}>
                    {r.user_email}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                    {ROLE_HE[r.from_role] || r.from_role}
                    {' → '}
                    {ROLE_HE[r.to_role] || r.to_role}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, 'switch')}
                    className="rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                    style={{ background: '#F97316' }}
                  >
                    החלף תפקיד
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, 'both')}
                    className="rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                    style={{ background: '#1A1A1A' }}
                  >
                    אפשר שני תפקידים
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, 'reject')}
                    className="rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
                    style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}
                  >
                    דחה
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
