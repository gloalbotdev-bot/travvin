/**
 * WhatsApp facade — the only entry point the rest of the server uses.
 * Provider is chosen by WHATSAPP_PROVIDER (whapi | webhook | none); see README.md in this folder.
 */
import { createLegacyWebhookProvider } from './providers/legacy-webhook.js';
import { createWhapiProvider } from './providers/whapi.js';
import { isValidWhatsAppNumber, toWhatsAppNumber } from './helpers.js';
import { getOutbox } from './outbox.js';
import { logWhatsAppMessage } from './message-log.js';

export { toWhatsAppNumber } from './helpers.js';
export { applyStatusEvent, logWhatsAppMessage, wasInboundSeen } from './message-log.js';

/** @type {import('./contract.js').WhatsAppProvider} */
const disabledProvider = {
  name: 'none',
  supportsInbound: false,
  sendMessage: async () => ({ ok: false, status: 'not_configured' }),
  sendMedia: async () => ({ ok: false, status: 'not_configured' }),
  verifyWebhook: () => false,
  answerWebhookChallenge: () => null,
  parseWebhook: () => [],
};

/** WHATSAPP_ENABLED=0 turns every send and the inbound bot off without touching other config. */
export function isWhatsAppEnabled(env = process.env) {
  return !['0', 'false', 'off', 'no'].includes(String(env.WHATSAPP_ENABLED ?? '').trim().toLowerCase());
}

/**
 * @param {{
 *   store: ReturnType<import('../entity-store.js').createEntityStore>,
 *   env?: NodeJS.ProcessEnv,
 *   fetchImpl?: typeof fetch,
 * }} deps
 * @returns {import('./contract.js').WhatsAppProvider}
 */
export function createWhatsAppProvider({ store, env = process.env, fetchImpl }) {
  if (!isWhatsAppEnabled(env)) return disabledProvider;

  // Default keeps the pre-provider behaviour (AppSetting webhook) for existing deployments.
  const name = (env.WHATSAPP_PROVIDER || 'webhook').trim().toLowerCase();

  if (name === 'whapi') {
    return createWhapiProvider({
      token: env.WHAPI_TOKEN || '',
      baseUrl: env.WHAPI_BASE_URL || undefined,
      webhookSecret: env.WHATSAPP_WEBHOOK_SECRET || '',
      fetchImpl,
    });
  }
  if (name === 'webhook') return createLegacyWebhookProvider({ store, fetchImpl });
  if (name === 'none') return disabledProvider;

  throw new Error(`Unsupported WHATSAPP_PROVIDER: ${name}`);
}

/** WhatsApp has no separate subject line — bold the title above the body. */
export function composeWhatsAppText(title, body) {
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  if (!t) return b;
  if (!b) return `*${t}*`;
  return `*${t}*\n\n${b}`;
}

/**
 * WHATSAPP_ALLOWED_RECIPIENTS (comma-separated numbers) restricts automatic notifications —
 * a safety valve for trials/dev so crons can't message real guests. Unset = everyone.
 * @returns {Set<string> | null}
 */
export function notificationAllowlist(env = process.env) {
  const raw = String(env.WHATSAPP_ALLOWED_RECIPIENTS || '').trim();
  if (!raw) return null;
  return new Set(raw.split(',').map((p) => toWhatsAppNumber(p)).filter(Boolean));
}

/**
 * Send one WhatsApp text through the shared queue and log it.
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {{
 *   to: string,
 *   text: string,
 *   source?: 'notification' | 'bot' | 'manual',
 *   userId?: string,
 * } & import('./contract.js').SendOptions} message
 * @param {{ provider?: import('./contract.js').WhatsAppProvider, env?: NodeJS.ProcessEnv }} [deps]
 * @returns {Promise<import('./contract.js').SendResult>}
 */
export async function sendWhatsAppText(store, message, deps = {}) {
  const { to, text, source = 'notification', userId, ...opts } = message;
  const env = deps.env || process.env;
  const number = toWhatsAppNumber(to);

  /** @type {import('./contract.js').SendResult} */
  let result;
  let providerName = 'none';
  const allow = source === 'notification' ? notificationAllowlist(env) : null;

  if (allow && isValidWhatsAppNumber(number) && !allow.has(number)) {
    result = { ok: false, status: 'skipped', error: 'recipient not in WHATSAPP_ALLOWED_RECIPIENTS' };
  } else {
    try {
      const provider = deps.provider || createWhatsAppProvider({ store, env });
      providerName = provider.name;
      result = provider.name === 'none'
        ? await provider.sendMessage(to, text, opts)
        : await getOutbox().run(() => provider.sendMessage(to, text, opts));
    } catch (e) {
      result = { ok: false, status: 'failed', error: e instanceof Error ? e.message : String(e) };
    }
  }

  if (result.status !== 'not_configured') {
    await logWhatsAppMessage(store, {
      direction: 'out',
      provider: providerName,
      provider_message_id: result.providerMessageId,
      phone: number || String(to || ''),
      user_id: userId,
      source,
      intent: opts.intent,
      kind: 'text',
      body: text,
      status: result.status,
      error: result.error,
      reply_to: opts.replyTo,
      ref_id: typeof opts.context?.ref_message_id === 'string' ? opts.context.ref_message_id : undefined,
    });
  }
  return result;
}

/**
 * Send a notification text and return the `delivery_status` fragment stored on
 * GuestMessage / SupplierMessage.
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {{ to: string, text: string } & import('./contract.js').SendOptions} message
 * @returns {Promise<{ whatsapp: import('./contract.js').SendStatus, whatsapp_error?: string }>}
 */
export async function deliverWhatsAppText(store, message) {
  const result = await sendWhatsAppText(store, { ...message, source: 'notification' });
  return {
    whatsapp: result.status,
    ...(result.error ? { whatsapp_error: result.error } : {}),
  };
}

/** Queue / counters snapshot for the admin status endpoint. */
export function whatsAppOutboxStats() {
  return getOutbox().stats();
}
