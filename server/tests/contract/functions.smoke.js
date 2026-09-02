/**
 * push + finalize smoke tests (milestone 8.5) — requires DATABASE_URL.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createEntityStore } from '../../src/lib/entity-store.js';
import { pushInAppNotification } from '../../src/lib/push-in-app-notification.js';
import { finalizeReviewAutoPublish } from '../../src/lib/finalize-review-auto-publish.js';
import { SERVICE_ACTOR } from '../../src/lib/service-role.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const prisma = new PrismaClient();
const store = createEntityStore(prisma);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

async function main() {
  try {
    await pushInAppNotification(store, { title: '' });
    assert(false, 'push rejects empty title');
  } catch (e) {
    assert(e.status === 400, 'push empty title → 400');
  }

  const pushed = await pushInAppNotification(store, {
    audience: 'owner',
    target_user_ids: ['owner-1'],
    category: 'הודעה',
    title: 'בדיקת smoke',
    body: 'גוף',
    action_type: 'open_review',
    action_entity_id: 'rev-test',
  });
  assert(pushed.ok === true && pushed.id, 'push creates SystemMessage');

  const msg = await store.get('SystemMessage', pushed.id, SERVICE_ACTOR);
  assert(msg.title === 'בדיקת smoke' && msg.target_label === '1 נמענים', 'SystemMessage fields');

  try {
    await finalizeReviewAutoPublish(store, {});
    assert(false, 'finalize rejects missing review_id');
  } catch (e) {
    assert(e.status === 400, 'finalize missing review_id → 400');
  }

  const review = await store.create(
    'Review',
    {
      zimmer_id: 'z-smoke',
      zimmer_name: 'Smoke Zimmer',
      owner_id: 'owner-smoke',
      customer_id: 'cust-1',
      rating: 5,
      status: 'pending_publish',
      text: 'test',
    },
    { actor: { id: 'cust-1', role: 'user', email: 'cust@test.com' }, createdById: 'cust-1', createdBy: 'cust@test.com' },
  );

  const pub = await finalizeReviewAutoPublish(store, { review_id: review.id });
  assert(pub.ok && pub.action === 'published', 'finalize pending_publish → published');

  const after = await store.get('Review', review.id, SERVICE_ACTOR);
  assert(after.status === 'published' && after.published_at, 'Review published_at set');

  const skip = await finalizeReviewAutoPublish(store, { review_id: review.id });
  assert(skip.action === 'skipped' && skip.status === 'published', 'finalize already published → skipped');

  await store.delete('Review', review.id, SERVICE_ACTOR);
  await store.delete('SystemMessage', pushed.id, SERVICE_ACTOR);

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll functions smoke tests passed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
