/**
 * WhatsApp provider layer smoke — WHAPI payloads, webhook parsing, legacy provider, facade.
 * No DB, no network (fake fetch).
 */
import { createWhapiProvider } from '../../src/lib/whatsapp/providers/whapi.js';
import { createLegacyWebhookProvider } from '../../src/lib/whatsapp/providers/legacy-webhook.js';
import {
  composeWhatsAppText,
  createWhatsAppProvider,
  toWhatsAppNumber,
} from '../../src/lib/whatsapp/index.js';
import { guessMediaKind } from '../../src/lib/whatsapp/helpers.js';
import { createOutbox } from '../../src/lib/whatsapp/outbox.js';
import { sendWhatsAppText } from '../../src/lib/whatsapp/index.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

/**
 * Fake fetch that records calls. `response` is one answer for every call, or an array
 * answered in order (last one repeats).
 */
function fakeFetch(response = { status: 200, body: { sent: true, message: { id: 'wamid-1' } } }) {
  const calls = [];
  const queue = Array.isArray(response) ? response : [response];
  const fn = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    const r = queue[Math.min(calls.length - 1, queue.length - 1)];
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    };
  };
  fn.calls = calls;
  return fn;
}

function helperChecks() {
  assert(toWhatsAppNumber('050-123-4567') === '972501234567', 'local 05x → 9725x');
  assert(toWhatsAppNumber('+44 7700 900123') === '447700900123', '+intl keeps country code');
  assert(toWhatsAppNumber('00972501234567') === '972501234567', '00 prefix stripped');
  assert(toWhatsAppNumber('') === '', 'empty phone → empty');
  assert(guessMediaKind('https://x.test/a/photo.JPG') === 'image', 'jpg → image');
  assert(guessMediaKind('https://x.test/f?id=1', 'application/pdf') === 'document', 'mime wins');
  assert(guessMediaKind('https://x.test/v.mp4') === 'video', 'mp4 → video');
  assert(composeWhatsAppText('כותרת', 'גוף') === '*כותרת*\n\nגוף', 'title bolded above body');
  assert(composeWhatsAppText('', 'only body') === 'only body', 'no title → body only');
}

async function whapiSendChecks() {
  const fetchImpl = fakeFetch();
  const wa = createWhapiProvider({ token: 'tok', fetchImpl });

  const r = await wa.sendMessage('050-123-4567', 'hello', { intent: 'guest.checkin' });
  const call = fetchImpl.calls[0];
  assert(r.ok && r.status === 'sent' && r.providerMessageId === 'wamid-1', 'text send → sent + id');
  assert(call.url === 'https://gate.whapi.cloud/messages/text', 'text → /messages/text');
  assert(call.init.headers.Authorization === 'Bearer tok', 'bearer auth');
  assert(call.body.to === '972501234567' && call.body.body === 'hello', 'text payload {to, body}');
  assert(!('intent' in call.body), 'intent not leaked to WHAPI');

  await wa.sendMedia('0501234567', 'https://cdn.test/menu.pdf', {
    caption: 'menu',
    filename: 'menu.pdf',
  });
  const doc = fetchImpl.calls[1];
  assert(doc.url.endsWith('/messages/document'), 'pdf → /messages/document');
  assert(doc.body.media === 'https://cdn.test/menu.pdf' && doc.body.filename === 'menu.pdf',
    'document payload {media, filename}');

  await wa.sendMedia('0501234567', 'https://cdn.test/v.ogg', { caption: 'ignored' });
  const audio = fetchImpl.calls[2];
  assert(audio.url.endsWith('/messages/audio') && !('caption' in audio.body), 'audio has no caption');

  const skipped = await wa.sendMessage('', 'hi');
  assert(skipped.status === 'skipped' && fetchImpl.calls.length === 3, 'no phone → skipped, no call');
  const bad = await wa.sendMessage('12', 'hi');
  assert(bad.status === 'failed' && bad.error === 'invalid recipient phone', 'short phone → failed');

  const noToken = await createWhapiProvider({ fetchImpl }).sendMessage('0501234567', 'hi');
  assert(noToken.status === 'not_configured', 'no token → not_configured');

  const errFetch = fakeFetch({ status: 401, body: { error: { code: 401, message: 'bad token' } } });
  const err = await createWhapiProvider({ token: 't', fetchImpl: errFetch }).sendMessage('0501234567', 'x');
  assert(err.status === 'failed' && err.error === 'bad token', 'API error message surfaced');
  assert(errFetch.calls.length === 1, '401 is not retried');

  const flaky = fakeFetch([
    { status: 503, body: {} },
    { status: 429, body: {} },
    { status: 200, body: { sent: true, message: { id: 'ok-3' } } },
  ]);
  const retried = await createWhapiProvider({ token: 't', fetchImpl: flaky, retryBaseMs: 1 })
    .sendMessage('0501234567', 'x');
  assert(retried.ok && retried.providerMessageId === 'ok-3' && flaky.calls.length === 3,
    '503/429 retried with backoff, then sent');

  const capped = fakeFetch({ status: 402, body: { error: { message: 'limit' } } });
  const quota = await createWhapiProvider({ token: 't', fetchImpl: capped, retryBaseMs: 1 })
    .sendMessage('0501234567', 'x');
  assert(quota.limitReached === true && capped.calls.length === 1, '402 → limitReached, no retry');

  const always500 = fakeFetch({ status: 500, body: {} });
  await createWhapiProvider({ token: 't', fetchImpl: always500, retryBaseMs: 1 }).sendMessage('0501234567', 'x');
  assert(always500.calls.length === 4, '5xx: 1 try + max 3 retries');

  const quoted = fakeFetch();
  await createWhapiProvider({ token: 't', fetchImpl: quoted }).sendMessage('0501234567', 'x', { replyTo: 'abc-def' });
  assert(quoted.calls[0].body.quoted === 'abc-def', 'replyTo → quoted');
}

async function whapiOpsChecks() {
  const health = fakeFetch({ status: 200, body: { status: { code: 4, text: 'AUTH' }, uptime: 9, user: { id: '972523459199', name: 'Bot' } } });
  const h = await createWhapiProvider({ token: 't', fetchImpl: health }).health();
  assert(h.connected && h.state === 'AUTH' && h.account === '972523459199', 'health → connected AUTH');
  assert(health.calls[0].url.endsWith('/health?wakeup=true') && health.calls[0].init.method === 'GET', 'GET /health');

  const qr = fakeFetch({ status: 200, body: { status: { code: 2, text: 'QR' }, uptime: 1 } });
  assert(!(await createWhapiProvider({ token: 't', fetchImpl: qr }).health()).connected, 'QR state → not connected');

  const limits = fakeFetch({ status: 200, body: { messages: 140, chats: ['972523459199@s.whatsapp.net'], checks: 50, requests: 900 } });
  const u = await createWhapiProvider({ token: 't', fetchImpl: limits }).getUsage();
  assert(u.messagesLeft === 140 && u.requestsLeft === 900 && u.allowedChats[0] === '972523459199', 'GET /limits mapped');

  const contacts = fakeFetch({ status: 200, body: { contacts: [{ input: '972523459199', status: 'valid', wa_id: '972523459199' }] } });
  const c = await createWhapiProvider({ token: 't', fetchImpl: contacts }).checkNumber('052-345-9199');
  assert(c.hasWhatsApp && contacts.calls[0].body.contacts[0] === '972523459199', 'POST /contacts check');

  const settings = fakeFetch({ status: 200, body: {} });
  await createWhapiProvider({ token: 't', fetchImpl: settings }).configureWebhook('https://x.test/api/whatsapp/webhook?secret=s');
  const hook = settings.calls[0];
  assert(hook.init.method === 'PATCH' && hook.url.endsWith('/settings'), 'PATCH /settings');
  assert(hook.body.webhooks[0].events.map((e) => e.type).join() === 'messages,statuses', 'webhook events messages+statuses');

  const read = fakeFetch({ status: 200, body: { success: true } });
  assert(await createWhapiProvider({ token: 't', fetchImpl: read }).markRead('abcd-efgh'), 'mark read');
  assert(read.calls[0].init.method === 'PUT' && read.calls[0].url.endsWith('/messages/abcd-efgh'), 'PUT /messages/{id}');
}

async function outboxChecks() {
  let clock = 0;
  const waits = [];
  const box = createOutbox({
    minIntervalMs: 1000,
    limitPauseMs: 60000,
    now: () => clock,
    sleep: async (ms) => { waits.push(ms); clock += ms; },
  });
  const order = [];
  await Promise.all([1, 2, 3].map((n) => box.run(async () => { order.push(n); return { ok: true, status: 'sent' }; })));
  assert(order.join() === '1,2,3', 'outbox runs in order');
  assert(waits.length === 2 && waits.every((w) => w === 1000), 'outbox spaces sends by the min interval');

  await box.run(async () => ({ ok: false, status: 'failed', limitReached: true, error: 'quota' }));
  let called = false;
  const paused = await box.run(async () => { called = true; return { ok: true, status: 'sent' }; });
  assert(!called && paused.limitReached && box.stats().pausedUntil, 'limit hit → later sends fail fast while paused');
  clock += 60001;
  const resumed = await box.run(async () => ({ ok: true, status: 'sent' }));
  assert(resumed.ok, 'sending resumes after the pause');
}

async function allowlistChecks() {
  const logged = [];
  const store = { async create(_t, data) { logged.push(data); return data; } };
  const fetchImpl = fakeFetch();
  const provider = createWhapiProvider({ token: 't', fetchImpl });
  const env = { WHATSAPP_ALLOWED_RECIPIENTS: '052-345-9199' };

  const blocked = await sendWhatsAppText(/** @type {any} */ (store), { to: '0501111111', text: 'hi' }, { provider, env });
  assert(blocked.status === 'skipped' && fetchImpl.calls.length === 0, 'notification to non-allowlisted number skipped');
  const allowed = await sendWhatsAppText(/** @type {any} */ (store), { to: '0523459199', text: 'hi' }, { provider, env });
  assert(allowed.ok && fetchImpl.calls.length === 1, 'allowlisted number sent');
  const botReply = await sendWhatsAppText(/** @type {any} */ (store), { to: '0501111111', text: 'hi', source: 'bot' }, { provider, env });
  assert(botReply.ok, 'bot replies ignore the notification allowlist');
  assert(logged.length === 3 && logged[1].provider_message_id === 'wamid-1' && logged[1].direction === 'out',
    'every send logged to WhatsAppMessage');
}

function whapiWebhookChecks() {
  const wa = createWhapiProvider({ token: 't', webhookSecret: 's3cret' });
  assert(wa.verifyWebhook({ headers: {}, query: { secret: 's3cret' }, rawBody: undefined }), 'query secret ok');
  assert(wa.verifyWebhook({ headers: { 'x-webhook-secret': 's3cret' }, query: {}, rawBody: undefined }), 'header secret ok');
  assert(!wa.verifyWebhook({ headers: {}, query: { secret: 'nope' }, rawBody: undefined }), 'wrong secret rejected');
  assert(
    !createWhapiProvider({}).verifyWebhook({ headers: {}, query: { secret: '' }, rawBody: undefined }),
    'no configured secret → reject all',
  );

  const events = wa.parseWebhook({
    messages: [
      {
        id: 'm1', from_me: false, type: 'text', chat_id: '972501234567@s.whatsapp.net',
        timestamp: 1760000000, from: '972501234567', from_name: 'Dana', text: { body: 'שלום' },
        context: { quoted_id: 'wamid-1' },
      },
      {
        id: 'm2', from_me: false, type: 'document', chat_id: '972501234567@s.whatsapp.net',
        timestamp: 1760000001, from: '972501234567',
        document: { id: 'd1', mime_type: 'application/pdf', file_name: 'id.pdf', link: 'https://w/d1', caption: 'ת.ז' },
      },
      { id: 'm3', from_me: false, type: 'voice', chat_id: '1203@g.us', from: '972500000000', voice: { id: 'v1', mime_type: 'audio/ogg' } },
      { id: 'echo', from_me: true, type: 'text', chat_id: 'x', text: { body: 'ours' } },
    ],
    statuses: [
      { id: 'wamid-1', status: 'read', recipient_id: '972501234567@s.whatsapp.net', timestamp: 1760000002 },
      { id: 'wamid-2', status: 'pending' },
    ],
    event: { type: 'messages', event: 'post' },
    channel_id: 'CH',
  });

  const msgs = events.filter((e) => e.type === 'message');
  const statuses = events.filter((e) => e.type === 'status');
  assert(msgs.length === 3, 'from_me echo dropped');
  assert(msgs[0].kind === 'text' && msgs[0].text === 'שלום' && msgs[0].from === '972501234567', 'text normalized');
  assert(msgs[0].timestamp === new Date(1760000000 * 1000).toISOString(), 'unix ts → ISO');
  assert(msgs[0].replyTo === 'wamid-1', 'quoted message id → replyTo');
  assert(msgs[1].kind === 'document' && msgs[1].media?.filename === 'id.pdf' && msgs[1].text === 'ת.ז',
    'document media + caption normalized');
  assert(msgs[2].kind === 'audio' && msgs[2].isGroup, 'voice → audio, group detected');
  assert(statuses.length === 1 && statuses[0].status === 'read' && statuses[0].messageId === 'wamid-1',
    'status normalized, unknown status dropped');
}

async function legacyChecks() {
  const fetchImpl = fakeFetch({ status: 200, body: {} });
  const store = {
    async filter() {
      return [
        { key: 'whatsapp_webhook_url', value: 'https://hooks.example.com/wa' },
        { key: 'whatsapp_api_token', value: 'legacy-tok' },
      ];
    },
  };
  const legacy = createLegacyWebhookProvider({ store: /** @type {any} */ (store), fetchImpl });
  const r = await legacy.sendMessage('050', '*T*\n\nB', {
    intent: 'guest.custom',
    context: { title: 'T', body: 'B', ref_message_id: 'g1' },
  });
  const call = fetchImpl.calls[0];
  assert(r.status === 'sent', 'legacy send → sent');
  assert(call.body.title === 'T' && call.body.body === 'B' && call.body.ref_message_id === 'g1',
    'legacy keeps the original body shape');

  const empty = createLegacyWebhookProvider({ store: /** @type {any} */ ({ filter: async () => [] }), fetchImpl });
  assert((await empty.sendMessage('050', 'x')).status === 'not_configured', 'legacy unset → not_configured');
}

function factoryChecks() {
  const store = /** @type {any} */ ({});
  assert(createWhatsAppProvider({ store, env: {} }).name === 'webhook', 'default provider = legacy webhook');
  assert(createWhatsAppProvider({ store, env: { WHATSAPP_PROVIDER: 'WHAPI' } }).name === 'whapi', 'whapi selected');
  assert(createWhatsAppProvider({ store, env: { WHATSAPP_PROVIDER: 'none' } }).name === 'none', 'none selected');
  assert(
    createWhatsAppProvider({ store, env: { WHATSAPP_PROVIDER: 'whapi', WHATSAPP_ENABLED: '0' } }).name === 'none',
    'WHATSAPP_ENABLED=0 disables everything',
  );
  let threw = false;
  try {
    createWhatsAppProvider({ store, env: { WHATSAPP_PROVIDER: 'nope' } });
  } catch {
    threw = true;
  }
  assert(threw, 'unknown provider throws');
}

helperChecks();
await whapiSendChecks();
await whapiOpsChecks();
await outboxChecks();
await allowlistChecks();
whapiWebhookChecks();
await legacyChecks();
factoryChecks();

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nwhatsapp smoke: all checks passed');
