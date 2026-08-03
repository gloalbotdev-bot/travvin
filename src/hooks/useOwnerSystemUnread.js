import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// Per-message read tracking for owner system messages.
// A message stays "unread" until the owner opens the system sub-tab.
// Robust against timestamp poisoning that the old lastSeen approach suffered from.
const READ_KEY = 'zb_read_sysmsgs_owner';

const loadReadSet = () => {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); }
  catch { return new Set(); }
};
const saveReadSet = (s) => { try { localStorage.setItem(READ_KEY, JSON.stringify([...s])); } catch {} };

export function useOwnerSystemUnread(userId) {
  const [messages, setMessages] = useState([]);
  const [readSet, setReadSet] = useState(() => loadReadSet());

  const load = useCallback(async () => {
    try {
      const msgs = await base44.entities.SystemMessage.filter({ audience: 'owner' }, '-created_date', 50);
      const mine = (msgs || []).filter(m =>
        !m.target_user_ids?.length || (m.target_user_ids || []).includes(userId)
      );
      setMessages(mine);
    } catch { /* silent */ }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = base44.entities.SystemMessage.subscribe(() => { load(); });
    return unsub;
  }, [load]);

  const count = messages.filter(m => !readSet.has(m.id)).length;

  const markAllRead = useCallback(() => {
    // Replace read-set with current message ids (drops stale ids, bounds size).
    const next = new Set(messages.map(m => m.id));
    setReadSet(next);
    saveReadSet(next);
  }, [messages]);

  return { messages, count, markAllRead, refresh: load };
}