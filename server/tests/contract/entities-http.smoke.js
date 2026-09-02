/**
 * HTTP integration smoke — SEC-001 header spoof + SEC-002 User entity authz.
 * Usage (from server/): node tests/contract/entities-http.smoke.js
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthMiddleware } from '../../src/middleware/auth.js';
import { createEntitiesRouter } from '../../src/routes/entities.js';
import { createEntityStore } from '../../src/lib/entity-store.js';
import { signToken } from '../../src/lib/jwt.js';
import { createUserStore } from '../../src/lib/user-store.js';
import { hashPassword } from '../../src/lib/password.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const prisma = new PrismaClient();
const store = createEntityStore(prisma);
const users = createUserStore(prisma);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

const SPOOF_HEADERS = {
  'x-user-id': '00000000-0000-0000-0000-000000000001',
  'x-user-email': 'attacker@example.com',
  'x-user-role': 'admin',
  'Content-Type': 'application/json',
};

async function main() {
  const stamp = Date.now();
  const adminEmail = `sec-http-admin-${stamp}@example.com`;
  const customerEmail = `sec-http-cust-${stamp}@example.com`;
  const ownerEmail = `sec-http-owner-${stamp}@example.com`;
  const targetEmail = `sec-http-target-${stamp}@example.com`;

  await prisma.user.deleteMany({
    where: {
      email: { in: [adminEmail, customerEmail, ownerEmail, targetEmail] },
    },
  });

  const adminRow = await prisma.user.create({
    data: {
      email: adminEmail,
      role: 'admin',
      emailVerified: true,
      registered: true,
    },
  });
  const customerRow = await prisma.user.create({
    data: {
      email: customerEmail,
      role: 'user',
      emailVerified: true,
      registered: true,
    },
  });
  const ownerRow = await prisma.user.create({
    data: {
      email: ownerEmail,
      role: 'owner',
      emailVerified: true,
      registered: true,
    },
  });
  const targetRow = await prisma.user.create({
    data: {
      email: targetEmail,
      fullName: 'Target User',
      role: 'user',
      passwordHash: await hashPassword('OldPass123!'),
      emailVerified: true,
      registered: true,
    },
  });

  const customerActor = {
    id: customerRow.id,
    email: customerRow.email,
    role: 'user',
  };
  const session = await store.create(
    'ChatSession',
    {
      user_id: customerRow.id,
      user_name: 'Cust',
      messages: [{ role: 'user', content: 'hi' }],
    },
    { actor: customerActor },
  );

  const app = express();
  app.use(express.json());
  app.use(createAuthMiddleware(prisma));
  app.use('/api/entities', createEntitiesRouter(store));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const adminTok = signToken(users.toAuth(adminRow));
  const ownerTok = signToken(users.toAuth(ownerRow));

  // --- SEC-001 ---
  const spoofGet = await fetch(`${base}/api/entities/ChatSession/${session.id}`, {
    headers: SPOOF_HEADERS,
  });
  assert(spoofGet.status === 403, 'SEC-001 spoof headers GET ChatSession → 403');

  const spoofList = await fetch(`${base}/api/entities/ChatSession`, {
    headers: SPOOF_HEADERS,
  });
  const spoofListBody = spoofList.ok ? await spoofList.json() : [];
  assert(
    spoofList.status === 200 && Array.isArray(spoofListBody) && spoofListBody.length === 0,
    'SEC-001 spoof headers list ChatSession → 200 []',
  );

  const adminGet = await fetch(`${base}/api/entities/ChatSession/${session.id}`, {
    headers: { Authorization: `Bearer ${adminTok}` },
  });
  assert(adminGet.status === 200, 'SEC-001 admin JWT GET ChatSession → 200');

  const guestZimmer = await fetch(`${base}/api/entities/Zimmer?limit=1`);
  assert(guestZimmer.status === 200, 'SEC-001 guest GET Zimmer → 200');

  const spoofPatch = await fetch(`${base}/api/entities/ChatSession/${session.id}`, {
    method: 'PATCH',
    headers: { ...SPOOF_HEADERS },
    body: JSON.stringify({ summary: 'hacked by spoof headers' }),
  });
  assert(spoofPatch.status === 403, 'SEC-001 spoof headers PATCH ChatSession → 403');

  const spoofPostMsg = await fetch(`${base}/api/entities/SystemMessage`, {
    method: 'POST',
    headers: { ...SPOOF_HEADERS },
    body: JSON.stringify({
      audience: 'customer',
      title: 'Spoof admin',
      body: 'Should not create',
      target_user_ids: [],
    }),
  });
  assert(spoofPostMsg.status === 403, 'SEC-001 spoof headers POST SystemMessage → 403');

  const spoofDeletePromo = await fetch(`${base}/api/entities/Promotion/fake-id`, {
    method: 'DELETE',
    headers: SPOOF_HEADERS,
  });
  assert(
    spoofDeletePromo.status !== 200,
    `SEC-001 spoof headers DELETE Promotion → not 200 (got ${spoofDeletePromo.status})`,
  );

  const spoofFilter = await fetch(`${base}/api/entities/DirectChat/filter`, {
    method: 'POST',
    headers: { ...SPOOF_HEADERS },
    body: JSON.stringify({ owner_id: ownerRow.id }),
  });
  const spoofFilterBody = spoofFilter.ok ? await spoofFilter.json() : [];
  assert(
    spoofFilter.status === 200 &&
      Array.isArray(spoofFilterBody) &&
      spoofFilterBody.length === 0,
    'SEC-001 spoof headers filter DirectChat → 200 []',
  );

  // --- SEC-002 ---
  const anonUserList = await fetch(`${base}/api/entities/User`);
  assert(anonUserList.status === 403, 'SEC-002 anon GET User → 403');

  const anonUserGet = await fetch(`${base}/api/entities/User/${targetRow.id}`);
  assert(anonUserGet.status === 403, 'SEC-002 anon GET User/:id → 403');

  const anonUserPost = await fetch(`${base}/api/entities/User`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `new-${stamp}@example.com`, role: 'user' }),
  });
  assert(anonUserPost.status === 403, 'SEC-002 anon POST User → 403');

  const anonUserPatch = await fetch(`${base}/api/entities/User/${targetRow.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwordHash: 'hacked' }),
  });
  assert(anonUserPatch.status === 403, 'SEC-002 anon PATCH User → 403');

  const anonUserDelete = await fetch(`${base}/api/entities/User/${targetRow.id}`, {
    method: 'DELETE',
  });
  assert(anonUserDelete.status === 403, 'SEC-002 anon DELETE User → 403');

  const ownerUserList = await fetch(`${base}/api/entities/User`, {
    headers: { Authorization: `Bearer ${ownerTok}` },
  });
  assert(ownerUserList.status === 403, 'SEC-002 owner JWT GET User → 403');

  const customerTok = signToken(users.toAuth(customerRow));
  const customerUserList = await fetch(`${base}/api/entities/User`, {
    headers: { Authorization: `Bearer ${customerTok}` },
  });
  assert(customerUserList.status === 403, 'SEC-002 customer JWT GET User → 403');

  const customerUserGet = await fetch(`${base}/api/entities/User/${targetRow.id}`, {
    headers: { Authorization: `Bearer ${customerTok}` },
  });
  assert(customerUserGet.status === 403, 'SEC-002 customer JWT GET User/:id → 403');

  const adminUserList = await fetch(`${base}/api/entities/User`, {
    headers: { Authorization: `Bearer ${adminTok}` },
  });
  assert(adminUserList.status === 200 && Array.isArray(await adminUserList.json()), 'SEC-002 admin JWT GET User → 200');

  const adminUserGet = await fetch(`${base}/api/entities/User/${targetRow.id}`, {
    headers: { Authorization: `Bearer ${adminTok}` },
  });
  const adminUserBody = adminUserGet.ok ? await adminUserGet.json() : {};
  assert(adminUserGet.status === 200, 'SEC-002 admin JWT GET User/:id → 200');
  assert(
    adminUserBody.passwordHash === undefined && adminUserBody.password_hash === undefined,
    'SEC-002 User entity response never includes passwordHash',
  );

  const adminPatchName = await fetch(`${base}/api/entities/User/${targetRow.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminTok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ full_name: 'Updated Name' }),
  });
  assert(adminPatchName.status === 200, 'SEC-002 admin PATCH full_name → 200');

  const beforeHash = (await prisma.user.findUnique({ where: { id: targetRow.id } }))
    ?.passwordHash;
  const adminPatchHash = await fetch(`${base}/api/entities/User/${targetRow.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminTok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ passwordHash: 'totally-different-hash' }),
  });
  const afterHash = (await prisma.user.findUnique({ where: { id: targetRow.id } }))
    ?.passwordHash;
  assert(adminPatchHash.status === 200, 'SEC-002 admin PATCH passwordHash → 200');
  assert(beforeHash === afterHash, 'SEC-002 passwordHash unchanged after entity PATCH');

  const deleteRow = await prisma.user.create({
    data: {
      email: `sec-http-del-${stamp}@example.com`,
      role: 'user',
      registered: true,
      emailVerified: true,
    },
  });
  const adminDelete = await fetch(`${base}/api/entities/User/${deleteRow.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminTok}` },
  });
  assert(adminDelete.status === 200, 'SEC-002 admin DELETE User → 200');

  // --- SEC-003 Promotion ---
  const promo = await store.create(
    'Promotion',
    {
      zimmer_id: 'z-sec-http',
      zimmer_name: 'Z',
      owner_id: ownerRow.id,
      check_in: '2026-06-01',
      check_out: '2026-06-10',
      discount_percent: 10,
      status: 'פעיל',
    },
    { actor: { id: ownerRow.id, email: ownerRow.email, role: 'owner' } },
  );
  const anonPromoRead = await fetch(`${base}/api/entities/Promotion/${promo.id}`);
  assert(anonPromoRead.status === 200, 'SEC-003 anon GET Promotion → 200');
  const anonPromoDelete = await fetch(`${base}/api/entities/Promotion/${promo.id}`, {
    method: 'DELETE',
  });
  assert(anonPromoDelete.status === 403, 'SEC-003 anon DELETE Promotion → 403');

  // --- SEC-004 OwnerRequest ---
  const ownerReq = await store.create(
    'OwnerRequest',
    {
      user_id: ownerRow.id,
      user_email: 'owner-req@test.com',
      user_name: 'Test',
      status: 'ממתינה',
    },
    { actor: { id: adminRow.id, email: adminRow.email, role: 'admin' } },
  );
  const anonOwnerReqGet = await fetch(`${base}/api/entities/OwnerRequest/${ownerReq.id}`);
  assert(anonOwnerReqGet.status === 403, 'SEC-004 anon GET OwnerRequest/:id → 403');
  const anonOwnerReqPost = await fetch(`${base}/api/entities/OwnerRequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: ownerRow.id,
      user_email: 'hack@test.com',
    }),
  });
  assert(anonOwnerReqPost.status === 403, 'SEC-004 anon POST OwnerRequest → 403');
  const adminOwnerReq = await fetch(`${base}/api/entities/OwnerRequest/${ownerReq.id}`, {
    headers: { Authorization: `Bearer ${adminTok}` },
  });
  assert(adminOwnerReq.status === 200, 'SEC-004 admin GET OwnerRequest/:id → 200');

  await store.delete('OwnerRequest', ownerReq.id, {
    id: adminRow.id,
    email: adminRow.email,
    role: 'admin',
  });
  await store.delete('Promotion', promo.id, {
    id: adminRow.id,
    email: adminRow.email,
    role: 'admin',
  });

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  await store.delete('ChatSession', session.id, {
    id: adminRow.id,
    email: adminRow.email,
    role: 'admin',
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [adminEmail, customerEmail, ownerEmail, targetEmail, `sec-http-del-${stamp}@example.com`],
      },
    },
  });
  await prisma.$disconnect();

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll entities-http smoke checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
