/**
 * Phase 6 — owner_assistant HTTP + dispatcher smoke.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthMiddleware } from '../../src/middleware/auth.js';
import { createAssistantRouter } from '../../src/routes/assistant.js';
import { createEntityStore } from '../../src/lib/entity-store.js';
import { signToken } from '../../src/lib/jwt.js';
import { createUserStore } from '../../src/lib/user-store.js';
import { SERVICE_ACTOR } from '../../src/lib/service-role.js';
import { parseOwnerAssistantResponse } from '../../src/lib/assistant/response-parser/owner-assistant.js';
import { prepareOwnerAssistantOperation } from '../../src/lib/assistant/action-dispatcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

process.env.LLM_MOCK = '1';
process.env.ASSISTANT_GUEST_RATE_LIMIT = '100';
process.env.ASSISTANT_AUTH_RATE_LIMIT = '100';

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

async function chat(base, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}/api/assistant/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = res.ok ? await res.json() : null;
  return { status: res.status, json };
}

function mainUnit() {
  const infoParsed = parseOwnerAssistantResponse(
    {
      message: 'מידע בלבד',
      operation: { type: 'create_zimmer', name: 'x' },
      actions: ['bookings'],
    },
    { mode: 'info' },
  );
  assert(infoParsed.operation === null, 'info mode strips operation');
  assert(
    infoParsed.uiEffects.some((e) => e.type === 'edit_mode_required'),
    'info mode flags edit_mode_required when LLM returned operation',
  );

  const zimmers = [{ id: 'z-1', name: 'נוף הגליל' }];
  const prepared = prepareOwnerAssistantOperation(
    { type: 'update_zimmer', zimmer_name: 'נוף', fields: { price_per_night: 600 } },
    zimmers,
  );
  assert(prepared.zimmer_id === 'z-1', 'prepareOwnerAssistantOperation resolves zimmer_id');
}

async function mainHttp() {
  const stamp = Date.now();
  const ownerEmail = `own-asst-${stamp}@example.com`;
  const customerEmail = `cust-asst-${stamp}@example.com`;

  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, customerEmail] } } });

  const ownerRow = await prisma.user.create({
    data: {
      email: ownerEmail,
      role: 'owner',
      registered: true,
      emailVerified: true,
      fullName: 'בעל בדיקה',
    },
  });
  const customerRow = await prisma.user.create({
    data: { email: customerEmail, role: 'user', registered: true, emailVerified: true },
  });

  const app = express();
  app.use(express.json());
  app.use(createAuthMiddleware(prisma));
  app.use('/api/assistant', createAssistantRouter({ prisma, store }));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const ownerTok = signToken(users.toAuth(ownerRow));
  const customerTok = signToken(users.toAuth(customerRow));

  const infoRes = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'מה ההזמנות שלי?',
    clientState: { mode: 'info', ownerId: ownerRow.id },
  });
  assert(infoRes.status === 200, 'owner info chat → 200');
  assert(infoRes.json?.meta?.phase === 6, 'owner_assistant meta.phase === 6');
  assert(infoRes.json?.meta?.stub !== true, 'owner_assistant no longer stub');
  assert(infoRes.json?.executedActions?.length === 0, 'info mode has no executedActions');

  const editRes = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'MOCK_EXECUTE_CREATE_ZIMMER',
    clientState: { mode: 'edit', ownerId: ownerRow.id },
  });
  assert(editRes.status === 200, 'owner edit mock create → 200');
  assert(editRes.json?.executedActions?.length === 1, 'edit mock creates zimmer via dispatcher');
  assert(
    editRes.json?.executedActions?.[0]?.kind === 'create_zimmer',
    'executedActions kind create_zimmer',
  );

  const zimmers = await store.filter(
    'Zimmer',
    { owner_id: ownerRow.id },
    '-created_date',
    10,
    { id: ownerRow.id, email: ownerEmail, role: 'owner' },
  );
  assert(zimmers.some((z) => z.name === 'צימר Mock בדיקה'), 'zimmer persisted in DB');

  const logs = await store.filter(
    'AssistantActionLog',
    { owner_id: ownerRow.id, action_type: 'create_zimmer' },
    '-created_date',
    5,
    { id: ownerRow.id, email: ownerEmail, role: 'owner' },
  );
  assert(logs.length >= 1, 'create_zimmer logged in AssistantActionLog');

  const denied = await chat(base, customerTok, {
    profile: 'owner_assistant',
    message: 'hack',
    clientState: { mode: 'info' },
  });
  assert(denied.status === 403, 'customer owner_assistant → 403');

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, customerEmail] } } });
}

async function main() {
  mainUnit();
  await mainHttp();
  await prisma.$disconnect();

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll assistant-owner smoke checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
