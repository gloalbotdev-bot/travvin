/**
 * Hourly cron: guest stay messages + supplier scheduled messages.
 */
import cron from 'node-cron';
import { sendStayMessages } from '../lib/send-stay-messages.js';
import { sendScheduledSupplierMessages } from '../lib/send-scheduled-supplier-messages.js';

/**
 * @param {object} deps
 * @param {ReturnType<import('../lib/entity-store.js').createEntityStore>} deps.store
 */
export async function runStayMessageJobs({ store }) {
  const stay = await sendStayMessages(store);
  const suppliers = await sendScheduledSupplierMessages(store);
  return { stay, suppliers };
}

/** @param {object} deps */
export function startStayMessagesCron(deps) {
  const task = cron.schedule(
    '0 * * * *',
    () => {
      runStayMessageJobs(deps).catch((err) => {
        console.error('[stay-messages]', err);
      });
    },
    { timezone: 'Asia/Jerusalem' },
  );
  console.log('[stay-messages] cron scheduled 0 * * * * Asia/Jerusalem');
  return task;
}
