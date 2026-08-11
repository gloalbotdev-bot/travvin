/**
 * Delayed jobs for Review Auto Publish wait (M9) — decisions.md §3.
 */
import { finalizeReviewAutoPublish } from './finalize-review-auto-publish.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export function createDelayedJobStore(prisma) {
  return {
    async enqueue({ kind, payload, runAt }) {
      return prisma.delayedJob.create({
        data: {
          kind,
          payload: payload || {},
          runAt,
          status: 'pending',
        },
      });
    },

    async processDue(store, { limit = 20 } = {}) {
      const now = new Date();
      const due = await prisma.delayedJob.findMany({
        where: { status: 'pending', runAt: { lte: now } },
        orderBy: { runAt: 'asc' },
        take: limit,
      });

      const results = [];
      for (const job of due) {
        try {
          await prisma.delayedJob.update({
            where: { id: job.id },
            data: { status: 'running', attempts: { increment: 1 } },
          });

          if (job.kind === 'finalizeReviewAutoPublish') {
            const payload =
              typeof job.payload === 'object' && job.payload !== null
                ? job.payload
                : {};
            await finalizeReviewAutoPublish(store, payload);
          } else {
            throw new Error(`Unknown job kind: ${job.kind}`);
          }

          await prisma.delayedJob.update({
            where: { id: job.id },
            data: { status: 'done', lastError: null },
          });
          results.push({ id: job.id, status: 'done' });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await prisma.delayedJob.update({
            where: { id: job.id },
            data: { status: 'failed', lastError: msg.slice(0, 500) },
          });
          results.push({ id: job.id, status: 'failed', error: msg });
        }
      }
      return results;
    },
  };
}
