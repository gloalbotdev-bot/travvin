/**
 * Video port + guest summary HTTP smoke tests.
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

process.env.LLM_MOCK = '1';

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
  const ownerEmail = `video-owner-${stamp}@example.com`;
  const otherEmail = `video-other-${stamp}@example.com`;

  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });

  const ownerRow = await prisma.user.create({
    data: { email: ownerEmail, role: 'owner', emailVerified: true, registered: true },
  });
  const otherRow = await prisma.user.create({
    data: { email: otherEmail, role: 'owner', emailVerified: true, registered: true },
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
  const otherTok = signToken(users.toAuth(otherRow));

  const feedPublic = await fetch(`${base}/api/functions/getVideoFeed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert(feedPublic.status === 200, 'getVideoFeed public → 200');
  const feedBody = await feedPublic.json();
  assert(feedBody.ok === true && Array.isArray(feedBody.videos), 'getVideoFeed returns videos array');

  const likeAnon = await fetch(`${base}/api/functions/toggleVideoLike`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: 'v-test' }),
  });
  assert(likeAnon.status === 401, 'toggleVideoLike without auth → 401');

  const summaryForbidden = await fetch(`${base}/api/functions/buildGuestSummary`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${otherTok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      owner_id: ownerRow.id,
      guest_phone: '050-1234567',
    }),
  });
  assert(summaryForbidden.status === 403, 'buildGuestSummary wrong owner → 403');

  const internalCheckout = await fetch(`${base}/api/functions/autoCheckoutExpiredStays`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerTok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  assert(internalCheckout.status === 403, 'autoCheckoutExpiredStays → 403 internal only');

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  await prisma.$disconnect();

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll video-port smoke checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
