/**
 * Stay messages / checkout / GuestMessage authz smoke.
 * Requires DATABASE_URL.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createEntityStore } from '../../src/lib/entity-store.js';
import { performCheckout } from '../../src/lib/perform-checkout.js';
import { sendGuestMessage } from '../../src/lib/send-guest-message.js';
import { SERVICE_ACTOR } from '../../src/lib/service-role.js';
import { listEntityNames } from '../../src/lib/schema-loader.js';
import { assertSafeHttpsUrl } from '../../src/lib/safe-webhook-url.js';
import { dispatchStage } from '../../src/lib/send-stay-messages.js';
import {
  DEFAULT_TEMPLATES,
  TIME_NOT_SET,
  buildStayVars,
  substituteVars,
} from '../../src/lib/stay-message-templates.js';

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

/** In-memory store: captures GuestMessage bodies without touching the DB or WhatsApp. */
function captureStore() {
  const created = [];
  return {
    created,
    async get() { return null; },
    async filter() { return []; },
    async update(_t, id, data) { return { id, ...data }; },
    async create(entityType, data) {
      const row = { id: `fake-${created.length}`, ...data };
      created.push({ entityType, data: row });
      return row;
    },
  };
}

async function templateChecks() {
  const vars = buildStayVars(
    { checkin_time: '16:00', address: 'הגפן 5' },
    { zimmer_name: 'בקתה', num_adults: 2 },
    'דנה',
  );
  assert(vars.check_out === TIME_NOT_SET, 'missing checkout time → "לא הוגדרה"');
  assert(
    substituteVars('שלום {{username}}, צ\'ק-אין: {{check_in}} ב-{{zimmer_name}} ({{num_guests}})', vars) ===
      "שלום דנה, צ'ק-אין: 16:00 ב-בקתה (2)",
    'substituteVars replaces known variables',
  );
  assert(substituteVars('היי {{evil}}!', vars) === 'היי!', 'unknown variable dropped, no raw {{}} to guest');
  const noName = buildStayVars({}, {}, '');
  assert(
    substituteVars(DEFAULT_TEMPLATES.post_checkin, noName).startsWith('מקווים'),
    'empty guest name leaves no dangling comma',
  );
  assert(!/אקומודיישן/.test(Object.values(DEFAULT_TEMPLATES).join('')), 'templates do not contain "אקומודיישן"');

  const s1 = captureStore();
  const stay = { address: 'הגפן 5', entry_code: '1234' };
  const b = { id: 'b1', zimmer_name: 'בקתה' };
  await dispatchStage(s1, {
    b, stay, customerId: 'c1', stage: 'pre_checkin', customText: '',
    vars: buildStayVars(stay, b, 'דנה'),
  });
  const pre = s1.created.find((c) => c.entityType === 'GuestMessage')?.data;
  assert(pre?.body.startsWith('שלום דנה, מחכים לכם מחר!'), 'pre_checkin uses default template with guest name');
  assert(pre?.body.includes(`שעת הצ'ק-אין: ${TIME_NOT_SET}`), 'pre_checkin shows "לא הוגדרה" when time unset');
  assert(!/15:00|11:00/.test(pre?.body || ''), 'pre_checkin never shows fallback hours to guest');
  assert(pre?.body.includes('קוד כניסה: 1234') && pre?.body.includes('כתובת: הגפן 5'), 'pre_checkin appends detail lines');
  assert(pre?.metadata?.checkin_time === '', 'pre_checkin metadata has no invented time');

  const s2 = captureStore();
  await dispatchStage(s2, {
    b, stay, customerId: 'c1', stage: 'pre_checkin', customText: 'כתובת: {{address}}, קוד {{entry_code}}',
    vars: buildStayVars(stay, b, 'דנה'),
  });
  const custom = s2.created.find((c) => c.entityType === 'GuestMessage')?.data;
  assert(
    custom?.body.split('\n')[0] === 'כתובת: הגפן 5, קוד 1234' && !custom.body.includes('קוד כניסה: 1234'),
    'variables used in owner text are not duplicated in detail lines',
  );
}

async function main() {
  await templateChecks();

  const names = listEntityNames();
  assert(names.includes('GuestMessage') && names.includes('AppSetting'), 'new entities registered');

  try {
    assertSafeHttpsUrl('http://evil.example/hook');
    assert(false, 'http webhook rejected');
  } catch (e) {
    assert(e.status === 400, 'http webhook → 400');
  }
  try {
    assertSafeHttpsUrl('https://127.0.0.1/hook');
    assert(false, 'loopback webhook rejected');
  } catch (e) {
    assert(e.status === 400, 'loopback webhook → 400');
  }

  const owner = { id: 'owner-stay', email: 'os@t.com', role: 'owner' };
  const customer = { id: 'cust-stay', email: 'cs@t.com', role: 'user' };
  const stranger = { id: 'stranger-stay', email: 'ss@t.com', role: 'user' };

  const zimmer = await store.create(
    'Zimmer',
    {
      name: 'Stay Test Cab',
      owner_id: owner.id,
      stay_settings: { entry_code: 'SECRET-99', key_location: 'under pot', address: '1 Main' },
    },
    { actor: owner, createdById: owner.id, createdBy: owner.email },
  );

  const asOwner = await store.get('Zimmer', zimmer.id, owner);
  assert(asOwner.stay_settings?.entry_code === 'SECRET-99', 'owner sees entry_code');
  const asStranger = await store.get('Zimmer', zimmer.id, stranger);
  assert(!asStranger.stay_settings?.entry_code, 'stranger does not see entry_code');
  assert(!asStranger.stay_settings?.key_location, 'stranger does not see key_location');
  assert(asStranger.stay_settings?.address === '1 Main', 'stranger still sees address');

  const booking = await store.create(
    'BookingRequest',
    {
      zimmer_id: zimmer.id,
      zimmer_name: zimmer.name,
      owner_id: owner.id,
      guest_name: 'Guest Stay',
      guest_phone: '0500000001',
      check_in: '2026-10-01',
      check_out: '2026-10-03',
      status: 'אושרה',
    },
    { actor: customer, createdById: customer.id, createdBy: customer.email },
  );

  try {
    await performCheckout(store, { booking_id: booking.id, by: 'admin' }, stranger);
    assert(false, 'stranger checkout denied');
  } catch (e) {
    assert(e.status === 403, 'stranger checkout → 403 even with by=admin');
  }

  const checkout = await performCheckout(store, { booking_id: booking.id, by: 'admin' }, customer);
  assert(checkout.ok === true, 'customer checkout ok');
  const after = await store.get('BookingRequest', booking.id, customer);
  assert(after.checked_out === true && after.checkout_by === 'customer', 'checkout_by from session not payload');

  const msg = await sendGuestMessage(store, {
    customer_id: customer.id,
    owner_id: owner.id,
    title: 'בדיקה',
    body: 'שלום',
    channels: ['app'],
    skip_bell: true,
  });
  assert(msg.ok && msg.id, 'sendGuestMessage creates GuestMessage');

  try {
    await store.update('GuestMessage', msg.id, { body: 'hacked', title: 'x' }, customer);
    assert(false, 'customer full update denied');
  } catch (e) {
    assert(e.status === 403, 'customer cannot rewrite GuestMessage body');
  }
  const marked = await store.update('GuestMessage', msg.id, { read: true }, customer);
  assert(marked.read === true, 'customer can mark read');

  const leftovers = await store.filter('GuestMessage', { customer_id: customer.id }, undefined, 50, SERVICE_ACTOR);
  for (const m of leftovers) {
    await store.delete('GuestMessage', m.id, SERVICE_ACTOR);
  }
  await store.delete('BookingRequest', booking.id, SERVICE_ACTOR);
  await store.delete('Zimmer', zimmer.id, SERVICE_ACTOR);

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log('\nAll stay-messages smoke tests passed');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
