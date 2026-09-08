/**
 * Authz unit + store integration smoke (milestone 4.5).
 * Usage: node tests/contract/authz.smoke.js
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { can, readScopeWhere } from '../../src/lib/authz.js';
import { createEntityStore } from '../../src/lib/entity-store.js';
import { hashPassword } from '../../src/lib/password.js';

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
  const admin = { id: 'admin-1', email: 'a@t.com', role: 'admin' };
  const owner = { id: 'owner-1', email: 'o@t.com', role: 'owner' };
  const customer = { id: 'cust-1', email: 'c@t.com', role: 'user' };
  const stranger = { id: 'stranger-1', email: 's@t.com', role: 'user' };
  const anon = { id: null, email: null, role: null };

  const chat = {
    customer_id: 'cust-1',
    owner_id: 'owner-1',
    zimmer_id: 'z1',
  };

  // DirectChat RLS
  assert(can('DirectChat', 'read', customer, chat) === true, 'DirectChat read customer');
  assert(can('DirectChat', 'read', owner, chat) === true, 'DirectChat read owner');
  assert(can('DirectChat', 'read', admin, chat) === true, 'DirectChat read admin');
  assert(can('DirectChat', 'read', stranger, chat) === false, 'DirectChat deny stranger');
  assert(can('DirectChat', 'read', anon, chat) === false, 'DirectChat deny anon');
  assert(can('DirectChat', 'create', customer, chat) === true, 'DirectChat create as party');
  assert(can('DirectChat', 'create', stranger, chat) === false, 'DirectChat create deny stranger');

  // ChatSession RLS (M15 #2 — customer search history must not leak)
  const session = { user_id: 'cust-1', messages: [] };
  assert(can('ChatSession', 'read', customer, session) === true, 'ChatSession read owner');
  assert(can('ChatSession', 'read', admin, session) === true, 'ChatSession read admin');
  assert(can('ChatSession', 'read', stranger, session) === false, 'ChatSession deny stranger');
  assert(can('ChatSession', 'read', anon, session) === false, 'ChatSession deny anon');
  assert(can('ChatSession', 'create', customer, session) === true, 'ChatSession create as self');
  assert(can('ChatSession', 'create', stranger, session) === false, 'ChatSession create deny other user_id');
  assert(can('ChatSession', 'create', anon, session) === false, 'ChatSession create deny anon');
  assert(readScopeWhere('ChatSession', anon) === false, 'ChatSession anon → empty scope');
  assert(readScopeWhere('ChatSession', admin) === null, 'ChatSession admin unrestricted');

  // SystemMessage RLS (M15 #3 #20)
  assert(can('SystemMessage', 'read', anon, { title: 'x', target_user_ids: [] }) === false, 'SystemMessage deny anon read');
  assert(can('SystemMessage', 'read', customer, { title: 'x', target_user_ids: [] }) === true, 'SystemMessage broadcast to auth user');
  assert(
    can('SystemMessage', 'read', customer, { title: 'x', target_user_ids: ['cust-1'] }) === true,
    'SystemMessage targeted to self',
  );
  assert(
    can('SystemMessage', 'read', customer, { title: 'x', target_user_ids: ['other'] }) === false,
    'SystemMessage deny other target',
  );
  assert(can('SystemMessage', 'read', admin, { title: 'x', target_user_ids: ['other'] }) === true, 'SystemMessage admin read all');
  assert(can('SystemMessage', 'create', owner, { title: 't', body: 'b', audience: 'customer' }) === false, 'SystemMessage create deny owner (#20)');
  assert(can('SystemMessage', 'create', customer, { title: 't', body: 'b', audience: 'customer' }) === false, 'SystemMessage create deny user');
  assert(can('SystemMessage', 'create', admin, { title: 't', body: 'b', audience: 'customer' }) === true, 'SystemMessage create admin');

  // Undeclared open (provisional)
  assert(can('Zimmer', 'read', anon, { name: 'z' }) === true, 'Zimmer open read');
  assert(can('Zimmer', 'update', stranger, { owner_id: 'owner-1' }) === false, 'Zimmer deny stranger update');
  assert(can('Zimmer', 'update', owner, { owner_id: 'owner-1' }) === true, 'Zimmer owner update own');
  assert(can('SyncState', 'update', stranger, { owner_id: 'other-owner' }) === false, 'SyncState deny other owner (M8)');
  assert(can('SyncState', 'update', { id: 'own-1', role: 'owner' }, { owner_id: 'own-1' }) === true, 'SyncState owner self');
  assert(can('SyncState', 'read', admin, { owner_id: 'x' }) === true, 'SyncState admin read');
  // M15 #1 — AdminPermission no longer open
  assert(can('AdminPermission', 'delete', stranger, {}) === false, 'AdminPermission deny stranger delete');
  assert(can('AdminPermission', 'create', admin, {}) === true, 'AdminPermission admin create');
  assert(
    can('AdminPermission', 'read', owner, { email: 'o@t.com' }) === true,
    'AdminPermission owner read own email',
  );
  assert(
    can('AdminPermission', 'read', owner, { email: 'other@t.com' }) === false,
    'AdminPermission owner deny other email',
  );
  assert(can('Review', 'update', stranger, { status: 'published', owner_id: 'owner-1' }) === false, 'Review deny stranger update (M15 #2)');
  assert(can('Review', 'read', anon, { status: 'published' }) === true, 'Review published readable by anon');
  assert(can('Review', 'read', stranger, { status: 'pending_owner', owner_id: 'owner-1' }) === false, 'Review pending deny stranger');
  assert(can('BookingRequest', 'read', stranger, { owner_id: 'owner-1', guest_phone: '050' }) === false, 'BookingRequest deny stranger');
  assert(can('BookingRequest', 'read', owner, { owner_id: 'owner-1' }) === true, 'BookingRequest owner read');
  assert(can('BookingRequest', 'read', customer, { owner_id: 'x', created_by_id: 'cust-1' }) === true, 'BookingRequest customer read own');
  assert(can('Contact', 'read', stranger, { owner_id: 'owner-1' }) === false, 'Contact deny stranger');
  assert(can('CustomerProfile', 'read', stranger, { user_id: 'cust-1' }) === false, 'CustomerProfile deny stranger');
  assert(can('UnansweredQuestion', 'read', stranger, { owner_id: 'owner-1' }) === false, 'UnansweredQuestion deny stranger');

  // M15 #23 — Review status transitions
  const {
    assertReviewCreateStatus,
    assertReviewStatusTransition,
  } = await import('../../src/lib/review-status.js');
  const { SERVICE_ACTOR } = await import('../../src/lib/service-role.js');

  let createDenied = false;
  try {
    assertReviewCreateStatus(customer, 'published');
  } catch (e) {
    createDenied = e.status === 403;
  }
  assert(createDenied, 'customer cannot create Review as published');
  assertReviewCreateStatus(customer, 'pending_publish');
  assertReviewCreateStatus(admin, 'published');

  const rev = {
    id: 'r1',
    owner_id: 'owner-1',
    customer_id: 'cust-1',
    status: 'pending_owner',
  };
  assertReviewStatusTransition(owner, rev, { status: 'published' });
  assertReviewStatusTransition(owner, rev, { status: 'compromise_offered' });
  let ownerDenied = false;
  try {
    assertReviewStatusTransition(owner, rev, { status: 'removed' });
  } catch (e) {
    ownerDenied = e.status === 403;
  }
  assert(ownerDenied, 'owner cannot pending_owner → removed');

  const offered = { ...rev, status: 'compromise_offered' };
  assertReviewStatusTransition(customer, offered, { status: 'removed' });
  assertReviewStatusTransition(customer, offered, { status: 'pending_owner' });
  let custDenied = false;
  try {
    assertReviewStatusTransition(customer, offered, { status: 'published' });
  } catch (e) {
    custDenied = e.status === 403;
  }
  assert(custDenied, 'customer cannot compromise → published');

  let strangerDenied = false;
  try {
    assertReviewStatusTransition(stranger, rev, { status: 'published' });
  } catch (e) {
    strangerDenied = e.status === 403;
  }
  assert(strangerDenied, 'stranger cannot transition Review');

  assertReviewStatusTransition(
    SERVICE_ACTOR,
    { ...rev, status: 'pending_publish' },
    { status: 'published' },
  );
  assertReviewStatusTransition(admin, rev, { status: 'removed' });

  // Store integration — transition enforcement
  const reviewRow = await store.create(
    'Review',
    {
      zimmer_id: 'z-rev',
      zimmer_name: 'Rev',
      owner_id: 'owner-1',
      customer_id: 'cust-1',
      rating: 3,
      status: 'pending_owner',
    },
    { actor: customer, createdById: customer.id, createdBy: customer.email },
  );
  assert(reviewRow.id, 'customer creates pending_owner Review');

  let pubDenied = false;
  try {
    await store.create(
      'Review',
      {
        zimmer_id: 'z-rev',
        owner_id: 'owner-1',
        rating: 5,
        status: 'published',
      },
      { actor: customer, createdById: customer.id },
    );
  } catch (e) {
    pubDenied = e.status === 403;
  }
  assert(pubDenied, 'store denies customer create published');

  let xownerDenied = false;
  try {
    await store.update(
      'Review',
      reviewRow.id,
      { status: 'published' },
      stranger,
    );
  } catch (e) {
    xownerDenied = e.status === 403;
  }
  assert(xownerDenied, 'store denies stranger Review publish');

  const published = await store.update(
    'Review',
    reviewRow.id,
    { status: 'published', owner_response: 'תודה', published_at: new Date().toISOString() },
    owner,
  );
  assert(published.status === 'published', 'owner can publish pending_owner');
  await store.delete('Review', reviewRow.id, admin);

  // SEC-002 — User entity admin-only RLS
  assert(can('User', 'read', anon, null) === false, 'User deny anon read');
  assert(can('User', 'read', owner, null) === false, 'User deny owner read');
  assert(can('User', 'read', admin, null) === true, 'User admin read');

  let userListDenied = false;
  try {
    await store.list('User', '-created_date', 10, anon);
  } catch (e) {
    userListDenied = e.status === 403;
  }
  assert(userListDenied, 'User anon list → 403');

  let userCreateDenied = false;
  try {
    await store.create(
      'User',
      { email: `sec2-create-${Date.now()}@test.com`, role: 'user' },
      { actor: admin },
    );
  } catch (e) {
    userCreateDenied = e.status === 403;
  }
  assert(userCreateDenied, 'User entity create → 403');

  const sec2Target = await prisma.user.create({
    data: {
      email: `sec2-hash-${Date.now()}@test.com`,
      role: 'user',
      registered: true,
      passwordHash: await hashPassword('KeepMe123!'),
    },
  });
  const hashBefore = (await prisma.user.findUnique({ where: { id: sec2Target.id } }))
    ?.passwordHash;
  await store.update('User', sec2Target.id, { passwordHash: 'evil-hash' }, admin);
  const hashAfter = (await prisma.user.findUnique({ where: { id: sec2Target.id } }))
    ?.passwordHash;
  assert(hashBefore === hashAfter, 'User.update strips passwordHash from entity PATCH');
  await prisma.user.delete({ where: { id: sec2Target.id } });

  // M15 #19 — cannot promote to admin via User.update
  let adminRoleDenied = false;
  try {
    await store.update('User', owner.id, { role: 'admin' }, admin);
  } catch (e) {
    adminRoleDenied = e.status === 403;
  }
  // owner may not exist as real user — create temp if needed
  if (!adminRoleDenied) {
    // store.update User requires real DB user; skip soft if not found
    try {
      const tmp = await prisma.user.create({
        data: {
          email: `m15-19-${Date.now()}@test.com`,
          fullName: 'T',
          role: 'owner',
          registered: true,
        },
      });
      try {
        await store.update('User', tmp.id, { role: 'admin' }, admin);
      } catch (e) {
        adminRoleDenied = e.status === 403;
      }
      const after = await store.get('User', tmp.id, admin);
      assert(after.role === 'owner', 'User.role stayed owner after denied admin promote');
      await store.update('User', tmp.id, { role: 'user' }, admin);
      const demoted = await store.get('User', tmp.id, admin);
      assert(demoted.role === 'user', 'admin may set role to user');
      await prisma.user.delete({ where: { id: tmp.id } });
    } catch (e) {
      console.error(e);
      adminRoleDenied = false;
    }
  }
  assert(adminRoleDenied, 'User.update role=admin → 403 (#19)');

  // SEC-003 — Promotion RLS
  assert(can('Promotion', 'read', anon, { owner_id: owner.id }) === true, 'Promotion anon read');
  assert(can('Promotion', 'create', anon, { owner_id: owner.id }) === false, 'Promotion anon create deny');
  assert(can('Promotion', 'create', owner, { owner_id: owner.id }) === true, 'Promotion owner create');
  assert(can('Promotion', 'create', owner, { owner_id: 'other-owner' }) === false, 'Promotion owner create wrong owner_id');
  assert(can('Promotion', 'delete', stranger, { owner_id: owner.id }) === false, 'Promotion stranger delete deny');

  // SEC-004 — OwnerRequest admin-only
  assert(can('OwnerRequest', 'read', anon, { user_email: 'x@t.com' }) === false, 'OwnerRequest anon read deny');
  assert(can('OwnerRequest', 'create', owner, { user_email: 'x@t.com' }) === false, 'OwnerRequest owner create deny');
  assert(can('OwnerRequest', 'create', admin, { user_email: 'x@t.com' }) === true, 'OwnerRequest admin create');
  assert(readScopeWhere('OwnerRequest', anon) === false, 'OwnerRequest anon empty scope');

  // SEC-007/008 — forged owner_id rejected at store
  const zForged = await store.create(
    'Zimmer',
    { name: 'z-forged', owner_id: 'owner-1' },
    { actor: SERVICE_ACTOR },
  );
  let forgedBookingDenied = false;
  try {
    await store.create(
      'BookingRequest',
      {
        zimmer_id: zForged.id,
        owner_id: 'other-owner',
        guest_name: 'Spam',
        guest_phone: '050',
        check_in: '2026-11-01',
        check_out: '2026-11-03',
        status: 'ממתינה',
      },
      { actor: customer },
    );
  } catch (e) {
    forgedBookingDenied = e.status === 403;
  }
  assert(forgedBookingDenied, 'SEC-007 forged owner_id on BookingRequest → 403');

  let forgedQuestionDenied = false;
  try {
    await store.create(
      'UnansweredQuestion',
      {
        zimmer_id: zForged.id,
        zimmer_name: 'z-forged',
        owner_id: 'other-owner',
        question: 'spam?',
      },
      { actor: customer },
    );
  } catch (e) {
    forgedQuestionDenied = e.status === 403;
  }
  assert(forgedQuestionDenied, 'SEC-008 forged owner_id on UnansweredQuestion → 403');

  const legitBooking = await store.create(
    'BookingRequest',
    {
      zimmer_id: zForged.id,
      owner_id: 'owner-1',
      guest_name: 'Ok',
      guest_phone: '050',
      check_in: '2026-12-01',
      check_out: '2026-12-03',
      status: 'ממתינה',
    },
    { actor: customer },
  );
  assert(legitBooking.owner_id === 'owner-1', 'SEC-007 server sets owner_id from zimmer');
  await store.delete('BookingRequest', legitBooking.id, admin);

  let forgedChatDenied = false;
  try {
    await store.create(
      'DirectChat',
      {
        zimmer_id: zForged.id,
        customer_id: 'cust-1',
        owner_id: 'other-owner',
        messages: [],
      },
      { actor: customer },
    );
  } catch (e) {
    forgedChatDenied = e.status === 403;
  }
  assert(forgedChatDenied, 'SEC-008 forged owner_id on DirectChat → 403');

  // Scope
  assert(readScopeWhere('SystemMessage', anon) === false, 'SystemMessage anon → empty scope');
  assert(readScopeWhere('Zimmer', anon) === null, 'Zimmer scope unrestricted');
  const chatScope = readScopeWhere('DirectChat', customer);
  assert(chatScope && chatScope.OR, 'DirectChat customer gets OR scope');
  assert(readScopeWhere('DirectChat', admin) === null, 'DirectChat admin unrestricted');
  assert(readScopeWhere('DirectChat', anon) === false, 'DirectChat anon → empty scope');

  // Store integration — resolve owner_id from real Zimmer
  const created = await store.create(
    'DirectChat',
    {
      zimmer_id: zForged.id,
      customer_id: 'cust-1',
      owner_id: 'owner-1',
      messages: [],
    },
    { actor: customer },
  );
  assert(created.id, 'create DirectChat as customer');
  assert(created.owner_id === 'owner-1', 'DirectChat owner_id resolved from zimmer');

  const asCustomer = await store.list('DirectChat', '-created_date', 50, customer);
  assert(asCustomer.some((r) => r.id === created.id), 'customer lists own chat');

  const asStranger = await store.list('DirectChat', '-created_date', 50, stranger);
  assert(!asStranger.some((r) => r.id === created.id), 'stranger does not see chat');

  let denied = false;
  try {
    await store.get('DirectChat', created.id, stranger);
  } catch (e) {
    denied = e.status === 403;
  }
  assert(denied, 'stranger get → 403');

  const asAdmin = await store.get('DirectChat', created.id, admin);
  assert(asAdmin.id === created.id, 'admin get ok');

  await store.delete('DirectChat', created.id, admin);
  await store.delete('Zimmer', zForged.id, admin);

  // SystemMessage write — admin only (#20)
  const msg = await store.create(
    'SystemMessage',
    { audience: 'customer', title: 'בדיקה', body: 'תוכן', target_user_ids: [] },
    { actor: admin },
  );
  assert(msg.id, 'admin creates SystemMessage');

  let msgDenied = false;
  try {
    await store.create(
      'SystemMessage',
      { audience: 'customer', title: 'x', body: 'y' },
      { actor: owner },
    );
  } catch (e) {
    msgDenied = e.status === 403;
  }
  assert(msgDenied, 'owner cannot create SystemMessage');

  let userDenied = false;
  try {
    await store.create(
      'SystemMessage',
      { audience: 'customer', title: 'x', body: 'y' },
      { actor: customer },
    );
  } catch (e) {
    userDenied = e.status === 403;
  }
  assert(userDenied, 'customer cannot create SystemMessage');

  const openList = await store.list('SystemMessage', '-created_date', 10, anon);
  assert(!openList.some((r) => r.id === msg.id), 'anon cannot list SystemMessage');

  const custList = await store.list('SystemMessage', '-created_date', 30, customer);
  assert(custList.some((r) => r.id === msg.id), 'customer lists broadcast SystemMessage');

  const targeted = await store.create(
    'SystemMessage',
    {
      audience: 'customer',
      title: 'פרטי',
      body: 'רק ללקוח',
      target_user_ids: ['cust-1'],
    },
    { actor: admin },
  );
  const strangerSys = await store.list('SystemMessage', '-created_date', 50, stranger);
  assert(!strangerSys.some((r) => r.id === targeted.id), 'stranger does not see targeted SystemMessage');
  const custTargeted = await store.list('SystemMessage', '-created_date', 50, customer);
  assert(custTargeted.some((r) => r.id === targeted.id), 'customer sees own targeted SystemMessage');

  await store.delete('SystemMessage', targeted.id, admin);
  // ChatSession store — stranger/anon must not see other users' history
  const sess = await store.create(
    'ChatSession',
    { user_id: 'cust-1', user_name: 'C', messages: [{ role: 'user', content: 'hi' }] },
    { actor: customer },
  );
  assert(sess.id, 'create ChatSession as owner');
  const sessMine = await store.list('ChatSession', '-created_date', 50, customer);
  assert(sessMine.some((r) => r.id === sess.id), 'owner lists own ChatSession');
  const sessStranger = await store.list('ChatSession', '-created_date', 50, stranger);
  assert(!sessStranger.some((r) => r.id === sess.id), 'stranger does not list ChatSession');
  const sessAnon = await store.list('ChatSession', '-created_date', 50, anon);
  assert(!sessAnon.some((r) => r.id === sess.id), 'anon does not list ChatSession');
  let sessDenied = false;
  try {
    await store.get('ChatSession', sess.id, stranger);
  } catch (e) {
    sessDenied = e.status === 403;
  }
  assert(sessDenied, 'stranger get ChatSession → 403');
  await store.delete('ChatSession', sess.id, admin);

  await store.delete('SystemMessage', msg.id, admin);

  // Zimmer — open read; owner/admin mutate only
  const z = await store.create(
    'Zimmer',
    { name: 'authz-zimmer', owner_id: owner.id },
    { actor: owner },
  );
  assert(z.approval_status === 'אושר', 'Zimmer defaults still apply');
  let zStrangerDenied = false;
  try {
    await store.update('Zimmer', z.id, { name: 'hacked' }, stranger);
  } catch (e) {
    zStrangerDenied = e.status === 403;
  }
  assert(zStrangerDenied, 'stranger Zimmer update → 403');

  // SEC-010 — owner cannot self-approve zimmer via approval_status patch
  const pendingZ = await store.create(
    'Zimmer',
    { name: 'pending-z', owner_id: owner.id, approval_status: 'ממתין לאישור' },
    { actor: owner },
  );
  const zSelfApprove = await store.update(
    'Zimmer',
    pendingZ.id,
    { approval_status: 'אושר' },
    owner,
  );
  assert(zSelfApprove.approval_status === 'ממתין לאישור', 'SEC-010 owner approval_status patch stripped');

  // SEC-017 — data_zones redacted for non-owner reads
  const secretZ = await store.create(
    'Zimmer',
    {
      name: 'secret-z',
      owner_id: owner.id,
      data_zones: [{ content: 'secret owner notes', source_type: 'טקסט חופשי' }],
      info_summary: 'public summary',
    },
    { actor: owner },
  );
  const anonView = await store.get('Zimmer', secretZ.id, anon);
  assert(
    !anonView.data_zones?.length && anonView.info_summary === 'public summary',
    'SEC-017 anon Zimmer read strips data_zones, keeps info_summary',
  );
  const ownerView = await store.get('Zimmer', secretZ.id, owner);
  assert(ownerView.data_zones?.length === 1, 'SEC-017 owner sees data_zones');

  await store.delete('Zimmer', pendingZ.id, owner);
  await store.delete('Zimmer', secretZ.id, owner);
  await store.delete('Zimmer', z.id, owner);

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll authz smoke checks passed');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
