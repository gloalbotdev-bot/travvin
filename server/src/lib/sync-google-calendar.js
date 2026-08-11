/**
 * syncGoogleCalendar — per-owner (M8 Option B).
 * Transient retry once on timeout/5xx; writes last_sync_attempt.
 */
import { SERVICE_ACTOR } from './service-role.js';

const PROVIDER = 'google';
const BACKOFF_MS = 1500;

/**
 * @param {object} deps
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} deps.store
 * @param {ReturnType<import('./calendar-connection-store.js').createCalendarConnectionStore>} deps.connections
 * @param {typeof fetch} [deps.fetchImpl]
 */
export async function syncGoogleCalendar(
  { store, connections, fetchImpl = fetch },
  { ownerId, fromWorkflow = false },
) {
  if (!ownerId) {
    const err = new Error('owner_id required');
    err.status = 400;
    throw err;
  }

  const syncRecord = await findSyncState(store, ownerId);

  if (fromWorkflow) {
    if (!syncRecord?.auto_sync) {
      return { status: 'skipped', reason: 'auto_sync_disabled' };
    }
  }

  const now = new Date().toISOString();
  await patchSyncState(store, syncRecord, ownerId, {
    last_sync_attempt: now,
    last_status: 'syncing',
  });

  try {
    const result = await withOneTransientRetry(() =>
      runSync({ store, connections, fetchImpl, ownerId, syncRecord }),
    );
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await patchSyncState(store, syncRecord, ownerId, {
      last_status: 'error',
      last_error: msg.slice(0, 500),
      last_sync_attempt: new Date().toISOString(),
    });
    throw e;
  }
}

async function runSync({ store, connections, fetchImpl, ownerId, syncRecord }) {
  const { accessToken, calendarId } = await connections.getAccessToken(ownerId);
  const calId = calendarId || process.env.GOOGLE_CALENDAR_ID;
  if (!calId || calId === 'primary') {
    const err = new Error('Owner calendar_id missing; reconnect Google Calendar');
    err.status = 400;
    throw err;
  }

  const authHeader = { Authorization: `Bearer ${accessToken}` };
  let url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events` +
    '?maxResults=100&singleEvents=true';
  if (syncRecord?.sync_token) {
    url += `&syncToken=${encodeURIComponent(syncRecord.sync_token)}`;
  } else {
    url +=
      '&timeMin=' +
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  let res = await fetchImpl(url, { headers: authHeader });
  if (res.status === 410) {
    url =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events` +
      '?maxResults=100&singleEvents=true&timeMin=' +
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    res = await fetchImpl(url, { headers: authHeader });
  }

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(errText.slice(0, 500));
    err.status = res.status >= 500 ? 502 : res.status;
    err.transient = res.status >= 500;
    throw err;
  }

  const allItems = [];
  let pageData = await res.json();
  let newSyncToken = pageData.nextSyncToken || null;
  const baseUrl = url;
  while (true) {
    allItems.push(...(pageData.items || []));
    if (pageData.nextSyncToken) newSyncToken = pageData.nextSyncToken;
    if (!pageData.nextPageToken) break;
    const nextRes = await fetchImpl(
      baseUrl + `&pageToken=${pageData.nextPageToken}`,
      { headers: authHeader },
    );
    if (!nextRes.ok) break;
    pageData = await nextRes.json();
  }

  let updated = 0;
  for (const ev of allItems) {
    if (ev.status === 'cancelled') {
      try {
        const matches = await store.filter(
          'BookingRequest',
          { calendar_event_id: ev.id },
          undefined,
          undefined,
          SERVICE_ACTOR,
        );
        for (const b of matches) {
          if (b.owner_id !== ownerId) continue;
          await store.update(
            'BookingRequest',
            b.id,
            { calendar_event_id: null },
            SERVICE_ACTOR,
          );
          updated++;
        }
      } catch {
        /* ignore */
      }
      continue;
    }

    const startStr =
      ev.start?.date ||
      (ev.start?.dateTime ? ev.start.dateTime.slice(0, 10) : null);
    const endStr =
      ev.end?.date || (ev.end?.dateTime ? ev.end.dateTime.slice(0, 10) : null);
    if (!startStr || !endStr) continue;

    try {
      const matches = await store.filter(
        'BookingRequest',
        { calendar_event_id: ev.id },
        undefined,
        undefined,
        SERVICE_ACTOR,
      );
      for (const b of matches) {
        if (b.owner_id !== ownerId) continue;
        const updates = {};
        if (b.check_in !== startStr) updates.check_in = startStr;
        if (b.check_out !== endStr) updates.check_out = endStr;
        if (Object.keys(updates).length > 0) {
          await store.update('BookingRequest', b.id, updates, SERVICE_ACTOR);
          updated++;
        }
      }
    } catch {
      /* ignore */
    }
  }

  const doneAt = new Date().toISOString();
  const latest = await findSyncState(store, ownerId);
  await patchSyncState(store, latest, ownerId, {
    sync_token: newSyncToken || latest?.sync_token || null,
    last_sync_at: doneAt,
    last_sync_attempt: doneAt,
    last_status: 'ok',
    last_error: null,
  });

  return {
    status: 'ok',
    processed: allItems.length,
    updated,
    last_sync_at: doneAt,
  };
}

async function findSyncState(store, ownerId) {
  const list = await store.filter(
    'SyncState',
    { owner_id: ownerId, provider: PROVIDER },
    undefined,
    undefined,
    SERVICE_ACTOR,
  );
  return list[0] || null;
}

async function patchSyncState(store, existing, ownerId, patch) {
  const cleaned = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === null || v === undefined) continue;
    cleaned[k] = v;
  }
  // Clear last_error on success via empty string (schema type string, not null)
  if (Object.prototype.hasOwnProperty.call(patch, 'last_error') && patch.last_error == null) {
    cleaned.last_error = '';
  }
  if (existing?.id) {
    return store.update('SyncState', existing.id, cleaned, SERVICE_ACTOR);
  }
  return store.create(
    'SyncState',
    {
      owner_id: ownerId,
      provider: PROVIDER,
      auto_sync: false,
      last_status: 'ok',
      ...cleaned,
    },
    { actor: SERVICE_ACTOR, createdById: SERVICE_ACTOR.id, createdBy: SERVICE_ACTOR.email },
  );
}

async function withOneTransientRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    const transient =
      e?.transient === true ||
      e?.status >= 500 ||
      /timeout|ECONNRESET|ETIMEDOUT|network/i.test(e?.message || '');
    if (!transient) throw e;
    await new Promise((r) => setTimeout(r, BACKOFF_MS));
    return fn();
  }
}

/** Webhook ack parity (unused under cron-only). */
export function handleSyncWebhookAck(body) {
  const isWebhook = body?.data?._provider_meta;
  if (!isWebhook) return null;
  const state = body.data._provider_meta['x-goog-resource-state'];
  if (state === 'sync') return { status: 'sync_ack' };
  return null;
}
