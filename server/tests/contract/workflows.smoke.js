/**
 * M9 workflows smoke — entity notification hooks + Review delayed finalize.
 * Requires DATABASE_URL. Sets REVIEW_WAIT_MS=0 for immediate due jobs.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createEntityStore } from '../../src/lib/entity-store.js';
import { createDelayedJobStore } from '../../src/lib/delayed-jobs.js';
import { createEntityHooks } from '../../src/lib/entity-hooks.js';
import { SERVICE_ACTOR } from '../../src/lib/service-role.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

process.env.REVIEW_WAIT_MS = '0';
process.env.NOTIFICATIONS_ENABLED = 'true';

const prisma = new PrismaClient();
const jobs = createDelayedJobStore(prisma);

/** @type {ReturnType<typeof createEntityStore>} */
let store;
const hooks = {
  afterCreate: (e, r) => hooksImpl.afterCreate(e, r),
  afterUpdate: (e, r, o) => hooksImpl.afterUpdate(e, r, o),
};
store = createEntityStore(prisma, hooks);
const hooksImpl = createEntityHooks({ store, jobs });

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForHook() {
  // hooks are fire-and-forget; allow push + enqueue
  await sleep(300);
}

async function findRecentSystemMessage({ titleIncludes, targetUserId }) {
  const list = await store.list('SystemMessage', '-created_date', 30, SERVICE_ACTOR);
  return list.find((m) => {
    if (titleIncludes && !(m.title || '').includes(titleIncludes)) return false;
    if (targetUserId) {
      const ids = Array.isArray(m.target_user_ids) ? m.target_user_ids : [];
      if (!ids.includes(targetUserId)) return false;
    }
    return true;
  });
}

async function main() {
  const cleanup = [];

  const zimmerWorkflowId = '00000000-0000-4000-8000-0000000000f9';

  await prisma.record.upsert({
    where: { id: zimmerWorkflowId },
    create: {
      id: zimmerWorkflowId,
      entityType: 'Zimmer',
      data: { name: 'Smoke Cab', owner_id: 'owner-m9' },
    },
    update: {
      data: { name: 'Smoke Cab', owner_id: 'owner-m9' },
    },
  });

  const staleBookings = await store.filter(
    'BookingRequest',
    { zimmer_id: zimmerWorkflowId },
    '-created_date',
    50,
    SERVICE_ACTOR,
  );
  for (const b of staleBookings) {
    await store.delete('BookingRequest', b.id, SERVICE_ACTOR);
  }

  const booking = await store.create(
    'BookingRequest',
    {
      zimmer_id: zimmerWorkflowId,
      zimmer_name: 'Smoke Cab',
      owner_id: 'owner-m9',
      guest_name: 'Smoke Guest',
      guest_phone: '0500000000',
      check_in: '2026-09-01',
      check_out: '2026-09-03',
      status: 'ממתינה',
    },
    {
      actor: { id: 'cust-m9', role: 'user', email: 'cust-m9@test.com' },
      createdById: 'cust-m9',
      createdBy: 'cust-m9@test.com',
    },
  );
  cleanup.push(['BookingRequest', booking.id]);
  await waitForHook();

  const newBookingMsg = await findRecentSystemMessage({
    titleIncludes: 'בקשת הזמנה חדשה',
    targetUserId: 'owner-m9',
  });
  assert(!!newBookingMsg, 'BookingRequest create → owner notification');
  if (newBookingMsg) cleanup.push(['SystemMessage', newBookingMsg.id]);

  await store.update(
    'BookingRequest',
    booking.id,
    { status: 'אושרה' },
    SERVICE_ACTOR,
  );
  await waitForHook();
  const approvedMsg = await findRecentSystemMessage({
    titleIncludes: 'ההזמנה אושרה',
    targetUserId: 'cust-m9',
  });
  assert(!!approvedMsg, 'BookingRequest status→אושרה → customer notification');
  if (approvedMsg) cleanup.push(['SystemMessage', approvedMsg.id]);

  const review = await store.create(
    'Review',
    {
      zimmer_id: 'z-m9',
      zimmer_name: 'Smoke Zimmer',
      owner_id: 'owner-m9',
      customer_id: 'cust-m9',
      rating: 5,
      status: 'pending_publish',
      text: 'm9 wait test',
    },
    {
      actor: { id: 'cust-m9', role: 'user', email: 'cust-m9@test.com' },
      createdById: 'cust-m9',
      createdBy: 'cust-m9@test.com',
    },
  );
  cleanup.push(['Review', review.id]);
  await waitForHook();

  const reviewMsg = await findRecentSystemMessage({
    titleIncludes: 'ביקורת חדשה',
    targetUserId: 'owner-m9',
  });
  assert(!!reviewMsg, 'Review create → owner notification (M15 #4/#24)');
  if (reviewMsg) cleanup.push(['SystemMessage', reviewMsg.id]);

  const pendingJobs = await prisma.delayedJob.findMany({
    where: {
      kind: 'finalizeReviewAutoPublish',
      status: 'pending',
      payload: { path: ['review_id'], equals: review.id },
    },
  });
  assert(pendingJobs.length >= 1, 'Review pending_publish → delayed job enqueued');

  // Ensure run_at is due (REVIEW_WAIT_MS=0 may still race)
  await prisma.delayedJob.updateMany({
    where: { id: { in: pendingJobs.map((j) => j.id) } },
    data: { runAt: new Date(Date.now() - 1000) },
  });

  const results = await jobs.processDue(store);
  assert(
    results.some((r) => r.status === 'done'),
    'processDue finalizeReviewAutoPublish → done',
  );

  const after = await store.get('Review', review.id, SERVICE_ACTOR);
  assert(after.status === 'published' && after.published_at, 'Review finalized to published');

  for (const [entity, id] of cleanup.reverse()) {
    try {
      await store.delete(entity, id, SERVICE_ACTOR);
    } catch {
      /* ignore */
    }
  }

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll workflows smoke tests passed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
