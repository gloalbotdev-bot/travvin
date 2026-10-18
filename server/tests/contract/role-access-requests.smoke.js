/**
 * Dual-role intent + RoleAccessRequest create / decide.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import {
  normalizeAuthIntent,
  roleMatchesIntent,
  resolveSessionRole,
  parseAllowedRoles,
} from '../../src/lib/auth-role-intent.js';
import { signToken, signRoleAccessRequestToken, verifyRoleAccessRequestToken } from '../../src/lib/jwt.js';
import { createUserStore } from '../../src/lib/user-store.js';
import { createEntityStore } from '../../src/lib/entity-store.js';
import { createAuthMiddleware } from '../../src/middleware/auth.js';
import { createRoleAccessRequestsRouter } from '../../src/routes/role-access-requests.js';

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
  assert(roleMatchesIntent('user', 'owner') === false, 'user blocked from owner');
  assert(roleMatchesIntent('user', 'owner', ['user', 'owner']) === true, 'dual user→owner ok');
  assert(roleMatchesIntent('owner', 'user', ['user', 'owner']) === true, 'dual owner→user ok');
  assert(roleMatchesIntent('owner', 'user', null) === false, 'owner without dual blocked');
  assert(resolveSessionRole({ role: 'user', allowedRoles: ['user', 'owner'] }, 'owner') === 'owner', 'session owner');
  assert(resolveSessionRole({ role: 'user', allowedRoles: ['user', 'owner'] }, 'user') === 'user', 'session user');
  assert(resolveSessionRole({ role: 'admin' }, 'user') === 'user', 'admin session as user');
  assert(parseAllowedRoles(['user', 'owner', 'nope']).join(',') === 'user,owner', 'parse allowed');

  const tok = signRoleAccessRequestToken({
    userId: '00000000-0000-4000-8000-000000000001',
    email: 'a@b.com',
    fromRole: 'user',
    toRole: 'owner',
  });
  const claims = verifyRoleAccessRequestToken(tok);
  assert(claims?.toRole === 'owner' && claims?.fromRole === 'user', 'request token roundtrip');

  const prisma = new PrismaClient();
  const users = createUserStore(prisma);
  const store = createEntityStore(prisma);
  const stamp = Date.now();
  const userEmail = `rar-user-${stamp}@example.com`;
  const adminEmail = `rar-admin-${stamp}@example.com`;

  await prisma.user.deleteMany({
    where: { email: { in: [userEmail, adminEmail] } },
  });

  const userRow = await prisma.user.create({
    data: {
      email: userEmail,
      role: 'user',
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
  app.use('/api/role-access-requests', createRoleAccessRequestsRouter(prisma, store));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const requestToken = signRoleAccessRequestToken({
    userId: userRow.id,
    email: userEmail,
    fromRole: 'user',
    toRole: 'owner',
  });

  const created = await fetch(`${base}/api/role-access-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_token: requestToken }),
  });
  const createdBody = await created.json();
  assert(created.status === 201 || created.status === 200, `create request → ${created.status}`);
  assert(createdBody.status === 'pending', 'request pending');
  assert(createdBody.to_role === 'owner', 'to_role owner');

  const dup = await fetch(`${base}/api/role-access-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_token: requestToken }),
  });
  const dupBody = await dup.json();
  assert(dup.ok, 'duplicate pending ok');
  assert(dupBody.already_pending === true || dupBody.id === createdBody.id, 'duplicate soft');

  const adminTok = signToken(users.toAuth(adminRow));
  const decide = await fetch(`${base}/api/role-access-requests/${createdBody.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminTok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ decision: 'both' }),
  });
  const decided = await decide.json();
  assert(decide.ok, `decide both → ${decide.status}`);
  assert(decided.status === 'approved_both', 'approved_both');

  const refreshed = await prisma.user.findUnique({ where: { id: userRow.id } });
  const allowed = parseAllowedRoles(refreshed.allowedRoles);
  assert(allowed.includes('user') && allowed.includes('owner'), 'allowed_roles set');

  // cleanup RoleAccessRequest records
  try {
    const pending = await store.filter(
      'RoleAccessRequest',
      { user_id: userRow.id },
      '-created_date',
      20,
      { id: adminRow.id, email: adminEmail, role: 'admin' },
    );
    for (const r of pending) {
      await store.delete('RoleAccessRequest', r.id, {
        actor: { id: adminRow.id, email: adminEmail, role: 'admin' },
      });
    }
  } catch {
    /* ignore cleanup errors */
  }

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await prisma.user.deleteMany({
    where: { email: { in: [userEmail, adminEmail] } },
  });
  await prisma.$disconnect();

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll role-access-requests smoke checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
