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
  const parsed = parseOwnerAssistantResponse(
    {
      message: 'מציע ליצור צימר',
      operation: { type: 'create_zimmer', name: 'x' },
      actions: ['bookings'],
    },
    {},
  );
  assert(parsed.operation?.type === 'create_zimmer', 'parser keeps operation (no mode)');
  assert(
    !parsed.uiEffects.some((e) => e.type === 'edit_mode_required'),
    'no edit_mode_required effect anymore',
  );
  const withForm = parseOwnerAssistantResponse(
    { message: 'פותח טופס', operation: null, actions: [], open_form: 'block' },
    { focus: { date: '2031-01-05' } },
  );
  assert(
    withForm.uiEffects.some((e) => e.type === 'open_form' && e.form === 'block' && e.date === '2031-01-05'),
    'open_form effect carries focus date',
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
    clientState: { ownerId: ownerRow.id },
  });
  assert(infoRes.status === 200, 'owner chat → 200');
  assert(infoRes.json?.meta?.phase === 6, 'owner_assistant meta.phase === 6');
  assert(infoRes.json?.meta?.stub !== true, 'owner_assistant no longer stub');
  assert(infoRes.json?.executedActions?.length === 0, 'plain chat has no executedActions');

  const proposeRes = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'MOCK_EXECUTE_CREATE_ZIMMER',
    clientState: { ownerId: ownerRow.id },
  });
  assert(proposeRes.status === 200, 'owner mock create → 200');
  assert(proposeRes.json?.executedActions?.length === 0, 'operation is not executed before confirmation');
  assert(
    proposeRes.json?.uiEffects?.some((e) => e.type === 'confirm_action' && e.opType === 'create_zimmer'),
    'operation returns confirm_action',
  );

  const zimmers = await store.filter(
    'Zimmer',
    { owner_id: ownerRow.id },
    '-created_date',
    10,
    { id: ownerRow.id, email: ownerEmail, role: 'owner' },
  );
  assert(!zimmers.some((z) => z.name === 'צימר Mock בדיקה'), 'zimmer not persisted before confirmation');

  const denied = await chat(base, customerTok, {
    profile: 'owner_assistant',
    message: 'hack',
    clientState: {},
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
