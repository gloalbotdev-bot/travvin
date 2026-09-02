/**
 * Phase 5 — assistant conversation persistence smoke.
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

async function main() {
  const stamp = Date.now();
  const customerEmail = `conv-cust-${stamp}@example.com`;
  const ownerEmail = `conv-owner-${stamp}@example.com`;
  const strangerEmail = `conv-str-${stamp}@example.com`;

  await prisma.user.deleteMany({
    where: { email: { in: [customerEmail, ownerEmail, strangerEmail] } },
  });

  const customerRow = await prisma.user.create({
    data: { email: customerEmail, role: 'user', registered: true, emailVerified: true, fullName: 'לקוח בדיקה' },
  });
  const ownerRow = await prisma.user.create({
    data: { email: ownerEmail, role: 'owner', registered: true, emailVerified: true },
  });
  const strangerRow = await prisma.user.create({
    data: { email: strangerEmail, role: 'user', registered: true, emailVerified: true },
  });

  await store.create(
    'Zimmer',
    {
      name: `Conv Test ${stamp}`,
      location: 'גליל עליון',
      approval_status: 'אושר',
      max_guests: 4,
      price_per_night: 900,
      owner_id: ownerRow.id,
    },
    { actor: SERVICE_ACTOR },
  );

  const app = express();
  app.use(express.json());
  app.use(createAuthMiddleware(prisma));
  app.use('/api/assistant', createAssistantRouter({ prisma, store }));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const customerTok = signToken(users.toAuth(customerRow));
  const ownerTok = signToken(users.toAuth(ownerRow));
  const strangerTok = signToken(users.toAuth(strangerRow));

  const clientState = {
    searchDates: {
      checkIn: '2030-06-01',
      checkOut: '2030-06-03',
      numGuests: 2,
      num_adults: 2,
      num_children: 0,
    },
  };

  const guestRes = await chat(base, null, {
    profile: 'customer_chat',
    message: 'שלום',
    clientState,
  });
  assert(guestRes.status === 200, 'guest chat → 200');
  assert(guestRes.json?.conversationId == null, 'guest has no conversationId');
  assert(guestRes.json?.meta?.phase === 5, 'guest meta.phase === 5');

  const first = await chat(base, customerTok, {
    profile: 'customer_chat',
    message: 'שלום, יש צימרים?',
    clientState,
  });
  assert(first.status === 200, 'customer first chat → 200');
  assert(first.json?.conversationId, 'customer gets conversationId');
  const convId = first.json.conversationId;

  const sessionAfterFirst = await store.get('ChatSession', convId, {
    id: customerRow.id,
    email: customerEmail,
    role: 'user',
  });
  assert(sessionAfterFirst.messages?.length === 2, 'ChatSession stores user+bot after first turn');

  const second = await chat(base, customerTok, {
    profile: 'customer_chat',
    message: 'ומה לגבי בריכה?',
    conversationId: convId,
    clientState: {
      ...clientState,
      recentTurns: [{ role: 'user', content: 'IGNORED WHEN SERVER HAS THREAD' }],
    },
  });
  assert(second.status === 200, 'customer second chat → 200');
  assert(second.json?.conversationId === convId, 'conversationId stable');

  const sessionAfterSecond = await store.get('ChatSession', convId, {
    id: customerRow.id,
    email: customerEmail,
    role: 'user',
  });
  assert(sessionAfterSecond.messages?.length === 4, 'ChatSession has 4 messages after second turn');
  assert(
    sessionAfterSecond.messages.some((m) => m.content?.includes('בריכה')),
    'second user message persisted',
  );

  const badConv = await chat(base, customerTok, {
    profile: 'customer_chat',
    message: 'x',
    conversationId: '00000000-0000-0000-0000-000000000099',
    clientState,
  });
  assert(badConv.status === 404, 'invalid conversationId → 404');

  const existing = await store.create(
    'ChatSession',
    {
      user_id: customerRow.id,
      user_name: 'לקוח בדיקה',
      user_email: customerEmail,
      messages: [{ role: 'user', content: 'private', time: new Date().toISOString() }],
    },
    { actor: { id: customerRow.id, email: customerEmail, role: 'user' } },
  );

  const hijack = await chat(base, strangerTok, {
    profile: 'customer_chat',
    message: 'hack',
    conversationId: existing.id,
    clientState,
  });
  assert(hijack.status === 404, 'stranger cannot use others conversationId → 404');

  await store.delete('ChatSession', existing.id, { actor: SERVICE_ACTOR }).catch(() => {});
  await store.delete('ChatSession', convId, { actor: SERVICE_ACTOR }).catch(() => {});

  const ownerRes = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'מה ההזמנות שלי?',
    clientState: { mode: 'info' },
  });
  assert(ownerRes.status === 200, 'owner stub chat → 200');

  const ownerLogs = await store.filter(
    'AssistantActionLog',
    { owner_id: ownerRow.id },
    '-created_date',
    5,
    { id: ownerRow.id, email: ownerEmail, role: 'owner' },
  );
  assert(ownerLogs.length >= 1, 'owner chat_turn logged in AssistantActionLog');
  assert(ownerLogs[0].profile === 'owner_assistant', 'action log profile set');

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  await prisma.user.deleteMany({
    where: { email: { in: [customerEmail, ownerEmail, strangerEmail] } },
  });
  await prisma.$disconnect();

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll assistant-conversation smoke checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
