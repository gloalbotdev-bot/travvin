/**
 * Role-intent helpers + invite admin gate (role exclusivity).
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import {
  normalizeAuthIntent,
  roleForNewUser,
  roleMatchesIntent,
} from '../../src/lib/auth-role-intent.js';
import { createUsersRouter } from '../../src/routes/users.js';
import { createAuthMiddleware } from '../../src/middleware/auth.js';
import { signToken } from '../../src/lib/jwt.js';
import { createUserStore } from '../../src/lib/user-store.js';
import { requireCustomer } from '../../src/middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

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
  assert(normalizeAuthIntent('owner') === 'owner', 'normalize owner');
  assert(normalizeAuthIntent('admin') === 'admin', 'normalize admin');
  assert(normalizeAuthIntent('nope') === 'user', 'normalize default user');
  assert(roleForNewUser('user') === 'user', 'new user role');
  assert(roleForNewUser('owner') === 'owner', 'new owner role');
  assert(roleForNewUser('admin') === null, 'admin never auto-created');
  assert(roleMatchesIntent('user', 'user') === true, 'user matches user intent');
  assert(roleMatchesIntent('owner', 'user') === false, 'owner blocked from user intent');
  assert(roleMatchesIntent('user', 'owner') === false, 'user blocked from owner intent');
  assert(roleMatchesIntent('owner', 'owner') === true, 'owner matches owner intent');
  assert(roleMatchesIntent('admin', 'admin') === true, 'admin matches admin intent');
  assert(roleMatchesIntent('admin', 'user') === true, 'admin matches user intent');
  assert(roleMatchesIntent('admin', 'owner') === true, 'admin matches owner intent');
  assert(roleMatchesIntent('owner', 'admin') === false, 'owner blocked from admin intent');
  assert(roleMatchesIntent('user', 'admin') === false, 'user blocked from admin intent');
  assert(
    roleMatchesIntent('user', 'owner', ['user', 'owner']) === true,
    'dual-access user may owner intent',
  );
  assert(
    roleMatchesIntent('owner', 'user', ['user', 'owner']) === true,
    'dual-access owner may user intent',
  );

  // requireCustomer middleware shape
  let customerDenied = false;
  requireCustomer(
    { user: { id: 'o1', role: 'owner' } },
    {
      status(code) {
        assert(code === 403, 'requireCustomer owner → 403');
        return {
          json() {
            customerDenied = true;
          },
        };
      },
    },
    () => {
      customerDenied = false;
    },
  );
  assert(customerDenied, 'requireCustomer rejects owner');

  let customerOk = false;
  requireCustomer(
    { user: { id: 'c1', role: 'user' } },
    {
      status() {
        return { json() {} };
      },
    },
    () => {
      customerOk = true;
    },
  );
  assert(customerOk, 'requireCustomer allows user');

  let adminCustomerOk = false;
  requireCustomer(
    { user: { id: 'a1', role: 'admin' } },
    {
      status() {
        return { json() {} };
      },
    },
    () => {
      adminCustomerOk = true;
    },
  );
  assert(adminCustomerOk, 'requireCustomer allows admin');

  const prisma = new PrismaClient();
  const users = createUserStore(prisma);
  const stamp = Date.now();
  const ownerEmail = `role-owner-${stamp}@example.com`;
  const adminEmail = `role-admin-${stamp}@example.com`;
  const inviteEmail = `role-invite-${stamp}@example.com`;

  await prisma.user.deleteMany({
    where: { email: { in: [ownerEmail, adminEmail, inviteEmail] } },
  });

  const ownerRow = await prisma.user.create({
    data: {
      email: ownerEmail,
      role: 'owner',
      emailVerified: true,
      registered: true,
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

  const app = express();
  app.use(express.json());
  app.use(createAuthMiddleware(prisma));
  app.use('/api/users', createUsersRouter(prisma));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const ownerTok = signToken(users.toAuth(ownerRow));
  const adminTok = signToken(users.toAuth(adminRow));

  const asOwner = await fetch(`${base}/api/users/invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerTok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: inviteEmail, role: 'owner' }),
  });
  assert(asOwner.status === 403, 'invite as owner → 403');

  const asAdmin = await fetch(`${base}/api/users/invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminTok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: inviteEmail, role: 'owner' }),
  });
  const invited = await asAdmin.json();
  assert(asAdmin.ok, `invite as admin → ok (${asAdmin.status})`);
  assert(invited.role === 'owner', 'admin invite sets owner role');

  // Existing admin must not be demoted via owner invite
  const demoteAdmin = await fetch(`${base}/api/users/invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminTok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: adminEmail, role: 'owner' }),
  });
  assert(demoteAdmin.status === 409, 'invite owner on admin email → 409');
  const stillAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  assert(stillAdmin?.role === 'admin', 'admin role unchanged after demote attempt');

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await prisma.user.deleteMany({
    where: { email: { in: [ownerEmail, adminEmail, inviteEmail] } },
  });
  await prisma.$disconnect();

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll role-exclusivity smoke checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
