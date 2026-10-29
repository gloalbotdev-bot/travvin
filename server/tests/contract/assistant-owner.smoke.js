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
import {
  finalizeOwnerAssistantContent,
  parseOwnerAssistantResponse,
} from '../../src/lib/assistant/response-parser/owner-assistant.js';
import { prepareOwnerAssistantOperation } from '../../src/lib/assistant/action-dispatcher.js';
import { threadMemoryText } from '../../src/lib/assistant/owner-thread.js';
import { createPendingAction, shouldProposeOperation } from '../../src/lib/assistant/owner-actions.js';
import { mergeAmenitiesList } from '../../src/lib/owner-assistant-ops.js';

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
  const fromTool = parseOwnerAssistantResponse({
    message: 'מוצע לחסום',
    functionCalls: [{ name: 'block_dates', args: { zimmer_id: 'z', start_date: '2031-01-01' } }],
  });
  assert(fromTool.operation?.type === 'block_dates' && fromTool.operation.start_date === '2031-01-01', 'function call becomes an operation');
  const silentTool = parseOwnerAssistantResponse({
    message: '',
    functionCalls: [{ name: 'block_dates', args: { zimmer_id: 'z', start_date: '2031-01-02' } }],
  });
  assert(!/mock/.test(silentTool.content), 'a function call without text is not the mock fallback');
  assert(/כרטיס|אישור/.test(silentTool.content), 'a function call without text points at confirmation');
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

  const falseDone = finalizeOwnerAssistantContent('ההזמנה של כהן נוספה ב-12/10', { hasPendingAction: false });
  assert(falseDone.includes('נוספה'), 'informational past tense is kept');
  assert(!/עדיין לא ביצעתי/.test(falseDone), 'info answer is not replaced');

  const pendingCopy = finalizeOwnerAssistantContent('בוצע עדכון תאריך יציאה', { hasPendingAction: true });
  assert(/כרטיס|אישור/.test(pendingCopy), 'pending action copy points at confirm card');
  assert(!/^בוצע/.test(pendingCopy), 'pending action copy does not claim completion');

  const stripped = finalizeOwnerAssistantContent('הכנתי עדכון — אשרי בכרטיס למטה.', { hasPendingAction: false });
  assert(!stripped.includes('בכרטיס למטה'), 'card phrase removed when no card exists');
  const cardAsk = finalizeOwnerAssistantContent('אנא אשר בכרטיס האישור למטה', { hasPendingAction: false });
  assert(!cardAsk.includes('כרטיס'), 'approve-on-the-card-below phrase removed when no card exists');
  const realOp = { type: 'create_zimmer', name: 'בקתת הארז', location: 'דלתון' };
  assert(shouldProposeOperation('כמה צימרים יש לי?', realOp, { mode: 'edit' }) === null, 'edit-mode count question drops the operation');
  assert(shouldProposeOperation('תיצור צימר בדלתון בשם ארזים', realOp, { mode: 'edit' }) === realOp, 'edit-mode create request keeps the operation');
  assert(
    shouldProposeOperation('כמה יעלה אם ניצור צימר בדלתון?', realOp, { mode: 'edit' }) === realOp,
    'a question that also asks to create keeps the operation',
  );
  assert(shouldProposeOperation('מה ההזמנות שלי?', realOp, {}) === null, 'panel info question drops the operation');

  const merged = mergeAmenitiesList(['Wi-Fi', 'מזגן'], ['בריכה']);
  assert(merged.includes('Wi-Fi') && merged.includes('מזגן') && merged.includes('בריכה'), 'amenities merge keeps existing + new');
  const replaced = mergeAmenitiesList(['Wi-Fi', 'מזגן', 'טלוויזיה'], ['Wi-Fi', 'מזגן', 'טלוויזיה', 'כספת']);
  assert(replaced.length === 4 && replaced.includes('כספת'), 'amenities full-list replace when overlap is high');
  const removed = mergeAmenitiesList(['Wi-Fi', 'מזגן', 'טלוויזיה', 'בריכה'], ['Wi-Fi', 'מזגן', 'טלוויזיה']);
  assert(!removed.includes('בריכה') && removed.length === 3, 'explicit amenity removal is kept');
  const memory = threadMemoryText({
    messages: [{
      role: 'bot',
      content: 'הכנתי הצעה',
      surface: 'calendar',
      pending_action: { summary: 'לחסום את צימר ספסופה שלי ב-20.11', status: 'pending' },
    }],
  });
  assert(memory.includes('הוצע: לחסום את צימר ספסופה שלי ב-20.11'), 'memory includes the proposal');
  assert(memory.includes('סטטוס: ממתין'), 'memory includes the card status');
  assert(createPendingAction({ type: 'create_zimmer', name: '...' }, [], 'owner_assistant') === null, 'placeholder zimmer name is not proposed');
  assert(
    createPendingAction({ type: 'create_zimmer', name: 'string', location: 'דלתון', price_per_night: 100 }, [], 'owner_assistant') === null,
    'schema name string is not proposed',
  );
  assert(
    createPendingAction({ type: 'create_zimmer', name: 'Villa Rosa', location: 'string', price_per_night: 100 }, [], 'owner_assistant') === null,
    'schema location string is not proposed',
  );
  assert(
    createPendingAction({ type: 'create_zimmer', name: 'Villa Rosa', location: 'דלתון', price_per_night: 100 }, [], 'owner_assistant')?.op?.name === 'Villa Rosa',
    'a real latin zimmer name is proposed',
  );
  assert(
    createPendingAction(
      {
        type: 'create_booking',
        guest_name: 'string',
        guest_phone: '050-1234567',
        zimmer_name: 'בקתת הארז',
        check_in: '2026-12-10',
        check_out: '2026-12-12',
        num_guests: 2,
        status: 'אושרה',
      },
      [],
      'owner_assistant',
    ) === null,
    'schema guest name is not proposed',
  );
  assert(createPendingAction({ type: 'create_zimmer', name: 'name', location: 'צפת' }, [], 'owner_assistant') === null, 'literal name is not proposed');
  assert(createPendingAction({ type: 'create_zimmer', name: 'בקתת הארז', price_per_night: 0 }, [], 'owner_assistant') === null, 'zero price zimmer is not proposed');
  assert(createPendingAction({ type: 'create_zimmer', name: 'בקתת הארז' }, [], 'owner_assistant') === null, 'create without location is not proposed');
  assert(
    createPendingAction({ type: 'create_zimmer', name: 'בקתת הארז', location: 'דלתון' }, [], 'owner_assistant')?.op?.name === 'בקתת הארז',
    'create with name+location is proposed',
  );
  assert(
    createPendingAction(
      { type: 'create_zimmer', name: 'בקתת הארז', location: 'דלתון' },
      [{ id: 'z1', name: 'בקתת הארז' }],
      'owner_assistant',
    ) === null,
    'duplicate create name is not proposed',
  );
  assert(
    createPendingAction(
      {
        type: 'create_zimmer',
        name: 'בקתת הארז',
        location: 'דלתון',
        data_zones: [{ title: 'חדרים', content: 'מיטה זוגית בכל חדר' }],
      },
      [],
      'owner_assistant',
    ) === null,
    'beds dumped into data_zones without rooms_detail are not proposed',
  );
  assert(
    createPendingAction(
      { type: 'create_booking', guest_name: 'דני', check_in: '2026-12-10', check_out: '2026-12-12' },
      [],
      'owner_assistant',
    ) === null,
    'booking without phone/zimmer/status/guests is not proposed',
  );
  assert(
    createPendingAction(
      {
        type: 'create_booking',
        guest_name: 'דני',
        guest_phone: '050-1234567',
        zimmer_name: 'בקתת הארז',
        check_in: '2026-12-10',
        check_out: '2026-12-12',
        num_guests: 2,
        status: 'אושרה',
      },
      [{ id: 'z1', name: 'בקתת הארז' }],
      'owner_assistant',
    )?.op?.type === 'create_booking',
    'full booking is proposed',
  );
  assert(
    createPendingAction(
      { type: 'block_dates', start_date: '2026-11-05' },
      [],
      'owner_assistant',
    ) === null,
    'block without zimmer is not proposed',
  );
  assert(
    createPendingAction(
      { type: 'add_seasonal_price', zimmer_id: 'z1', start_date: '2026-07-01', end_date: '2026-08-31', percentage: 10 },
      [{ id: 'z1', name: 'בקתת הארז' }],
      'owner_assistant',
    ) === null,
    'seasonal percent-only is not proposed',
  );
  assert(
    createPendingAction(
      { type: 'add_seasonal_price', zimmer_id: 'z1', start_date: '2026-07-01', end_date: '2026-08-31', price_per_night: 900 },
      [{ id: 'z1', name: 'בקתת הארז' }],
      'owner_assistant',
    )?.op?.type === 'add_seasonal_price',
    'seasonal fixed price is proposed',
  );
  const filled = createPendingAction(
    { type: 'create_zimmer', name: 'צימר מחיר אחד', location: 'צפת', price_per_night: 800 },
    [],
    'owner_assistant',
  );
  assert(filled?.op?.weekday_price === 800 && filled?.op?.weekend_price === 800, 'single price fills weekday and weekend');
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

  const yes = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'כן',
    clientState: { ownerId: ownerRow.id },
  });
  assert(yes.json?.executedActions?.[0]?.kind === 'create_zimmer', 'bare yes confirms the latest card');
  const afterYes = await store.filter(
    'Zimmer',
    { owner_id: ownerRow.id },
    '-created_date',
    10,
    { id: ownerRow.id, email: ownerEmail, role: 'owner' },
  );
  assert(afterYes.filter((z) => z.name === 'צימר Mock בדיקה').length === 1, 'bare yes creates the zimmer once');

  const older = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'MOCK_EXECUTE_BLOCK_DATES',
    clientState: { ownerId: ownerRow.id, surface: 'calendar' },
  });
  assert(older.json?.uiEffects?.some((e) => e.opType === 'block_dates'), 'older card is proposed');
  const newer = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'MOCK_EXECUTE_CREATE_ZIMMER_ALT',
    clientState: { ownerId: ownerRow.id },
  });
  assert(newer.json?.uiEffects?.some((e) => e.opType === 'create_zimmer'), 'newer card is proposed');
  const yesLatest = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'אישור',
    clientState: { ownerId: ownerRow.id },
  });
  assert(yesLatest.json?.executedActions?.[0]?.kind === 'create_zimmer', 'yes confirms only the latest card');
  const blocks = await store.filter(
    'BookingRequest',
    { owner_id: ownerRow.id, is_block: true },
    '-created_date',
    5,
    { id: ownerRow.id, email: ownerEmail, role: 'owner' },
  );
  assert(blocks.length === 0, 'the older block card was not executed');

  const infoMode = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'MOCK_EXECUTE_CREATE_ZIMMER',
    clientState: { ownerId: ownerRow.id, mode: 'info' },
  });
  assert(
    !infoMode.json?.uiEffects?.some((e) => e.type === 'confirm_action'),
    'info mode does not propose a card',
  );

  const junkQuestion = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'כמה צימרים יש לי? MOCK_VALID_CREATE_ON_QUESTION',
    clientState: { ownerId: ownerRow.id, mode: 'edit' },
  });
  assert(
    !junkQuestion.json?.uiEffects?.some((e) => e.type === 'confirm_action'),
    'edit-mode count question does not keep a create card',
  );
  assert(
    !String(junkQuestion.json?.message?.content || '').includes('כרטיס'),
    'count question reply does not mention a confirm card',
  );
  const junkName = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'תיצור צימר MOCK_JUNK_STRING_ZIMMER',
    clientState: { ownerId: ownerRow.id, mode: 'edit' },
  });
  assert(
    !junkName.json?.uiEffects?.some((e) => e.type === 'confirm_action'),
    'schema name string does not become a card',
  );

  const stalePropose = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'MOCK_EXECUTE_BLOCK_DATES',
    clientState: { ownerId: ownerRow.id, surface: 'calendar' },
  });
  assert(stalePropose.json?.uiEffects?.some((e) => e.opType === 'block_dates'), 'stale setup proposes a block card');
  const asked = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'כמה צימרים יש לי? MOCK_INFO_ONLY',
    clientState: { ownerId: ownerRow.id },
  });
  assert(!asked.json?.uiEffects?.some((e) => e.type === 'confirm_action'), 'later count question has no card');
  const staleYes = await chat(base, ownerTok, {
    profile: 'owner_assistant',
    message: 'אישור',
    clientState: { ownerId: ownerRow.id },
  });
  assert(!staleYes.json?.executedActions?.length, 'אישור after a later answer does not execute the old card');
  const blocksAfterStale = await store.filter(
    'BookingRequest',
    { owner_id: ownerRow.id, is_block: true },
    '-created_date',
    5,
    { id: ownerRow.id, email: ownerEmail, role: 'owner' },
  );
  assert(blocksAfterStale.length === 0, 'the old block card was not executed by a later אישור');

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
