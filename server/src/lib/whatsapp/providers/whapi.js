/**
 * WHAPI (gate.whapi.cloud) provider — unofficial WhatsApp API, free text allowed at any time.
 * This is the ONLY file that knows WHAPI endpoints, payloads and webhook shapes.
 * Docs: https://whapi.readme.io/reference
 */
import {
  chatIdToNumber,
  failedResult,
  guessMediaKind,
  isValidWhatsAppNumber,
  toIsoTimestamp,
  toWhatsAppNumber,
  verifySharedSecret,
} from '../helpers.js';

export const WHAPI_DEFAULT_BASE_URL = 'https://gate.whapi.cloud';

const INBOUND_KINDS = new Set([
  'text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact',
]);
const KIND_ALIASES = { voice: 'audio', gif: 'video', short: 'video', link_preview: 'text' };

/** WHAPI status → contract status. Statuses not listed are dropped. */
const STATUS_MAP = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  played: 'read',
  failed: 'failed',
  error: 'failed',
};

/** 429 and 5xx are transient; 400/401/402/403/404 are not. */
const RETRYABLE = (status) => status === 429 || status >= 500;
/** 402 = plan quota used up, 429 = rate limited. */
const LIMIT_STATUSES = new Set([402, 429]);

/**
 * @param {{
 *   token?: string,
 *   baseUrl?: string,
 *   webhookSecret?: string,
 *   fetchImpl?: typeof fetch,
 *   maxRetries?: number,
 *   retryBaseMs?: number,
 * }} config
 * @returns {import('../contract.js').WhatsAppProvider}
 */
export function createWhapiProvider({
  token = '',
  baseUrl = WHAPI_DEFAULT_BASE_URL,
  webhookSecret = '',
  fetchImpl = fetch,
  maxRetries = 3,
  retryBaseMs = 500,
} = {}) {
  const base = baseUrl.replace(/\/$/, '');

  /**
   * One WHAPI call with exponential backoff on 429/5xx/network errors.
   * @returns {Promise<{ ok: boolean, status: number, data: any, error?: string }>}
   */
  async function request(method, path, body) {
    let last = { ok: false, status: 0, data: null, error: 'not attempted' };
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, retryBaseMs * 2 ** (attempt - 1)));
      }
      try {
        const res = await fetchImpl(`${base}${path}`, {
          method,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const data = res.status === 204 ? null : await res.json().catch(() => null);
        last = {
          ok: res.ok,
          status: res.status,
          data,
          error: res.ok ? undefined : data?.error?.message || `HTTP ${res.status}`,
        };
        if (res.ok || !RETRYABLE(res.status)) return last;
      } catch (e) {
        last = { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : String(e) };
      }
    }
    return last;
  }

  /** @returns {Promise<import('../contract.js').SendResult>} */
  async function send(path, payload) {
    if (!token) return { ok: false, status: 'not_configured' };
    try {
      const r = await request('POST', path, payload);
      if (!r.ok || r.data?.sent === false) {
        return {
          ok: false,
          status: 'failed',
          error: r.error || 'not sent',
          ...(LIMIT_STATUSES.has(r.status) ? { limitReached: true } : {}),
        };
      }
      return { ok: true, status: 'sent', providerMessageId: r.data?.message?.id || '' };
    } catch (e) {
      return failedResult(e);
    }
  }

  /** @returns {{ to: string } | { result: import('../contract.js').SendResult }} */
  function recipient(to) {
    if (!String(to || '').trim()) {
      return { result: { ok: false, status: 'skipped', error: 'no recipient phone' } };
    }
    const number = toWhatsAppNumber(to);
    if (!isValidWhatsAppNumber(number)) {
      return { result: { ok: false, status: 'failed', error: 'invalid recipient phone' } };
    }
    return { to: number };
  }

  return {
    name: 'whapi',
    supportsInbound: true,

    async sendMessage(to, text, opts = {}) {
      const r = recipient(to);
      if ('result' in r) return r.result;
      if (!String(text || '').trim()) return { ok: false, status: 'failed', error: 'empty message' };
      return send('/messages/text', {
        to: r.to,
        body: text,
        ...(opts.replyTo ? { quoted: opts.replyTo } : {}),
      });
    },

    async sendMedia(to, fileUrl, opts = {}) {
      const r = recipient(to);
      if ('result' in r) return r.result;
      if (!fileUrl) return { ok: false, status: 'failed', error: 'fileUrl required' };
      const kind = opts.kind || guessMediaKind(fileUrl, opts.mimeType);
      /** @type {Record<string, unknown>} */
      const payload = { to: r.to, media: fileUrl };
      // WHAPI audio messages have no caption.
      if (opts.caption && kind !== 'audio') payload.caption = opts.caption;
      if (opts.filename && kind === 'document') payload.filename = opts.filename;
      if (opts.mimeType) payload.mime_type = opts.mimeType;
      return send(`/messages/${kind}`, payload);
    },

    async markRead(messageId) {
      if (!token || !messageId) return false;
      const r = await request('PUT', `/messages/${encodeURIComponent(messageId)}`);
      return r.ok;
    },

    async checkNumber(phone) {
      const number = toWhatsAppNumber(phone);
      if (!token) return { ok: false, number, error: 'not configured' };
      if (!isValidWhatsAppNumber(number)) return { ok: false, number, error: 'invalid phone' };
      const r = await request('POST', '/contacts', { blocking: 'wait', contacts: [number] });
      if (!r.ok) return { ok: false, number, error: r.error };
      const c = r.data?.contacts?.[0];
      return { ok: true, number, hasWhatsApp: c?.status === 'valid', waId: c?.wa_id || '' };
    },

    async health() {
      if (!token) return { ok: false, connected: false, state: 'NOT_CONFIGURED' };
      const r = await request('GET', '/health?wakeup=true');
      if (!r.ok) return { ok: false, connected: false, state: 'UNREACHABLE', error: r.error };
      const state = String(r.data?.status?.text || 'UNKNOWN');
      return {
        ok: true,
        // AUTH = the linked phone is logged in and the channel can send.
        connected: state === 'AUTH',
        state,
        account: r.data?.user?.id ? chatIdToNumber(r.data.user.id) : '',
        accountName: String(r.data?.user?.name || r.data?.user?.pushname || ''),
        uptimeSeconds: Number(r.data?.uptime || 0),
      };
    },

    async getUsage() {
      if (!token) return { ok: false, error: 'not configured' };
      const r = await request('GET', '/limits');
      if (!r.ok) return { ok: false, error: r.error };
      if (r.status === 204 || !r.data) return { ok: true, unlimited: true };
      return {
        ok: true,
        unlimited: false,
        messagesLeft: Number(r.data.messages ?? 0),
        requestsLeft: Number(r.data.requests ?? 0),
        checksLeft: Number(r.data.checks ?? 0),
        allowedChats: Array.isArray(r.data.chats) ? r.data.chats.map(chatIdToNumber) : [],
      };
    },

    async configureWebhook(url) {
      if (!token) return { ok: false, error: 'not configured' };
      const r = await request('PATCH', '/settings', {
        webhooks: [{
          url,
          mode: 'body',
          events: [
            { type: 'messages', method: 'post' },
            { type: 'statuses', method: 'post' },
          ],
        }],
      });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    },

    // WHAPI does not sign webhooks — use a shared secret in the configured webhook URL/header.
    verifyWebhook: (req) => verifySharedSecret(req, webhookSecret),

    answerWebhookChallenge: () => null,

    parseWebhook(body) {
      /** @type {import('../contract.js').InboundEvent[]} */
      const events = [];
      const payload = /** @type {any} */ (body) || {};

      for (const m of Array.isArray(payload.messages) ? payload.messages : []) {
        // WHAPI echoes our own outbound messages; they are not inbound.
        if (!m || m.from_me) continue;
        const rawKind = KIND_ALIASES[m.type] || m.type;
        const kind = INBOUND_KINDS.has(rawKind) ? rawKind : 'other';
        const mediaObj = m.type !== 'text' && m[m.type] && typeof m[m.type] === 'object'
          ? m[m.type]
          : null;
        const isMedia = ['image', 'video', 'audio', 'document', 'sticker'].includes(kind);
        events.push({
          type: 'message',
          id: String(m.id || ''),
          from: chatIdToNumber(m.from || m.chat_id),
          fromName: String(m.from_name || ''),
          isGroup: String(m.chat_id || '').endsWith('@g.us'),
          timestamp: toIsoTimestamp(m.timestamp),
          kind,
          text: String(m.text?.body ?? m.link_preview?.body ?? mediaObj?.caption ?? ''),
          replyTo: String(m.context?.quoted_id || ''),
          media: isMedia && mediaObj
            ? {
              id: String(mediaObj.id || ''),
              url: String(mediaObj.link || ''),
              mimeType: String(mediaObj.mime_type || ''),
              filename: String(mediaObj.file_name || mediaObj.filename || ''),
              caption: String(mediaObj.caption || ''),
            }
            : null,
        });
      }

      for (const s of Array.isArray(payload.statuses) ? payload.statuses : []) {
        const status = STATUS_MAP[s?.status];
        if (!status) continue;
        events.push({
          type: 'status',
          messageId: String(s.id || ''),
          recipient: chatIdToNumber(s.recipient_id),
          status,
          timestamp: toIsoTimestamp(s.timestamp),
        });
      }

      return events;
    },
  };
}
