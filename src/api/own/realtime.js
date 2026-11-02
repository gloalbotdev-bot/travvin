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
 * @typedef {{
 *   callbacks: Set<Function>,
 *   listFn: (sort?: string, limit?: number) => Promise<object[]>,
 *   snapshot: Map<string, string>,
 *   timer: ReturnType<typeof setInterval>|null,
 *   polling: boolean,
 * }} PollPool
 */

/** @type {Map<string, PollPool>} */
const pollPools = new Map();

/**
 * @param {string} entityName
 * @param {(sort?: string, limit?: number) => Promise<object[]>} listFn
 */
export function createSubscribe(entityName, listFn) {
  return function subscribe(cb) {
    if (realtimeTransport === 'sse') {
      return subscribeSse(entityName, cb);
    }
    return subscribePolling(entityName, listFn, cb);
  };
}

/**
 * Shared poller per entity — one list request for N subscribers.
 * @param {string} entityName
 * @param {(sort?: string, limit?: number) => Promise<object[]>} listFn
 * @param {(ev: object) => void} cb
 */
function subscribePolling(entityName, listFn, cb) {
  let pool = pollPools.get(entityName);
  if (!pool) {
    pool = {
      callbacks: new Set(),
      listFn,
      snapshot: new Map(),
      timer: null,
      polling: false,
    };
    pollPools.set(entityName, pool);
    pool.timer = setInterval(() => runPoll(entityName), POLL_INTERVAL_MS);
    runPoll(entityName);
  }
  pool.callbacks.add(cb);

  return () => {
    pool.callbacks.delete(cb);
    if (pool.callbacks.size === 0) {
      if (pool.timer) clearInterval(pool.timer);
      pollPools.delete(entityName);
    }
  };
}

/**
 * @param {string} entityName
 */
async function runPoll(entityName) {
  const pool = pollPools.get(entityName);
  if (!pool || pool.polling || pool.callbacks.size === 0) return;
  pool.polling = true;
  try {
    const records = await pool.listFn('-updated_date', POLL_LIST_LIMIT);
    if (!pollPools.has(entityName)) return;
    const { events, next } = diffRecords(pool.snapshot, records);
    pool.snapshot = next;
    for (const ev of events) {
      for (const cb of [...pool.callbacks]) cb(ev);
    }
  } catch {
    /* silent — consumer hooks swallow errors too */
  } finally {
    if (pool) pool.polling = false;
  }
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
