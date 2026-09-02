/**
 * Phase 7 — one-shot assistant profiles (tips, summaries, vacation agent).
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
  const ownerEmail = `oneshot-owner-${stamp}@example.com`;
  const adminEmail = `oneshot-admin-${stamp}@example.com`;
  const customerEmail = `oneshot-cust-${stamp}@example.com`;

  await prisma.user.deleteMany({
    where: { email: { in: [ownerEmail, adminEmail, customerEmail] } },
  });

  const ownerRow = await prisma.user.create({
    data: {
      email: ownerEmail,
      role: 'owner',
      registered: true,
      emailVerified: true,
      fullName: 'בעל OneShot',
    },
  });
  const adminRow = await prisma.user.create({
    data: {
      email: adminEmail,
      role: 'admin',
      registered: true,
      emailVerified: true,
      fullName: 'אדמין OneShot',
    },
  });
  const customerRow = await prisma.user.create({
    data: {
      email: customerEmail,
      role: 'user',
      registered: true,
      emailVerified: true,
      fullName: 'לקוח OneShot',
    },
  });

  const zimmer = await store.create(
    'Zimmer',
    {
      name: `Oneshot Zimmer ${stamp}`,
      location: 'גליל',
      approval_status: 'אושר',
      max_guests: 4,
      price_per_night: 800,
      owner_id: ownerRow.id,
      data_zones: [
        { source_type: 'טקסט חופשי', content: 'בריכה מחוממת וג\'קוזי' },
        { source_type: 'שיחת וואטסאפ', content: 'כניסה מ-15:00 יציאה עד 11:00' },
      ],
    },
    { actor: SERVICE_ACTOR },
  );

  const session = await store.create(
    'ChatSession',
    {
      user_id: customerRow.id,
      user_email: customerEmail,
      user_name: 'לקוח OneShot',
      messages: [
        { role: 'user', content: 'מחפש צימר בגליל ל-2 לילות' },
        { role: 'assistant', content: 'הנה כמה אפשרויות בגליל' },
      ],
      zimmer_ids_shown: [zimmer.id],
      booking_created: false,
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

  const ownerTok = signToken(users.toAuth(ownerRow));
  const adminTok = signToken(users.toAuth(adminRow));
  const customerTok = signToken(users.toAuth(customerRow));

  const tipsRes = await chat(base, ownerTok, {
    profile: 'owner_tips',
    message: 'המלצות לשיפור העסק',
    clientState: { ownerId: ownerRow.id },
  });
  assert(tipsRes.status === 200, 'owner_tips → 200');
  assert(tipsRes.json?.meta?.phase === 7, 'owner_tips meta.phase === 7');
  assert(tipsRes.json?.meta?.stub !== true, 'owner_tips not stub');
  assert(typeof tipsRes.json?.message?.content === 'string', 'owner_tips returns text content');

  const summaryRes = await chat(base, adminTok, {
    profile: 'admin_session_summary',
    message: 'סכם את השיחה',
    clientState: { sessionId: session.id },
  });
  assert(summaryRes.status === 200, 'admin_session_summary → 200');
  assert(summaryRes.json?.meta?.phase === 7, 'admin_session_summary meta.phase === 7');
  assert(
    summaryRes.json?.executedActions?.[0]?.type === 'update_session_summary',
    'admin_session_summary returns update_session_summary action',
  );
  const updatedSession = await store.get('ChatSession', session.id, SERVICE_ACTOR);
  assert(
    typeof updatedSession.summary === 'string' && updatedSession.summary.length > 0,
    'ChatSession.summary persisted on server',
  );

  const infoRes = await chat(base, ownerTok, {
    profile: 'generate_info_summary',
    message: 'צור סיכום מידע',
    clientState: { zimmerId: zimmer.id, zoneIndices: [0, 1] },
  });
  assert(infoRes.status === 200, 'generate_info_summary → 200');
  assert(infoRes.json?.meta?.phase === 7, 'generate_info_summary meta.phase === 7');
  assert(typeof infoRes.json?.message?.content === 'string', 'generate_info_summary returns text');

  const vacationRes = await chat(base, customerTok, {
    profile: 'vacation_agent',
    message: 'המלץ על מסעדות בגליל',
    clientState: { recentTurns: [{ role: 'user', content: 'שלום' }] },
  });
  assert(vacationRes.status === 200, 'vacation_agent → 200');
  assert(vacationRes.json?.meta?.phase === 7, 'vacation_agent meta.phase === 7');

  const forbiddenRes = await chat(base, customerTok, {
    profile: 'admin_session_summary',
    message: 'סכם',
    clientState: { sessionId: session.id },
  });
  assert(forbiddenRes.status === 403, 'customer blocked from admin_session_summary');

  server.close();
  await prisma.user.deleteMany({
    where: { email: { in: [ownerEmail, adminEmail, customerEmail] } },
  });
  await prisma.$disconnect();

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log('\nAll Phase 7 oneshot checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
