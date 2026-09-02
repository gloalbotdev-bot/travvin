/**
 * M8 calendar smoke — crypto + sync retry + ownership (mocked Google).
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { encryptSecret, decryptSecret } from '../../src/lib/token-crypto.js';
import { resolvePrimaryCalendarId } from '../../src/lib/google-calendar-oauth.js';
import { createEntityStore } from '../../src/lib/entity-store.js';
import { addBookingToCalendar } from '../../src/lib/add-booking-to-calendar.js';
import { syncGoogleCalendar } from '../../src/lib/sync-google-calendar.js';
import { can } from '../../src/lib/authz.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

if (!process.env.CALENDAR_TOKEN_ENCRYPTION_KEY) {
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
}

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
  const plain = 'refresh-token-secret';
  const enc = encryptSecret(plain);
  assert(enc.startsWith('v1:'), 'ciphertext versioned');
  assert(!enc.includes(plain), 'plaintext not in ciphertext');
  assert(decryptSecret(enc) === plain, 'encrypt/decrypt round-trip');

  const mockUserinfoFirst = async (url) => {
    if (String(url).includes('userinfo')) {
      return { ok: true, json: async () => ({ email: 'owner@example.com' }) };
    }
    return { ok: false, text: async () => 'skip' };
  };
  const resolved = await resolvePrimaryCalendarId('tok', mockUserinfoFirst);
  assert(resolved.calendarId === 'owner@example.com', 'calendar id from userinfo email');
  assert(resolved.calendarId !== 'primary', 'not alias primary');

  const mockListOnly = async (url) => {
    if (String(url).includes('userinfo')) {
      return { ok: false, text: async () => 'no' };
    }
    return {
      ok: true,
      json: async () => ({ items: [{ id: 'list@example.com', primary: true }] }),
    };
  };
  const fromList = await resolvePrimaryCalendarId('tok', mockListOnly);
  assert(fromList.calendarId === 'list@example.com', 'calendarList fallback');

  assert(
    can('SyncState', 'read', { id: 'a', role: 'owner' }, { owner_id: 'b' }) === false,
    'SyncState cross-owner deny',
  );

  const ownerId = '00000000-0000-4000-8000-0000000000aa';
  const otherId = '00000000-0000-4000-8000-0000000000bb';
  const zimmerId = '00000000-0000-4000-8000-0000000000c1';

  // Ensure users exist for FK if we touch connections — skip DB connection tests without table
  let attempts = 0;
  const flakyFetch = async (url, init) => {
    attempts += 1;
    if (attempts === 1 && init?.method !== 'POST') {
      const err = new Error('upstream 503');
      err.status = 503;
      err.transient = true;
      throw err;
    }
    if (String(url).includes('/events') && (!init?.method || init.method === 'GET')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [], nextSyncToken: 'tok-1' }),
        text: async () => '',
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'evt-1' }),
      text: async () => '',
    };
  };

  const connections = {
    async getAccessToken(oid) {
      assert(oid === ownerId, 'token for booking owner');
      return { accessToken: 'access', calendarId: 'owner@example.com' };
    },
  };

  // Far-future window avoids leftover approved bookings on shared test zimmer
  const ci = '2099-07-01';
  const co = '2099-07-03';

  await prisma.record.upsert({
    where: { id: zimmerId },
    create: {
      id: zimmerId,
      entityType: 'Zimmer',
      data: { name: 'cal-smoke-z', owner_id: ownerId },
    },
    update: {
      data: { name: 'cal-smoke-z', owner_id: ownerId },
    },
  });

  const booking = await store.create(
    'BookingRequest',
    {
      zimmer_id: zimmerId,
      zimmer_name: 'צימר',
      owner_id: ownerId,
      guest_name: 'אורח',
      guest_phone: '050',
      check_in: ci,
      check_out: co,
      status: 'אושרה',
    },
    { actor: { id: ownerId, role: 'owner' }, createdById: ownerId },
  );

  try {
    await addBookingToCalendar(
      { store, connections, fetchImpl: flakyFetch },
      { bookingId: booking.id, actor: { id: otherId, role: 'owner' } },
    );
    assert(false, 'foreign owner should be forbidden');
  } catch (e) {
    assert(e.status === 403, 'foreign owner → 403');
  }

  attempts = 0;
  const added = await addBookingToCalendar(
    { store, connections, fetchImpl: flakyFetch },
    { bookingId: booking.id, actor: { id: ownerId, role: 'owner' } },
  );
  assert(added.success && added.event_id === 'evt-1', 'addBooking creates event');

  attempts = 0;
  const again = await addBookingToCalendar(
    { store, connections, fetchImpl: flakyFetch },
    { bookingId: booking.id, actor: { id: ownerId, role: 'owner' } },
  );
  assert(again.skipped === true && again.event_id === 'evt-1', 'idempotent skip when calendar_event_id set');
  assert(attempts === 0, 'idempotent path does not call Google');

  await store.create(
    'SyncState',
    {
      owner_id: ownerId,
      provider: 'google',
      auto_sync: true,
      last_status: 'ok',
    },
    { actor: { id: ownerId, role: 'owner' }, createdById: ownerId },
  );

  attempts = 0;
  const synced = await syncGoogleCalendar(
    { store, connections, fetchImpl: flakyFetch },
    { ownerId, fromWorkflow: true },
  );
  assert(synced.status === 'ok', 'sync succeeds after one transient retry');
  assert(attempts >= 2, 'transient retry used second fetch');

  await store.delete('BookingRequest', booking.id, { id: ownerId, role: 'admin' });
  const syncs = await store.filter(
    'SyncState',
    { owner_id: ownerId },
    undefined,
    undefined,
    { id: ownerId, role: 'owner' },
  );
  for (const s of syncs) {
    await store.delete('SyncState', s.id, { id: ownerId, role: 'owner' });
  }

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll calendar smoke tests passed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
