/**
 * Agent core + WhatsApp bot smoke — fake brain / sessions / identities / provider.
 * No DB, no network, no LLM.
 * v1: owners/admins only; identity by phone match (no OTP).
 */
import { createAgent, AGENT_CONFIRM_TOKEN, AGENT_CANCEL_TOKEN } from '../../src/lib/agent/core.js';
import { parseCommand, resolveQuickOption } from '../../src/lib/agent/commands.js';
import { createWhatsAppBot } from '../../src/lib/whatsapp-bot/index.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

const OWNER = '972501111111';
const CUSTOMER = '972502222222';
const STRANGER = '972503333333';
const SHARED = '972504444444';

function fakeIdentities() {
  return {
    async resolve(_channel, address) {
      if (address === OWNER) {
        return {
          kind: 'user',
          actor: { id: 'u-owner', role: 'owner', email: 'owner@ex.com' },
          user: { id: 'u-owner', email: 'owner@ex.com' },
          name: 'דנה',
        };
      }
      if (address === CUSTOMER) {
        return {
          kind: 'user',
          actor: { id: 'u-cust', role: 'user', email: 'cust@ex.com' },
          user: { id: 'u-cust', email: 'cust@ex.com' },
          name: 'יוסי',
        };
      }
      if (address === SHARED) return { kind: 'ambiguous' };
      return { kind: 'anonymous' };
    },
  };
}

function fakeSessions() {
  const rows = new Map();
  let n = 0;
  return {
    rows,
    async get(channel, address) {
      const r = rows.get(`${channel}:${address}`);
      return r ? structuredClone(r) : null;
    },
    async save(session) {
      const row = { ...structuredClone(session), id: session.id || `s${(n += 1)}` };
      rows.set(`${row.channel}:${row.address}`, row);
      return structuredClone(row);
    },
  };
}

function fakeBrain() {
  const calls = [];
  return {
    calls,
    async chat(req, identity) {
      calls.push({ req: structuredClone(req), identity });
      if (req.clientState?.confirmActionId) {
        return {
          conversationId: null,
          message: { content: `בוצע: ${req.clientState.confirmActionId}` },
          uiEffects: [],
          executedActions: [{ id: req.clientState.confirmActionId }],
        };
      }
      if (req.clientState?.cancelActionId) {
        return {
          conversationId: null,
          message: { content: `בוטל: ${req.clientState.cancelActionId}` },
          uiEffects: [],
        };
      }
      if (req.message.includes('צור') && req.clientState.mode === 'edit') {
        return {
          conversationId: null,
          message: { content: 'מוכן ליצור הזמנה' },
          uiEffects: [
            {
              type: 'confirm_action',
              actionId: 'act-1',
              summary: 'יצירת הזמנה לדני',
              details: ['מחר', 'צימר א'],
            },
          ],
        };
      }
      return {
        conversationId: null,
        message: { content: `owner(${req.clientState.mode}): ${req.message}` },
        uiEffects: req.message.includes('צור') && req.clientState.mode === 'info'
          ? [{ type: 'edit_mode_required' }]
          : [],
      };
    },
  };
}

function setup() {
  const brain = fakeBrain();
  const sessions = fakeSessions();
  let clock = new Date('2026-10-15T10:00:00Z').getTime();
  const agent = createAgent({
    brain,
    sessions,
    identities: fakeIdentities(),
    now: () => new Date(clock),
    renderEffects: async (effects) => ({
      lines: effects
        .filter((e) => e.type === 'confirm_action')
        .map((e) => `⏳ לאישור: ${e.summary}`),
      quickOptions: [],
    }),
  });
  return { agent, brain, sessions, advance: (ms) => { clock += ms; } };
}

function commandChecks() {
  assert(parseCommand('עזרה') === 'help' && parseCommand(' Menu ') === 'help', 'help in Hebrew + English');
  assert(parseCommand('מצב עריכה') === 'edit_on' && parseCommand('/edit') === 'edit_on', 'edit mode command');
  assert(parseCommand('חדש') === 'reset' && parseCommand('STOP') === 'stop', 'reset + stop');
  assert(parseCommand('מה המחיר לסופש?') === null, 'normal question is not a command');
  assert(resolveQuickOption('2', [{ label: 'a', text: 'A' }, { label: 'b', text: 'B' }]) === 'B', 'number picks quick option');
  assert(resolveQuickOption('7', [{ label: 'a', text: 'A' }]) === null, 'out-of-range number ignored');
}

async function ownersOnlyChecks() {
  const { agent, brain } = setup();
  const cust = await agent.handleMessage({ channel: 'whatsapp', address: CUSTOMER, text: 'צימר בגליל' });
  assert(brain.calls.length === 0 && cust.reply.includes('בעלי מתחמים'), 'customer → refused, no AI');

  const anon = await agent.handleMessage({ channel: 'whatsapp', address: STRANGER, text: 'שלום' });
  assert(brain.calls.length === 0 && anon.reply.includes('בעלי מתחמים'), 'anonymous → refused, no AI');
}

async function ownerChecks() {
  const { agent, brain, advance } = setup();
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'כמה הזמנות יש לי השבוע?' });
  assert(brain.calls[0].req.profile === 'owner_assistant' && brain.calls[0].req.clientState.mode === 'info',
    'owner → owner_assistant in info mode by default');

  const hint = await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'צור הזמנה לדני מחר' });
  assert(hint.reply.includes('מצב עריכה'), 'write request in info mode → hint to enable edit mode');

  const on = await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'מצב עריכה' });
  assert(on.command === 'edit_on' && brain.calls.length === 2, 'edit mode toggled without an AI call');
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'צור הזמנה לדני מחר' });
  assert(brain.calls[2].req.clientState.mode === 'edit', 'edit mode passed to the assistant');

  advance(31 * 60 * 1000);
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'ועוד אחת' });
  assert(brain.calls[3].req.clientState.mode === 'info', 'edit mode expires after 30 minutes');

  const custEdit = await setup().agent.handleMessage({ channel: 'whatsapp', address: CUSTOMER, text: 'מצב עריכה' });
  assert(custEdit.session.mode !== 'edit' && custEdit.reply.includes('בעלי מתחמים'),
    'customers cannot enable edit mode');
}

async function confirmChecks() {
  const { agent, brain } = setup();
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'מצב עריכה' });
  const propose = await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'צור הזמנה לדני מחר' });
  assert(propose.session.pending_action_id === 'act-1', 'confirm_action stores pending_action_id');
  assert(propose.reply.includes('אישור') && propose.reply.includes(AGENT_CONFIRM_TOKEN ? '1.' : '1.'),
    'confirm options listed');
  assert(propose.session.quick_options?.[0]?.text === AGENT_CONFIRM_TOKEN, 'confirm token on option 1');
  assert(propose.session.quick_options?.[1]?.text === AGENT_CANCEL_TOKEN, 'cancel token on option 2');

  const yes = await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: '1' });
  assert(brain.calls.some((c) => c.req.clientState.confirmActionId === 'act-1'),
    'numbered 1 → confirmActionId to assistant');
  assert(yes.reply.includes('בוצע: act-1'), 'confirm executes via shared assistant path');
  assert(!yes.session.pending_action_id, 'pending cleared after confirm');
}

async function digitWithoutMenuChecks() {
  const { agent, brain, sessions } = setup();
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'מצב עריכה' });
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'צור הזמנה לדני מחר' });
  const row = sessions.rows.get(`whatsapp:${OWNER}`);
  sessions.rows.set(`whatsapp:${OWNER}`, { ...row, quick_options: [] });
  const cancel = await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: '2' });
  assert(
    brain.calls.some((c) => c.req.clientState.cancelActionId === 'act-1'),
    '2 cancels the current card even without quick options',
  );
  assert(cancel.reply.includes('בוטל: act-1'), '2 runs the shared cancel path');
  assert(!cancel.session.pending_action_id, 'pending cleared after 2');
}

async function staleCardChecks() {
  const { agent, brain } = setup();
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'מצב עריכה' });
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'צור הזמנה לדני מחר' });
  const question = await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'כמה צימרים יש לי?' });
  assert(!question.session.pending_action_id, 'a later question clears the session card');
  assert(!question.session.quick_options?.length, 'a later question clears the 1/2 menu');
  const asked = brain.calls[brain.calls.length - 1];
  assert(asked.req.message === 'כמה צימרים יש לי?' && !asked.req.clientState.confirmActionId,
    'the question reaches the brain as text');
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'אישור' });
  assert(
    !brain.calls.some((c) => c.req.clientState.confirmActionId === 'act-1'),
    'אישור after a later question does not confirm the old card',
  );
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: '2' });
  const two = brain.calls[brain.calls.length - 1];
  assert(two.req.message === '2' && !two.req.clientState.cancelActionId, '2 after the card is gone is plain text');
}

async function safetyChecks() {
  const { agent, brain, sessions } = setup();
  const amb = await agent.handleMessage({ channel: 'whatsapp', address: SHARED, text: 'ההזמנות שלי' });
  assert(brain.calls.length === 0 && amb.reply.includes('יותר מחשבון אחד'), 'number on 2 accounts → refused, no AI call');

  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'עצור' });
  const silent = await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'שלום?' });
  assert(silent.reply === null && brain.calls.length === 0, 'opted-out sender gets no reply');
  const back = await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'הפעל' });
  assert(back.reply && !back.session.opted_out, 'start re-enables replies');

  // Phone moved to a different account: old history must not follow.
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'היסטוריה פרטית' });
  const row = sessions.rows.get(`whatsapp:${OWNER}`);
  sessions.rows.set(`whatsapp:${OWNER}`, { ...row, user_id: 'someone-else' });
  await agent.handleMessage({ channel: 'whatsapp', address: OWNER, text: 'מה ההזמנות שלי' });
  const last = brain.calls[brain.calls.length - 1];
  assert(last.req.clientState.recentTurns.length === 0 && last.req.conversationId === null,
    'account change on a number wipes previous context');
}

async function botChecks() {
  const { agent } = setup();
  const sent = [];
  const logged = [];
  const store = {
    async create(_t, data) { logged.push(data); return data; },
    async filter(_t, q) {
      return logged.filter((r) => r.direction === q.direction && r.provider_message_id === q.provider_message_id);
    },
    async update() { return {}; },
  };
  const provider = {
    name: 'fake',
    supportsInbound: true,
    async sendMessage(to, text) { sent.push({ to, text }); return { ok: true, status: 'sent', providerMessageId: `out-${sent.length}` }; },
  };
  const bot = createWhatsAppBot({ store: /** @type {any} */ (store), agent, provider: /** @type {any} */ (provider), env: {} });

  const msg = (id, text, extra = {}) => ({
    type: 'message', id, from: OWNER, fromName: 'דנה', isGroup: false,
    timestamp: new Date().toISOString(), kind: 'text', text, replyTo: '', media: null, ...extra,
  });

  await bot.handleEvents([msg('in-1', 'כמה הזמנות?'), msg('in-1', 'כמה הזמנות?')]);
  await bot.idle();
  assert(sent.length === 1 && sent[0].to === OWNER, 'duplicate webhook delivery answered once');
  assert(logged.some((r) => r.direction === 'in' && r.provider_message_id === 'in-1'), 'inbound logged');
  assert(logged.some((r) => r.direction === 'out' && r.source === 'bot'), 'reply logged as bot');

  await bot.handleEvents([msg('in-2', '', { kind: 'audio' })]);
  await bot.idle();
  assert(sent[1].text.includes('טקסט'), 'non-text message → polite text-only reply');

  await bot.handleEvents([msg('in-3', 'שלום', { isGroup: true })]);
  await bot.idle();
  assert(sent.length === 2, 'group messages ignored');

  const limited = createWhatsAppBot({
    store: /** @type {any} */ (store),
    agent,
    provider: /** @type {any} */ (provider),
    env: { WHATSAPP_BOT_ALLOWED_SENDERS: '972509999999' },
  });
  await limited.handleEvents([msg('in-4', 'שלום')]);
  await limited.idle();
  assert(sent.length === 2, 'sender allowlist enforced');
}

commandChecks();
await ownersOnlyChecks();
await ownerChecks();
await confirmChecks();
await digitWithoutMenuChecks();
await staleCardChecks();
await safetyChecks();
await botChecks();

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nagent smoke: all checks passed');
