/**
 * Minimal contract smoke tests for entity store (no Jest — run with node).
 * Usage (from server/): node tests/contract/entities.smoke.js
 *
 * Requires DATABASE_URL in server/.env and records table present.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createEntityStore } from '../../src/lib/entity-store.js';
import { listEntityNames, applyDefaults } from '../../src/lib/schema-loader.js';

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
  const names = listEntityNames();
  assert(names.length === 22, `22 entities loaded (got ${names.length})`);
  assert(names.includes('Review') && names.includes('SyncState'), 'Review + SyncState present');
  for (const e of ['GuestProfile', 'ZimmerVideo', 'VideoLike']) {
    assert(names.includes(e), `port entity ${e} present`);
  }
  for (const e of ['AppSetting', 'GuestMessage', 'SupplierAutomation', 'SupplierMessage']) {
    assert(names.includes(e), `SEC-025 backend entity ${e} present`);
  }

  const zimmerDefaults = applyDefaults('Zimmer', { name: 'Test' });
  assert(zimmerDefaults.approval_status === 'אושר', 'Zimmer default approval_status');
  assert(Array.isArray(zimmerDefaults.seasonal_pricing), 'Zimmer default seasonal_pricing []');
  assert(zimmerDefaults.partial_pricing_enabled === false, 'Zimmer default partial_pricing_enabled');

  const reviewDefaults = applyDefaults('Review', { rating: 5 });
  assert(reviewDefaults.status === 'pending_publish', 'Review default status');
  assert(Array.isArray(reviewDefaults.images), 'Review default images []');

  // Round-trip create / filter / get / update / delete
  const created = await store.create(
    'Zimmer',
    {
      name: 'חוזה-בדיקה',
      owner_id: 'user-test-1',
      location: 'צפת',
      approval_status: 'אושר',
      seasonal_pricing: [{ start_date: '2026-07-01', end_date: '2026-08-01', adjustment: 'increase', percentage: 10 }],
    },
    {
      actor: { id: 'user-test-1', email: 'test@example.com', role: 'owner' },
      createdById: 'user-test-1',
      createdBy: 'test@example.com',
    },
  );

  assert(typeof created.id === 'string' && created.id.length > 0, 'create returns id');
  assert(typeof created.created_date === 'string' && created.created_date.endsWith('Z'), 'created_date ISO Z');
  assert(created.created_by_id === 'user-test-1', 'created_by_id set');
  assert(created.name === 'חוזה-בדיקה', 'Hebrew field round-trip');
  assert(created.seasonal_pricing?.[0]?.adjustment === 'increase', 'nested seasonal_pricing');

  const listed = await store.list('Zimmer', '-created_date', 10);
  assert(Array.isArray(listed) && listed.some((r) => r.id === created.id), 'list includes created');

  const filtered = await store.filter('Zimmer', { approval_status: 'אושר' }, '-created_date', 50);
  assert(filtered.some((r) => r.id === created.id), 'filter equality on Hebrew enum');

  const byOwner = await store.filter('Zimmer', { created_by_id: 'user-test-1' });
  assert(byOwner.some((r) => r.id === created.id), 'filter by created_by_id column');

  const got = await store.get('Zimmer', created.id);
  assert(got.id === created.id, 'get by id');

  const ownerActor = { id: 'user-test-1', email: 'test@example.com', role: 'owner' };

  const updated = await store.update('Zimmer', created.id, { location: 'טבריה' }, ownerActor);
  assert(updated.location === 'טבריה', 'update merges field');
  assert(updated.name === 'חוזה-בדיקה', 'update preserves other fields');
  assert(updated.updated_date >= created.updated_date, 'updated_date advances');

  await store.delete('Zimmer', created.id, ownerActor);
  let gone = false;
  try {
    await store.get('Zimmer', created.id);
  } catch (e) {
    gone = e.status === 404;
  }
  assert(gone, 'delete removes record');

  // SyncState per-owner create
  const sync = await store.create(
    'SyncState',
    { owner_id: 'owner-sync-1', provider: 'google', auto_sync: true },
    { actor: { id: 'owner-sync-1', role: 'owner', email: 'o@test.com' } },
  );
  assert(sync.auto_sync === true, 'SyncState auto_sync');
  assert(sync.last_status === 'ok', 'SyncState default last_status');
  assert(sync.owner_id === 'owner-sync-1', 'SyncState owner_id');
  await store.delete('SyncState', sync.id, { id: 'owner-sync-1', role: 'owner' });

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll contract smoke checks passed');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
