/**
 * Cron job: sync Google calendars for owners with auto_sync (M8).
 */
import cron from 'node-cron';
import { SERVICE_ACTOR } from '../lib/service-role.js';
import { syncGoogleCalendar } from '../lib/sync-google-calendar.js';

/**
 * @param {object} deps
 * @param {ReturnType<import('../lib/entity-store.js').createEntityStore>} deps.store
 * @param {ReturnType<import('../lib/calendar-connection-store.js').createCalendarConnectionStore>} deps.connections
 */
export async function runCalendarAutoSync({ store, connections }) {
  const rows = await store.filter(
    'SyncState',
    { auto_sync: true, provider: 'google' },
    undefined,
    undefined,
    SERVICE_ACTOR,
  );

  const results = [];
  for (const row of rows) {
    const ownerId = row.owner_id;
    if (!ownerId) continue;
    try {
      const r = await syncGoogleCalendar(
        { store, connections },
        { ownerId, fromWorkflow: true },
      );
      results.push({ ownerId, ...r });
    } catch (e) {
      results.push({
        ownerId,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

/** @param {object} deps */
export function startCalendarAutoSyncCron(deps) {
  const task = cron.schedule(
    '*/30 * * * *',
    () => {
      runCalendarAutoSync(deps).catch((err) => {
        console.error('[calendar-auto-sync]', err);
      });
    },
    { timezone: 'Asia/Jerusalem' },
  );
  console.log('[calendar-auto-sync] cron scheduled */30 Asia/Jerusalem');
  return task;
}
