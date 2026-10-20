/**
 * Agent core + WhatsApp bot smoke — fake brain / sessions / identities / provider.
 * No DB, no network, no LLM.
 */
import { createAgent } from '../../src/lib/agent/core.js';
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
      if (address === OWNER) return { kind: 'user', actor: { id: 'u-owner', role: 'owner' }, user: { id: 'u-owner' }, name: 'דנה' };
      if (address === CUSTOMER) return { kind: 'user', actor: { id: 'u-cust', role: 'user' }, user: { id: 'u-cust' }, name: 'יוסי' };
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
      if (req.profile === 'customer_chat') {
        return {
          conversationId: identity.kind === 'user' ? 'conv-1' : null,
          message: { content: `מצאתי צימרים עבור: ${req.message}` },
          uiEffects: [
            { type: 'show_zimmers', zimmerIds: ['z1'] },
            {
              type: 'quick_options',
              options: [
                { label: 'שאל על צימר', text: 'בנוגע לצימר "א": ' },
                { label: 'הזמן', text: 'אני רוצה להזמין' },
              ],
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
      lines: effects.filter((e) => e.type === 'show_zimmers').map(() => '🏡 *צימר א*'),
      quickOptions: (effects.find((e) => e.type === 'quick_options')?.options || [])
        .filter((o) => !o.text.trimEnd().endsWith(':')),
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

async function customerChecks() {
  const { agent, brain } = setup();
  const r1 = await agent.handleMessage({ channel: 'whatsapp', address: CUSTOMER, text: 'צימר בגליל לזוג' });
  assert(brain.calls[0].req.profile === 'customer_chat', 'customer → customer_chat profile');
  assert(brain.calls[0].identity.actor.id === 'u-cust', 'customer acts as their own account');
  assert(r1.reply.includes('🏡 *צימר א*') && r1.reply.includes('1. הזמן'), 'effects rendered + numbered options');
  assert(!r1.reply.includes('שאל על צימר'), 'fill-in-the-blank web options dropped');

  const r2 = await agent.handleMessage({ channel: 'whatsapp', address: CUSTOMER, text: '1' });
  assert(brain.calls[1].req.message === 'אני רוצה להזמין', '"1" resolves to the quick option text');
  assert(brain.calls[1].req.conversationId === 'conv-1', 'conversation id carried to next turn');
  assert(brain.calls[1].req.clientState.recentTurns.length === 2, 'recent turns carried to next turn');
  assert(r2.session.recent_turns.length === 4, 'session keeps the history');

  await agent.handleMessage({ channel: 'whatsapp', address: CUSTOMER, text: 'חדש' });
  await agent.handleMessage({ channel: 'whatsapp', address: CUSTOMER, text: 'שוב' });
  assert(brain.calls.length === 3 && brain.calls[2].req.clientState.recentTurns.length === 0
    && brain.calls[2].req.conversationId === null, 'reset clears history without calling the AI');

  const anon = await agent.handleMessage({ channel: 'whatsapp', address: STRANGER, text: 'יש משהו בצפון?' });
  assert(brain.calls[3].identity.kind === 'anonymous' && brain.calls[3].req.profile === 'customer_chat',
    'unknown number → anonymous guest on customer_chat');
  assert(anon.reply.length > 0, 'anonymous guest gets an answer');
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
  assert(custEdit.session.mode !== 'edit', 'customers cannot enable edit mode');
}

async function safetyChecks() {
  const { agent, brain, sessions } = setup();
  const amb = await agent.handleMessage({ channel: 'whatsapp', address: SHARED, text: 'ההזמנות שלי' });
  assert(brain.calls.length === 0 && amb.reply.includes('יותר מחשבון אחד'), 'number on 2 accounts → refused, no AI call');

  await agent.handleMessage({ channel: 'whatsapp', address: STRANGER, text: 'עצור' });
  const silent = await agent.handleMessage({ channel: 'whatsapp', address: STRANGER, text: 'שלום?' });
  assert(silent.reply === null && brain.calls.length === 0, 'opted-out sender gets no reply');
  const back = await agent.handleMessage({ channel: 'whatsapp', address: STRANGER, text: 'הפעל' });
  assert(back.reply && !back.session.opted_out, 'start re-enables replies');

  // Phone moved to a different account: old history must not follow.
  await agent.handleMessage({ channel: 'whatsapp', address: CUSTOMER, text: 'היסטוריה פרטית' });
  const row = sessions.rows.get(`whatsapp:${CUSTOMER}`);
  sessions.rows.set(`whatsapp:${CUSTOMER}`, { ...row, user_id: 'someone-else' });
  await agent.handleMessage({ channel: 'whatsapp', address: CUSTOMER, text: 'מה ההזמנות שלי' });
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
    type: 'message', id, from: CUSTOMER, fromName: 'יוסי', isGroup: false,
    timestamp: new Date().toISOString(), kind: 'text', text, replyTo: '', media: null, ...extra,
  });

  await bot.handleEvents([msg('in-1', 'צימר לזוג'), msg('in-1', 'צימר לזוג')]);
  await bot.idle();
  assert(sent.length === 1 && sent[0].to === CUSTOMER, 'duplicate webhook delivery answered once');
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
    env: { WHATSAPP_BOT_ALLOWED_SENDERS: OWNER },
  });
  await limited.handleEvents([msg('in-4', 'שלום')]);
  await limited.idle();
  assert(sent.length === 2, 'sender allowlist enforced');
}

commandChecks();
await customerChecks();
await ownerChecks();
await safetyChecks();
await botChecks();

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nagent smoke: all checks passed');
