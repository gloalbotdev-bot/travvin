/**
 * AdminPermission create promotes User.role=admin; delete demotes when orphaned.
 * Usage (from server/): node tests/contract/admin-permission-promote.smoke.js
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createEntityStore } from '../../src/lib/entity-store.js';

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
  const stamp = Date.now();
  const adminActor = {
    id: `admin-actor-${stamp}`,
    email: `admin-actor-${stamp}@example.com`,
    role: 'admin',
  };
  const ownerActor = {
    id: `owner-actor-${stamp}`,
    email: `owner-actor-${stamp}@example.com`,
    role: 'owner',
  };

  const newEmail = `admin-new-${stamp}@example.com`;
  const ownerEmail = `admin-from-owner-${stamp}@example.com`;
  const deniedEmail = `admin-denied-${stamp}@example.com`;

  await prisma.user.deleteMany({
    where: { email: { in: [newEmail, ownerEmail, deniedEmail] } },
  });
  await prisma.record.deleteMany({
    where: {
      entityType: 'AdminPermission',
      OR: [
        { data: { path: ['email'], equals: newEmail } },
        { data: { path: ['email'], equals: ownerEmail } },
        { data: { path: ['email'], equals: deniedEmail } },
      ],
    },
  });

  await prisma.user.create({
    data: {
      email: ownerEmail,
      role: 'owner',
      registered: true,
      emailVerified: true,
    },
  });

  // 1) Admin creates AdminPermission → User.role=admin
  const created = await store.create(
    'AdminPermission',
    {
      email: newEmail,
      is_primary: false,
      is_active: true,
      allowed_pages: ['owners'],
    },
    { actor: adminActor },
  );
  assert(!!created.id, 'AdminPermission create returns id');
  assert(created.email === newEmail, 'email normalized on create');

  const promoted = await prisma.user.findUnique({ where: { email: newEmail } });
  assert(promoted?.role === 'admin', 'new email User.role=admin after AdminPermission create');
  assert(promoted?.registered === true, 'promoted user registered');

  // 2) Non-admin create → 403, no user
  let denied = false;
  try {
    await store.create(
      'AdminPermission',
      {
        email: deniedEmail,
        is_primary: false,
        is_active: true,
        allowed_pages: [],
      },
      { actor: ownerActor },
    );
  } catch (e) {
    denied = e.status === 403;
  }
  assert(denied, 'non-admin AdminPermission create → 403');
  const noUser = await prisma.user.findUnique({ where: { email: deniedEmail } });
  assert(!noUser, 'non-admin create did not promote/create user');

  // 3) Existing owner upgraded to admin
  const upgradedPerm = await store.create(
    'AdminPermission',
    {
      email: ownerEmail,
      is_primary: false,
      is_active: true,
      allowed_pages: ['owners'],
    },
    { actor: adminActor },
  );
  const upgraded = await prisma.user.findUnique({ where: { email: ownerEmail } });
  assert(upgraded?.role === 'admin', 'existing owner upgraded to admin');

  // 4) Delete last AdminPermission → demote to user
  await store.delete('AdminPermission', created.id, adminActor);
  const afterDelete = await prisma.user.findUnique({ where: { email: newEmail } });
  assert(afterDelete?.role === 'user', 'delete orphan AdminPermission demotes to user');

  // Owner email still has its permission — should stay admin
  const stillAdmin = await prisma.user.findUnique({ where: { email: ownerEmail } });
  assert(stillAdmin?.role === 'admin', 'other admin email unchanged after unrelated delete');

  await store.delete('AdminPermission', upgradedPerm.id, adminActor);
  const demotedOwner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  assert(demotedOwner?.role === 'user', 'delete last permission demotes former owner-admin to user');

  // Cleanup
  await prisma.user.deleteMany({
    where: { email: { in: [newEmail, ownerEmail, deniedEmail] } },
  });
  await prisma.record.deleteMany({
    where: {
      entityType: 'AdminPermission',
      OR: [
        { data: { path: ['email'], equals: newEmail } },
        { data: { path: ['email'], equals: ownerEmail } },
        { data: { path: ['email'], equals: deniedEmail } },
      ],
    },
  });
  await prisma.$disconnect();

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll admin-permission-promote smoke checks passed');
  }
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await prisma.$disconnect().catch(() => {});
});
