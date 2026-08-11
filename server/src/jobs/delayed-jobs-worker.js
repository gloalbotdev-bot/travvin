/**
 * Process due delayed jobs every minute (M9 Review wait).
 */
import cron from 'node-cron';

/**
 * @param {object} deps
 * @param {ReturnType<import('../lib/entity-store.js').createEntityStore>} deps.store
 * @param {ReturnType<import('../lib/delayed-jobs.js').createDelayedJobStore>} deps.jobs
 */
export function startDelayedJobsCron({ store, jobs }) {
  const task = cron.schedule(
    '* * * * *',
    () => {
      jobs.processDue(store).catch((err) => {
        console.error('[delayed-jobs]', err);
      });
    },
    { timezone: 'Asia/Jerusalem' },
  );
  console.log('[delayed-jobs] cron scheduled every minute Asia/Jerusalem');
  return task;
}
