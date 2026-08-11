/**
 * Booking guards smoke — overlap (#9), total_price (#10), Jerusalem weekday (#21).
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createEntityStore } from '../../src/lib/entity-store.js';
import {
  calcBookingTotalForZimmer,
  getDayOfWeekIsrael,
} from '../../src/lib/booking-price.js';
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
  // #21 — Thursday is weekend night in IL pricing
  assert(getDayOfWeekIsrael('2026-08-13') === 4, '2026-08-13 is Thursday in IL');
  assert(getDayOfWeekIsrael('2026-08-14') === 5, '2026-08-14 is Friday in IL');
  assert(getDayOfWeekIsrael('2026-08-15') === 6, '2026-08-15 is Saturday in IL');

  const zimmer = await store.create(
    'Zimmer',
    {
      name: 'booking-smoke-z',
      owner_id: 'owner-bs',
      price_per_night: 100,
      weekday_price: 100,
      weekend_price: 200,
    },
    { actor: SERVICE_ACTOR },
  );

  // Thu–Sat: Thu night + Fri night = weekend; Sat night = weekday
  // check_in Thu 13, check_out Sat 15 → nights: 13, 14 = 2 weekend = 400
  const priced = calcBookingTotalForZimmer(zimmer, '2026-08-13', '2026-08-15', 0, 0);
  assert(priced === 400, `Thu+Fri nights weekend total 400 (got ${priced})`);

  const owner = { id: 'owner-bs', role: 'owner', email: 'obs@t.com' };

  const first = await store.create(
    'BookingRequest',
    {
      zimmer_id: zimmer.id,
      zimmer_name: zimmer.name,
      owner_id: 'owner-bs',
      guest_name: 'A',
      guest_phone: '050',
      check_in: '2026-10-01',
      check_out: '2026-10-03',
      status: 'אושרה',
      total_price: 1, // client lie — server overwrites
      num_adults: 2,
      num_children: 0,
    },
    { actor: owner, createdById: owner.id },
  );
  assert(first.total_price === 400, `server total_price weekend stay (got ${first.total_price})`);

  let overlapDenied = false;
  try {
    await store.create(
      'BookingRequest',
      {
        zimmer_id: zimmer.id,
        zimmer_name: zimmer.name,
        owner_id: 'owner-bs',
        guest_name: 'B',
        guest_phone: '051',
        check_in: '2026-10-02',
        check_out: '2026-10-04',
        status: 'ממתינה',
      },
      { actor: owner, createdById: 'cust-b' },
    );
  } catch (e) {
    overlapDenied = e.status === 409;
  }
  assert(overlapDenied, 'overlapping create → 409');

  const pending = await store.create(
    'BookingRequest',
    {
      zimmer_id: zimmer.id,
      zimmer_name: zimmer.name,
      owner_id: 'owner-bs',
      guest_name: 'C',
      guest_phone: '052',
      check_in: '2026-11-01',
      check_out: '2026-11-03',
      status: 'ממתינה',
    },
    { actor: owner, createdById: 'cust-c' },
  );

  const otherApproved = await store.create(
    'BookingRequest',
    {
      zimmer_id: zimmer.id,
      zimmer_name: zimmer.name,
      owner_id: 'owner-bs',
      guest_name: 'D',
      guest_phone: '053',
      check_in: '2026-11-01',
      check_out: '2026-11-03',
      status: 'אושרה',
    },
    { actor: owner, createdById: owner.id },
  );

  let approveDenied = false;
  try {
    await store.update('BookingRequest', pending.id, { status: 'אושרה' }, owner);
  } catch (e) {
    approveDenied = e.status === 409;
  }
  assert(approveDenied, 'approve overlapping pending → 409');

  await store.delete('BookingRequest', first.id, SERVICE_ACTOR);
  await store.delete('BookingRequest', pending.id, SERVICE_ACTOR);
  await store.delete('BookingRequest', otherApproved.id, SERVICE_ACTOR);
  await store.delete('Zimmer', zimmer.id, SERVICE_ACTOR);

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll booking smoke tests passed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
