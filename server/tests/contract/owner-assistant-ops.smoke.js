/**
 * OwnerInfoAssistant server ops smoke (M15 #8ב).
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createEntityStore } from '../../src/lib/entity-store.js';
import {
  executeOwnerAssistantOp,
  sanitizeOperation,
} from '../../src/lib/owner-assistant-ops.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const prisma = new PrismaClient();
const store = createEntityStore(prisma);

const owner = { id: 'owner-asst-1', email: 'owner-asst@test.com', role: 'owner' };
const stranger = { id: 'stranger-asst-1', email: 'str@t.com', role: 'user' };

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
  assert(sanitizeOperation({ type: 'delete_all' }) === null, 'reject unknown op type');
  assert(sanitizeOperation({ type: 'create_zimmer', name: 'x' })?.type === 'create_zimmer', 'accept create_zimmer');

  try {
    await executeOwnerAssistantOp(store, {
      operation: { type: 'create_zimmer', name: 'x' },
      ownerId: owner.id,
      actor: stranger,
    });
    assert(false, 'stranger cannot run ops');
  } catch (e) {
    assert(e.status === 403, 'stranger → 403');
  }

  const created = await executeOwnerAssistantOp(store, {
    operation: {
      type: 'create_zimmer',
      name: 'עוזר-בדיקה',
      location: 'צפת',
      price_per_night: 500,
    },
    ownerId: owner.id,
    actor: owner,
    ownerName: 'בדיקה',
  });
  assert(created.kind === 'create_zimmer' && created.zimmer.owner_id === owner.id, 'create_zimmer sets owner_id');

  try {
    await executeOwnerAssistantOp(store, {
      operation: {
        type: 'update_zimmer',
        zimmer_id: created.zimmer.id,
        fields: { owner_id: 'evil', approval_status: 'נדחתה', price_per_night: 999 },
      },
      ownerId: owner.id,
      actor: owner,
    });
    const after = await store.get('Zimmer', created.zimmer.id, owner);
    assert(after.owner_id === owner.id, 'update cannot change owner_id');
    assert(after.approval_status === 'אושר', 'update cannot change approval_status');
    assert(after.price_per_night === 999, 'update applies whitelisted field');
  } catch (e) {
    assert(false, `update_zimmer failed: ${e.message}`);
  }

  const byName = await executeOwnerAssistantOp(store, {
    operation: {
      type: 'update_zimmer',
      zimmer_name: 'עוזר-בדיקה',
      fields: { price: 720 },
    },
    ownerId: owner.id,
    actor: owner,
  });
  assert(byName.kind === 'update_zimmer' && byName.zimmer.price_per_night === 720, 'update by zimmer_name + price alias');

  try {
    await executeOwnerAssistantOp(store, {
      operation: {
        type: 'update_zimmer',
        zimmer_id: created.zimmer.id,
        fields: { price_per_night: 600 },
      },
      ownerId: 'other-owner',
      actor: owner,
    });
    assert(false, 'cannot update zimmer under other ownerId');
  } catch (e) {
    assert(e.status === 403, 'wrong ownerId → 403');
  }

  const booking = await executeOwnerAssistantOp(store, {
    operation: {
      type: 'create_booking',
      guest_name: 'דני',
      guest_phone: '050-1111111',
      zimmer_name: 'עוזר-בדיקה',
      check_in: '2026-09-01',
      check_out: '2026-09-03',
      num_guests: 2,
    },
    ownerId: owner.id,
    actor: owner,
  });
  assert(booking.kind === 'create_booking' && booking.booking.owner_id === owner.id, 'create_booking');
  assert(typeof booking.booking.total_price === 'number', 'server computes total_price');

  await store.delete('BookingRequest', booking.booking.id, owner);
  await store.delete('Zimmer', created.zimmer.id, owner);

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll owner-assistant-ops smoke tests passed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
