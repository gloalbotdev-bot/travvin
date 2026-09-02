/**
 * HTTP integration smoke — SEC-006 syncGoogleCalendar auth bypass.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthMiddleware } from '../../src/middleware/auth.js';
import { createFunctionsRouter } from '../../src/routes/functions.js';
import { createEntityStore } from '../../src/lib/entity-store.js';
import { signToken } from '../../src/lib/jwt.js';
import { createUserStore } from '../../src/lib/user-store.js';

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

async function main() {
  const stamp = Date.now();
  const ownerEmail = `sec-fn-owner-${stamp}@example.com`;

  await prisma.user.deleteMany({ where: { email: ownerEmail } });

  const ownerRow = await prisma.user.create({
    data: {
      email: ownerEmail,
      role: 'owner',
      emailVerified: true,
      registered: true,
    },
  });

  const app = express();
  app.use(express.json());
  app.use(createAuthMiddleware(prisma));
  app.use('/api/functions', createFunctionsRouter(store, prisma));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const ownerTok = signToken(users.toAuth(ownerRow));

  const bypass = await fetch(`${base}/api/functions/syncGoogleCalendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      _from_workflow: true,
      owner_id: ownerRow.id,
    }),
  });
  assert(bypass.status === 401, 'SEC-006 _from_workflow without JWT → 401');

  const authed = await fetch(`${base}/api/functions/syncGoogleCalendar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerTok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  assert(
    authed.status === 200 || authed.status === 400 || authed.status === 503,
    `SEC-006 owner JWT sync → not 401 (got ${authed.status})`,
  );

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  await prisma.user.deleteMany({ where: { email: ownerEmail } });
  await prisma.$disconnect();

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll functions-http smoke checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
