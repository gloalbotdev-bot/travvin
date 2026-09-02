/**
 * Phase 8 — creator/editor assistant profiles smoke.
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
import {
  parseAdminZimmerEditorResponse,
  parseOwnerBookingCreatorResponse,
  parseOwnerZimmerCreatorResponse,
} from '../../src/lib/assistant/response-parser/creator.js';

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
  const editorParsed = parseAdminZimmerEditorResponse({
    action: 'update',
    message: 'שינויים',
    changes: { price_per_night: 500 },
  });
  assert(editorParsed.parsed.action === 'update', 'editor parser keeps action');
  assert(
    editorParsed.uiEffects.some((e) => e.type === 'zimmer_changes_preview'),
    'editor parser emits changes preview',
  );

  const bookingParsed = parseOwnerBookingCreatorResponse({
    action: 'create',
    message: 'מוכן',
    booking: { guest_name: 'x' },
  });
  assert(
    bookingParsed.uiEffects.some((e) => e.type === 'booking_preview'),
    'booking parser emits booking preview',
  );

  const zimmerParsed = parseOwnerZimmerCreatorResponse({
    action: 'build',
    message: 'בנה',
    zimmer_data: { name: 'חדש' },
  });
  assert(
    zimmerParsed.uiEffects.some((e) => e.type === 'zimmer_preview'),
    'zimmer creator parser emits zimmer preview',
  );
}

async function mainHttp() {
  const stamp = Date.now();
  const ownerEmail = `creator-owner-${stamp}@example.com`;

  await prisma.user.deleteMany({ where: { email: ownerEmail } });

  const ownerRow = await prisma.user.create({
    data: {
      email: ownerEmail,
      role: 'owner',
      registered: true,
      emailVerified: true,
      fullName: 'בעל Creator',
    },
  });

  const zimmer = await store.create(
    'Zimmer',
    {
      name: `Creator Zimmer ${stamp}`,
      location: 'גליל',
      approval_status: 'אושר',
      max_guests: 4,
      price_per_night: 800,
      owner_id: ownerRow.id,
      data_zones: [{ source_type: 'טקסט חופשי', content: 'בריכה' }],
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

  const editorRes = await chat(base, ownerTok, {
    profile: 'admin_zimmer_editor',
    message: 'MOCK_ZIMMER_EDITOR_UPDATE',
    clientState: { zimmerId: zimmer.id },
  });
  assert(editorRes.status === 200, 'admin_zimmer_editor → 200');
  assert(editorRes.json?.meta?.phase === 8, 'admin_zimmer_editor meta.phase === 8');
  assert(editorRes.json?.meta?.parsed?.action === 'update', 'editor mock returns update');

  const bookingRes = await chat(base, ownerTok, {
    profile: 'owner_booking_creator',
    message: 'MOCK_BOOKING_CREATE',
    clientState: { ownerId: ownerRow.id },
  });
  assert(bookingRes.status === 200, 'owner_booking_creator → 200');
  assert(bookingRes.json?.meta?.phase === 8, 'owner_booking_creator meta.phase === 8');
  assert(bookingRes.json?.meta?.parsed?.action === 'create', 'booking mock returns create');

  const zimmerRes = await chat(base, ownerTok, {
    profile: 'owner_zimmer_creator',
    message: 'MOCK_ZIMMER_BUILD',
    clientState: { conversationData: {} },
  });
  assert(zimmerRes.status === 200, 'owner_zimmer_creator → 200');
  assert(zimmerRes.json?.meta?.phase === 8, 'owner_zimmer_creator meta.phase === 8');
  assert(zimmerRes.json?.meta?.parsed?.action === 'build', 'zimmer creator mock returns build');

  const knowledgeRes = await chat(base, ownerTok, {
    profile: 'owner_zimmer_knowledge_summary',
    message: 'סכם',
    clientState: { zimmerId: zimmer.id },
  });
  assert(knowledgeRes.status === 200, 'owner_zimmer_knowledge_summary → 200');
  assert(knowledgeRes.json?.meta?.phase === 8, 'knowledge summary meta.phase === 8');
  assert(typeof knowledgeRes.json?.message?.content === 'string', 'knowledge summary text');

  server.close();
  await prisma.user.deleteMany({ where: { email: ownerEmail } });
  await prisma.$disconnect();
}

async function main() {
  mainUnit();
  await mainHttp();
  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log('\nAll Phase 8 creator checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
