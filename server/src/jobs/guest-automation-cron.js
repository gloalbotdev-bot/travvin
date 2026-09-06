/**
 * Hourly cron: auto-checkout expired stays + guest summary refresh.
 */
import cron from 'node-cron';
import { autoCheckoutExpiredStays } from '../lib/auto-checkout-expired.js';
import { buildGuestSummary } from '../lib/build-guest-summary.js';
import { SERVICE_ACTOR } from '../lib/service-role.js';

/**
 * @param {object} deps
 * @param {ReturnType<import('../lib/entity-store.js').createEntityStore>} deps.store
 */
export async function runGuestAutomationJobs({ store }) {
  const checkout = await autoCheckoutExpiredStays(store);
  const summaries = [];

  for (const row of checkout.results || []) {
    if (row.error || !row.id) continue;
    try {
      const result = await buildGuestSummary(store, { booking_id: row.id }, SERVICE_ACTOR);
      summaries.push({ booking_id: row.id, ...result });
    } catch (err) {
      summaries.push({
        booking_id: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { checkout, summaries };
}

/** @param {object} deps */
export function startGuestAutomationCron(deps) {
  const task = cron.schedule(
    '0 * * * *',
    () => {
      runGuestAutomationJobs(deps).catch((err) => {
        console.error('[guest-automation]', err);
      });
    },
    { timezone: 'Asia/Jerusalem' },
  );
  console.log('[guest-automation] cron scheduled 0 * * * * Asia/Jerusalem');
  return task;
}
