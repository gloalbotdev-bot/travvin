/**
 * WhatsApp channel for the AI agent: inbound webhook events → agent → reply.
 * Provider-agnostic — talks to WhatsApp only through lib/whatsapp/index.js.
 */
import {
  applyStatusEvent,
  createWhatsAppProvider,
  logWhatsAppMessage,
  sendWhatsAppText,
  toWhatsAppNumber,
  wasInboundSeen,
} from '../whatsapp/index.js';

const CHANNEL = 'whatsapp';
const SEEN_CACHE_SIZE = 500;
const UNSUPPORTED_REPLY = 'כרגע אני מבין רק הודעות טקסט 🙏 כתבו לי במילים ואשמח לעזור.';

/**
 * @param {{
 *   store: ReturnType<import('../entity-store.js').createEntityStore>,
 *   agent: { handleMessage: (input: { channel: string, address: string, text: string, displayName?: string }) => Promise<{ reply: string | null, identity: { kind: string, actor?: { id: string } | null } }> },
 *   provider?: import('../whatsapp/contract.js').WhatsAppProvider,
 *   env?: NodeJS.ProcessEnv,
 * }} deps
 */
export function createWhatsAppBot({ store, agent, provider, env = process.env }) {
  const wa = provider || createWhatsAppProvider({ store, env });
  const allowedSenders = parseNumberList(env.WHATSAPP_BOT_ALLOWED_SENDERS);
  const markRead = ['1', 'true', 'on'].includes(String(env.WHATSAPP_MARK_READ || '').toLowerCase());
  /** Recently handled ids — fast path before the DB check (webhooks retry quickly). */
  const seen = new Set();
  /** Per-sender promise chain so one person's messages are answered in order. */
  const chains = new Map();

  /** @param {import('../whatsapp/contract.js').InboundEvent[]} events */
  async function handleEvents(events) {
    for (const event of events) {
      if (event.type === 'status') {
        await applyStatusEvent(store, event).catch((e) =>
          console.warn('[whatsapp-bot] status update failed:', e instanceof Error ? e.message : e));
        continue;
      }
      const from = toWhatsAppNumber(event.from);
      if (!from || event.isGroup) continue;
      if (allowedSenders && !allowedSenders.has(from)) {
        console.log('[whatsapp-bot] ignoring sender not in WHATSAPP_BOT_ALLOWED_SENDERS');
        continue;
      }
      const prev = chains.get(from) || Promise.resolve();
      const next = prev.then(() => handleMessage(event, from)).catch((e) =>
        console.error('[whatsapp-bot] message failed:', e instanceof Error ? e.message : e));
      chains.set(from, next);
      next.finally(() => {
        if (chains.get(from) === next) chains.delete(from);
      });
    }
  }

  /**
   * @param {import('../whatsapp/contract.js').InboundMessageEvent} event
   * @param {string} from
   */
  async function handleMessage(event, from) {
    if (event.id) {
      if (seen.has(event.id) || (await wasInboundSeen(store, event.id))) return;
      remember(event.id);
    }

    await logWhatsAppMessage(store, {
      direction: 'in',
      provider: wa.name,
      provider_message_id: event.id,
      phone: from,
      source: 'bot',
      kind: event.kind,
      body: event.text,
      status: 'received',
      reply_to: event.replyTo,
    });
    if (markRead && event.id && wa.markRead) wa.markRead(event.id).catch(() => {});

    if (event.kind !== 'text' || !event.text.trim()) {
      await reply(from, UNSUPPORTED_REPLY, event.id, '');
      return;
    }

    const result = await agent.handleMessage({
      channel: CHANNEL,
      address: from,
      text: event.text,
      displayName: event.fromName,
    });
    if (result.reply) {
      const userId = result.identity.kind === 'user' ? result.identity.actor?.id || '' : '';
      await reply(from, result.reply, event.id, userId);
    }
  }

  // Replies are plain messages (not quoted) — in a 1:1 chat quoting every answer is noise.
  async function reply(to, text, inReplyTo, userId) {
    const r = await sendWhatsAppText(
      store,
      { to, text, source: 'bot', intent: 'bot.reply', userId, context: { in_reply_to: inReplyTo } },
      { provider: wa, env },
    );
    if (!r.ok) console.warn('[whatsapp-bot] reply not sent:', r.status, r.error || '');
    return r;
  }

  function remember(id) {
    seen.add(id);
    if (seen.size > SEEN_CACHE_SIZE) seen.delete(seen.values().next().value);
  }

  /** Resolves when every queued message has been answered (tests / graceful shutdown). */
  async function idle() {
    while (chains.size) await Promise.allSettled([...chains.values()]);
  }

  return { handleEvents, idle };
}

/** @returns {Set<string> | null} */
function parseNumberList(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  return new Set(s.split(',').map((p) => toWhatsAppNumber(p)).filter(Boolean));
}
