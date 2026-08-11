/**
 * Own-backend entity realtime — polling or SSE (VITE_REALTIME_TRANSPORT).
 * Matches Base44 subscribe callback shape: { type, id, data? }.
 */
import { getApiBase, getStoredToken } from './http.js';

const POLL_INTERVAL_MS = 3000;
const POLL_LIST_LIMIT = 100;
const SSE_RECONNECT_MS = 5000;

export const realtimeTransport =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REALTIME_TRANSPORT) ||
  'polling';

/** @type {Map<string, { callbacks: Set<Function>, es: EventSource|null, reconnectTimer: ReturnType<typeof setTimeout>|null }>} */
const ssePools = new Map();

/**
 * @param {string} entityName
 * @param {(sort?: string, limit?: number) => Promise<object[]>} listFn
 */
export function createSubscribe(entityName, listFn) {
  return function subscribe(cb) {
    if (realtimeTransport === 'sse') {
      return subscribeSse(entityName, cb);
    }
    return subscribePolling(listFn, cb);
  };
}

/**
 * @param {(sort?: string, limit?: number) => Promise<object[]>} listFn
 * @param {(ev: object) => void} cb
 */
function subscribePolling(listFn, cb) {
  /** @type {Map<string, string>} */
  let snapshot = new Map();
  let timer = null;
  let cancelled = false;

  const poll = async () => {
    if (cancelled) return;
    try {
      const records = await listFn('-updated_date', POLL_LIST_LIMIT);
      const { events, next } = diffRecords(snapshot, records);
      snapshot = next;
      for (const ev of events) {
        if (!cancelled) cb(ev);
      }
    } catch {
      /* silent — consumer hooks swallow errors too */
    }
  };

  poll();
  timer = setInterval(poll, POLL_INTERVAL_MS);

  return () => {
    cancelled = true;
    if (timer) clearInterval(timer);
  };
}

/**
 * @param {string} entityName
 * @param {(ev: object) => void} cb
 */
function subscribeSse(entityName, cb) {
  let pool = ssePools.get(entityName);
  if (!pool) {
    pool = { callbacks: new Set(), es: null, reconnectTimer: null };
    ssePools.set(entityName, pool);
    openSse(entityName, pool);
  }
  pool.callbacks.add(cb);

  return () => {
    pool.callbacks.delete(cb);
    if (pool.callbacks.size === 0) {
      if (pool.reconnectTimer) clearTimeout(pool.reconnectTimer);
      pool.es?.close();
      ssePools.delete(entityName);
    }
  };
}

/**
 * @param {string} entityName
 * @param {{ callbacks: Set<Function>, es: EventSource|null, reconnectTimer: ReturnType<typeof setTimeout>|null }} pool
 */
function openSse(entityName, pool) {
  const token = getStoredToken();
  const qs = token ? `?token=${encodeURIComponent(token)}` : '';
  const url = `${getApiBase()}/api/events/entities/${encodeURIComponent(entityName)}${qs}`;
  const es = new EventSource(url);
  pool.es = es;

  es.onmessage = (msg) => {
    try {
      const ev = JSON.parse(msg.data);
      for (const cb of pool.callbacks) cb(ev);
    } catch {
      /* ignore malformed */
    }
  };

  es.onerror = () => {
    es.close();
    pool.es = null;
    if (pool.callbacks.size > 0) {
      pool.reconnectTimer = setTimeout(() => openSse(entityName, pool), SSE_RECONNECT_MS);
    }
  };
}

/**
 * @param {Map<string, string>} prev
 * @param {object[]|null|undefined} records
 */
function diffRecords(prev, records) {
  const events = [];
  const next = new Map();
  const byId = new Map();

  for (const record of records || []) {
    if (!record?.id) continue;
    byId.set(record.id, record);
    next.set(record.id, record.updated_date ?? '');
  }

  for (const [id, record] of byId) {
    if (!prev.has(id)) {
      events.push({ type: 'create', id, data: record });
    } else if (prev.get(id) !== (record.updated_date ?? '')) {
      events.push({ type: 'update', id, data: record });
    }
  }

  for (const id of prev.keys()) {
    if (!next.has(id)) {
      events.push({ type: 'delete', id });
    }
  }

  return { events, next };
}
