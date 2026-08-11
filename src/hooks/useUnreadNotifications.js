import { useState, useEffect, useCallback } from 'react';
import { api } from '@/api/client';

const KEY_FOR = (audience) => `zb_lastSeen_notif_${audience}`;

export function useUnreadNotifications(audience, userId) {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!audience) return;
    try {
      const msgs = await api.entities.SystemMessage.filter({ audience }, '-created_date', 30);
      const mine = (msgs || []).filter(m =>
        !m.target_user_ids?.length || (m.target_user_ids || []).includes(userId)
      );
      const lastSeen = localStorage.getItem(KEY_FOR(audience)) || '1970-01-01T00:00:00.000Z';
      const n = mine.filter(m => new Date(m.created_date) > new Date(lastSeen)).length;
      setCount(n);
    } catch (e) { /* silent */ }
  }, [audience, userId]);

  useEffect(() => { load(); }, [load]);

  // Live updates: re-count when a system message is created/updated (e.g. owner answered a question)
  useEffect(() => {
    if (!audience) return;
    const unsub = api.entities.SystemMessage.subscribe(() => { load(); });
    return unsub;
  }, [audience, load]);

  const markRead = useCallback(() => {
    localStorage.setItem(KEY_FOR(audience), new Date().toISOString());
    setCount(0);
  }, [audience]);

  return { count, markRead, refresh: load };
}