/**
 * Owner assistant unification — shared thread, confirm-before-execute, surfaces, price parity.
 * Usage (from server/): node tests/contract/owner-thread-confirm.smoke.js
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
import { buildOwnerAssistantPrompt } from '../../src/lib/assistant/prompt-builder/owner-assistant.js';
import * as serverPrice from '../../src/lib/booking-price.js';
import { toGeminiSchema } from '../../src/lib/llm/gemini.js';
import { OWNER_ASSISTANT_SCHEMA } from '../../src/lib/assistant/profiles.js';
import { createPendingAction } from '../../src/lib/assistant/owner-actions.js';
import {
  finalizeOwnerAssistantContent,
  incompleteOperationMessage,
  parseOwnerTextActionDecision,
  stripConfirmCardLanguage,
} from '../../src/lib/assistant/response-parser/owner-assistant.js';
import {
  findLatestOpenPendingActionMessage,
  pendingActionOnLastBotMessage,
} from '../../src/lib/assistant/owner-thread.js';
import * as clientPrice from '../../../src/lib/bookingPrice.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

process.env.LLM_MOCK = '1';
process.env.ASSISTANT_GUEST_RATE_LIMIT = '1000';
process.env.ASSISTANT_AUTH_RATE_LIMIT = '1000';

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
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function confirmEffect(res) {
  return res.json?.uiEffects?.find((e) => e.type === 'confirm_action') || null;
}

function unitChecks() {
  const prompt = buildOwnerAssistantPrompt(
    {
      surface: 'calendar',
      today: '2031-01-01',
      focus: { date: '2031-01-05' },
      focusZimmer: null,
      snapshotStr: '',
      memoryText: '',
      userMessage: 'כמה הודעות לא נענו?',
    },
    'כמה הודעות לא נענו?',
  );
  assert(prompt.includes('גם אם אינה קשורה למסך'), 'calendar prompt: answer any question, not only calendar');
  assert(prompt.includes('תאריך בפוקוס: 2031-01-05'), 'calendar prompt carries focus date');

  const zimmer = {
    price_per_night: 500,
    weekday_price: 500,
    weekend_price: 700,
    seasonal_pricing: [
      { start_date: '2031-07-01', end_date: '2031-07-31', price_per_night: 1200, label: 'קיץ' },
      { start_date: '2031-08-01', end_date: '2031-08-31', adjustment: 'increase', percentage: 20 },
    ],
  };
  for (const [ci, co] of [
    ['2031-07-03', '2031-07-06'],
    ['2031-08-05', '2031-08-08'],
    ['2031-06-29', '2031-07-02'],
  ]) {
    const s = serverPrice.calcBookingTotalForZimmer(zimmer, ci, co);
    const c = clientPrice.calcBookingTotalForZimmer(zimmer, ci, co);
    assert(s === c, `price parity server/client ${ci}→${co} (${s} vs ${c})`);
  }
  assert(
    serverPrice.effectivePricePerNight(zimmer, '2031-07-03') === 1200,
    'absolute seasonal price_per_night wins on the server',
  );
  assert(
    clientPrice.getBookingTotal({ price_override: 1800, total_price: 999 }, zimmer) === 1800,
    'client getBookingTotal prefers price_override',
  );

  const gemini = toGeminiSchema(OWNER_ASSISTANT_SCHEMA);
  assert(
    JSON.stringify(gemini?.required) === JSON.stringify(['message']),
    'owner schema: only message is required (operation/open_form stay optional for Gemini)',
  );
  assert(createPendingAction({ type: 'create_zimmer' }, [], 'owner_assistant') === null, 'bare create_zimmer is not proposed');
  assert(
    !finalizeOwnerAssistantContent('עודכן בהצלחה. אשר בכרטיס למטה.', { hasPendingAction: false }).includes('כרטיס'),
    'finalize without pending strips card language',
  );
  assert(
    finalizeOwnerAssistantContent('מעדכן את המחיר ללילה', { hasPendingAction: true }).includes('כרטיס'),
    'finalize with pending adds card hint',
  );
  assert(
    finalizeOwnerAssistantContent('הצימרים שלך בצפון: א ו-ב', {
      hasPendingAction: false,
      incompleteOperation: { type: 'create_zimmer' },
    }) === 'הצימרים שלך בצפון: א ו-ב',
    'finalize keeps Q&A when incomplete op is spurious',
  );
  assert(
    finalizeOwnerAssistantContent('אשר בכרטיס למטה', {
      hasPendingAction: false,
      incompleteOperation: { type: 'create_zimmer' },
    }).includes('חסר שם'),
    'finalize asks missing fields when propose text has no card and incomplete op',
  );
  assert(
    stripConfirmCardLanguage('ממתין לאישור בכרטיס למטה — עד אז לא בוצע').includes('כרטיס') === false,
    'stripConfirmCardLanguage removes card hint',
  );
  assert(parseOwnerTextActionDecision('אישור') === 'confirm', 'parseOwnerTextActionDecision confirm');
  assert(parseOwnerTextActionDecision('ביטול') === 'cancel', 'parseOwnerTextActionDecision cancel');
  assert(parseOwnerTextActionDecision('כן אני רוצה הזמנה חדשה') === null, 'long text is not a decision');
  assert(
    incompleteOperationMessage({ type: 'create_booking' }).includes('חסרים'),
    'incompleteOperationMessage for create_booking',
  );
  assert(
    findLatestOpenPendingActionMessage({
      messages: [
        { pending_action: { id: 'old', status: 'done' } },
        { pending_action: { id: 'open', status: 'pending' } },
      ],
    })?.pending_action?.id === 'open',
    'findLatestOpenPendingActionMessage skips resolved',
  );
  assert(
    createPendingAction({ type: 'create_zimmer', name: 'string', location: 'צפת', price_per_night: 100 }, [], 'owner_assistant') === null,
    'schema name string is not proposed',
  );
  const openPending = { id: 'card-1', status: 'pending', expiresAt: new Date(Date.now() + 60_000).toISOString() };
  assert(
    pendingActionOnLastBotMessage({
      messages: [
        { role: 'bot', pending_action: openPending },
        { role: 'user', content: 'כמה צימרים יש לי?' },
        { role: 'bot', content: 'יש לך 3 צימרים.' },
      ],
    }) === null,
    'pending behind a later answer is not text-confirmable',
  );
  assert(
    pendingActionOnLastBotMessage({
      messages: [
        { role: 'user', content: 'תיצור צימר' },
        { role: 'bot', pending_action: openPending },
      ],
    })?.id === 'card-1',
    'pending on the last bot bubble is text-confirmable',
  );
  assert(createPendingAction({ type: 'create_booking', guest_name: 'x' }, [], 'owner_assistant') === null, 'booking without dates is not proposed');
  assert(
    createPendingAction({ type: 'block_dates', start_date: '2031-02-10' }, [], 'owner_assistant') === null,
    'block without a zimmer is not proposed',
  );
  assert(
    createPendingAction(
      { type: 'block_dates', zimmer_name: 'צימר בדיקה', start_date: '2031-02-10' },
      [],
      'owner_assistant',
    ) !== null,
    'block with a zimmer and a start date is proposed',
  );
  assert(
    createPendingAction({ type: 'update_booking', guest_name: 'x' }, [], 'owner_assistant') === null,
    'update_booking with only guest_name (no change fields) is not proposed',
  );
  assert(
    createPendingAction({ type: 'update_booking', guest_name: 'x', notes: 'hi' }, [], 'owner_assistant') !== null,
    'update_booking with a change field is proposed',
  );
  const priced = createPendingAction(
    {
      type: 'create_booking',
      guest_name: 'יעל',
      guest_phone: '050',
      zimmer_name: 'צימר בדיקה',
      check_in: '2031-07-03',
      check_out: '2031-07-06',
      num_guests: 2,
      status: 'אושרה',
      price_override: 0,
    },
    [{ name: 'צימר בדיקה', ...zimmer }],
    'owner_assistant',
  );
  assert(priced, 'create_booking with price_override 0 is still proposed');
  assert(
    !priced.details.some((d) => String(d).includes('מחיר מוסכם')),
    'price_override 0 does not show as agreed price',
  );
  assert(
    priced.details.some((d) => String(d).includes('מחיר מחירון')),
    'create_booking without real override shows list price',
  );
}

async function main() {
  unitChecks();

  const stamp = Date.now();
  const emails = {
    a: `thr-a-${stamp}@example.com`,
    b: `thr-b-${stamp}@example.com`,
    cust: `thr-c-${stamp}@example.com`,
    admin: `thr-adm-${stamp}@example.com`,
  };
  await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
  const mk = (email, role, fullName) =>
    prisma.user.create({ data: { email, role, registered: true, emailVerified: true, fullName } });
  const ownerA = await mk(emails.a, 'owner', 'בעלים א');
  const ownerB = await mk(emails.b, 'owner', 'בעלים ב');
  const cust = await mk(emails.cust, 'user', 'לקוח');
  const admin = await mk(emails.admin, 'admin', 'אדמין');

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(createAuthMiddleware(prisma));
  app.use('/api/assistant', createAssistantRouter({ prisma, store }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const tokA = signToken(users.toAuth(ownerA));
  const tokB = signToken(users.toAuth(ownerB));
  const tokC = signToken(users.toAuth(cust));
  const tokAdmin = signToken(users.toAuth(admin));
  const actorA = { id: ownerA.id, email: emails.a, role: 'owner' };

  try {
    // 1. Proposal does not execute.
    const propose = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'MOCK_EXECUTE_CREATE_ZIMMER',
      clientState: { surface: 'home' },
    });
    const eff = confirmEffect(propose);
    assert(propose.status === 200 && eff, 'proposal returns confirm_action');
    assert(propose.json?.executedActions?.length === 0, 'proposal has no executedActions');
    let zimmers = await store.filter('Zimmer', { owner_id: ownerA.id }, '-created_date', 10, actorA);
    assert(zimmers.length === 0, 'nothing written before confirmation');

    // 2. Foreign owner cannot confirm.
    const foreign = await chat(base, tokB, {
      profile: 'owner_assistant',
      message: 'אישור',
      clientState: { confirmActionId: eff?.actionId },
    });
    assert(foreign.status === 404, `foreign owner confirm → 404 (got ${foreign.status})`);

    // 3. Confirm executes exactly once.
    const confirm = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'אישור',
      clientState: { confirmActionId: eff?.actionId, surface: 'home' },
    });
    assert(confirm.status === 200, 'owner confirm → 200');
    assert(confirm.json?.executedActions?.[0]?.kind === 'create_zimmer', 'confirm executes create_zimmer');
    assert(
      confirm.json?.uiEffects?.some((e) => e.type === 'action_resolved' && e.status === 'done'),
      'confirm returns action_resolved',
    );
    const again = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'אישור',
      clientState: { confirmActionId: eff?.actionId },
    });
    assert(again.status === 409, `second confirm → 409 (got ${again.status})`);
    zimmers = await store.filter('Zimmer', { owner_id: ownerA.id }, '-created_date', 10, actorA);
    assert(zimmers.filter((z) => z.name === 'צימר Mock בדיקה').length === 1, 'zimmer created exactly once');

    // 3b. Free-text cancel/confirm without action ids in clientState.
    const proposeTextCancel = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'MOCK_EXECUTE_BLOCK_DATES',
      clientState: { surface: 'calendar', focus: { date: '2031-03-15' } },
    });
    assert(confirmEffect(proposeTextCancel)?.opType === 'block_dates', 'text-decision setup: block_dates proposal');
    const textCancel = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'ביטול',
      clientState: { surface: 'calendar' },
    });
    assert(textCancel.status === 200 && textCancel.json?.executedActions?.length === 0, 'text ביטול cancels open pending');

    const proposeTextConfirm = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'MOCK_EXECUTE_BLOCK_DATES',
      clientState: { surface: 'calendar', focus: { date: '2031-02-10' } },
    });
    const textConfirm = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'אישור',
      clientState: { surface: 'calendar' },
    });
    assert(textConfirm.status === 200, `text אישור without actionId → 200 (got ${textConfirm.status})`);
    assert(
      textConfirm.json?.executedActions?.[0]?.kind === 'block_dates',
      'text אישור executes open pending action',
    );
    const blocks = await store.filter('BookingRequest', { owner_id: ownerA.id, is_block: true }, '-created_date', 5, actorA);
    assert(blocks.length === 1 && blocks[0].status === 'חסום', 'block row persisted');

    // 4. Cancel via explicit cancelActionId still works.
    const proposeBlock = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'MOCK_EXECUTE_BLOCK_DATES',
      clientState: { surface: 'calendar', focus: { date: '2031-04-01' } },
    });
    const blockEff = confirmEffect(proposeBlock);
    assert(blockEff?.opType === 'block_dates', 'block_dates proposal');
    const cancel = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'ביטול',
      clientState: { cancelActionId: blockEff?.actionId, surface: 'calendar' },
    });
    assert(cancel.status === 200 && cancel.json?.executedActions?.length === 0, 'cancel executes nothing');
    const afterCancel = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'אישור',
      clientState: { confirmActionId: blockEff?.actionId },
    });
    assert(afterCancel.status === 409, 'confirm after cancel → 409');

    // 5. Calendar surface answers chat questions + open_form.
    const calQ = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'כמה הודעות מלקוחות לא נענו?',
      clientState: { surface: 'calendar', focus: { date: '2031-02-10' } },
    });
    assert(calQ.status === 200 && calQ.json?.message?.content, 'calendar surface answers a messages question');
    assert(calQ.json?.meta?.surface === 'calendar', 'meta.surface === calendar');
    const form = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'MOCK_OPEN_FORM_BLOCK',
      clientState: { surface: 'calendar', focus: { date: '2031-03-01' } },
    });
    assert(
      form.json?.uiEffects?.some((e) => e.type === 'open_form' && e.form === 'block' && e.date === '2031-03-01'),
      'open_form uiEffect from calendar',
    );

    // 6. Long owner text (3000 chars) is kept in full.
    const longText = 'א'.repeat(3000);
    const longRes = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: longText,
      clientState: { surface: 'home' },
    });
    assert(longRes.status === 200, '3000-char owner message accepted');

    // 7. Thread: single row, tagged surfaces, owner can read it, other owner cannot see it.
    const threadRows = await store.filter('OwnerAssistantThread', { owner_id: ownerA.id }, '-created_date', 5, SERVICE_ACTOR);
    assert(threadRows.length === 1, 'one thread row per owner');
    const msgs = threadRows[0]?.messages || [];
    assert(msgs.some((m) => m.surface === 'calendar') && msgs.some((m) => m.surface === 'home'), 'thread turns tagged by surface');
    assert(msgs.some((m) => m.role === 'user' && m.content === longText), 'long message stored in full');
    assert(
      msgs.some((m) => m.pending_action?.id === eff?.actionId && m.pending_action.status === 'done'),
      'pending action marked done in thread',
    );
    const visibleToB = await store.filter('OwnerAssistantThread', { owner_id: ownerA.id }, '-created_date', 5, {
      id: ownerB.id,
      email: emails.b,
      role: 'owner',
    });
    assert(visibleToB.length === 0, 'other owner cannot read the thread');
    let ownerWriteBlocked = false;
    try {
      await store.update('OwnerAssistantThread', threadRows[0].id, { messages: [] }, actorA);
    } catch {
      ownerWriteBlocked = true;
    }
    assert(ownerWriteBlocked, 'owner cannot write the thread directly');

    // 8. Wizards: owner gets confirm_action; admin keeps the legacy client save.
    await store.update('Zimmer', zimmers[0].id, { name: 'Mock Zimmer' }, SERVICE_ACTOR);
    const wizOwner = await chat(base, tokA, {
      profile: 'owner_booking_creator',
      message: 'MOCK_BOOKING_CREATE',
      clientState: { collectedData: {} },
    });
    assert(confirmEffect(wizOwner)?.opType === 'create_booking', 'owner booking wizard → confirm_action');
    const wizAdmin = await chat(base, tokAdmin, {
      profile: 'owner_booking_creator',
      message: 'MOCK_BOOKING_CREATE',
      clientState: { ownerId: ownerA.id, collectedData: {} },
    });
    assert(wizAdmin.status === 200 && !confirmEffect(wizAdmin), 'admin booking wizard → no confirm_action');

    // 9. price_override: owner keeps it, customer cannot set it.
    const z = zimmers[0];
    const ownerBooking = await store.create(
      'BookingRequest',
      {
        zimmer_id: z.id,
        zimmer_name: z.name,
        guest_name: 'בדיקה',
        guest_phone: '0500000000',
        check_in: '2031-05-01',
        check_out: '2031-05-03',
        num_guests: 2,
        status: 'אושרה',
        price_override: 1800,
      },
      { actor: actorA, createdById: ownerA.id, createdBy: emails.a },
    );
    assert(ownerBooking.price_override === 1800 && ownerBooking.total_price === 1800, 'owner price_override kept as total');
    const custActor = { id: cust.id, email: emails.cust, role: 'user' };
    const custBooking = await store.create(
      'BookingRequest',
      {
        zimmer_id: z.id,
        zimmer_name: z.name,
        guest_name: 'לקוח',
        guest_phone: '0500000001',
        check_in: '2031-06-01',
        check_out: '2031-06-03',
        num_guests: 2,
        price_override: 1,
      },
      { actor: custActor, createdById: cust.id, createdBy: emails.cust },
    );
    assert(custBooking.price_override == null && custBooking.total_price !== 1, 'customer cannot set price_override');

    // 9b. price_override 0 → list price, not ₪0.
    const zeroOverride = await store.create(
      'BookingRequest',
      {
        zimmer_id: z.id,
        zimmer_name: z.name,
        guest_name: 'אפס',
        guest_phone: '0500000002',
        check_in: '2031-07-03',
        check_out: '2031-07-06',
        num_guests: 2,
        status: 'אושרה',
        price_override: 0,
      },
      { actor: actorA, createdById: ownerA.id, createdBy: emails.a },
    );
    assert(
      (zeroOverride.price_override == null || zeroOverride.price_override === 0) &&
        zeroOverride.total_price > 0,
      `price_override 0 yields list total (got ${zeroOverride.total_price})`,
    );

    // 9c. update_booking propose → confirm once.
    await store.create(
      'BookingRequest',
      {
        zimmer_id: z.id,
        zimmer_name: z.name,
        guest_name: 'אורח Mock לעדכון',
        guest_phone: '0501111111',
        check_in: '2031-09-01',
        check_out: '2031-09-03',
        num_guests: 2,
        status: 'ממתינה',
      },
      { actor: actorA, createdById: ownerA.id, createdBy: emails.a },
    );
    const proposeUpd = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'MOCK_EXECUTE_UPDATE_BOOKING',
      clientState: { surface: 'bookings' },
    });
    const updEff = confirmEffect(proposeUpd);
    assert(updEff?.opType === 'update_booking', 'update_booking proposal');
    const confirmUpd = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'אישור',
      clientState: { confirmActionId: updEff?.actionId, surface: 'bookings' },
    });
    assert(confirmUpd.status === 200, 'update_booking confirm → 200');
    assert(confirmUpd.json?.executedActions?.[0]?.kind === 'update_booking', 'update_booking executed');
    const updatedRows = await store.filter(
      'BookingRequest',
      { owner_id: ownerA.id, guest_name: 'אורח Mock לעדכון' },
      '-created_date',
      5,
      actorA,
    );
    assert(updatedRows[0]?.notes === 'עודכן ב-mock', 'booking notes updated after confirm');
    const updAgain = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'אישור',
      clientState: { confirmActionId: updEff?.actionId },
    });
    assert(updAgain.status === 409, `second update confirm → 409 (got ${updAgain.status})`);

    const stalePropose = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'MOCK_EXECUTE_CREATE_ZIMMER_ALT',
      clientState: { surface: 'home' },
    });
    assert(confirmEffect(stalePropose)?.opType === 'create_zimmer', 'stale setup proposes a card');
    const askedLater = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'כמה צימרים יש לי? MOCK_INFO_ONLY',
      clientState: { surface: 'home' },
    });
    assert(!confirmEffect(askedLater), 'count question after a card has no new card');
    const staleYes = await chat(base, tokA, {
      profile: 'owner_assistant',
      message: 'אישור',
      clientState: { surface: 'home' },
    });
    assert(!staleYes.json?.executedActions?.length, 'bare אישור after a later answer does not execute');
    const altZimmers = await store.filter('Zimmer', { owner_id: ownerA.id }, '-created_date', 10, actorA);
    assert(
      altZimmers.filter((z) => z.name === 'צימר Mock חלופי').length === 0,
      'old create card was not executed by a later אישור',
    );

    // 10. One-shot owner profiles.
    const day = await chat(base, tokA, {
      profile: 'owner_calendar_day_advice',
      message: 'סיכום יום',
      clientState: { date: '2031-05-01' },
    });
    assert(day.status === 200 && day.json?.meta?.parsed?.summary, 'owner_calendar_day_advice → summary');
    const custDenied = await chat(base, tokC, {
      profile: 'owner_reply_draft',
      message: 'טיוטה',
      clientState: { kind: 'question', questionId: 'x' },
    });
    assert(custDenied.status === 403, 'customer cannot use owner_reply_draft');
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
  }

  await prisma.$disconnect();
  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll owner thread/confirm smoke checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
