/**
 * Legacy provider (pre-WHAPI behaviour): POST a generic JSON body to the URL stored in
 * AppSetting `whatsapp_webhook_url`, with optional Bearer `whatsapp_api_token`.
 * Outbound only. Kept so existing deployments keep working until WHATSAPP_PROVIDER is set.
 */
import { assertSafeHttpsUrl } from '../../safe-webhook-url.js';
import { SERVICE_ACTOR } from '../../service-role.js';
import { failedResult } from '../helpers.js';

/**
 * @param {ReturnType<import('../../entity-store.js').createEntityStore>} store
 */
async function loadSettings(store) {
  const settings = await store.filter('AppSetting', {}, undefined, undefined, SERVICE_ACTOR);
  let webhookUrl = '';
  let apiToken = '';
  for (const s of settings || []) {
    if (s.key === 'whatsapp_webhook_url') webhookUrl = s.value || '';
    if (s.key === 'whatsapp_api_token') apiToken = s.value || '';
  }
  return { webhookUrl, apiToken };
}

/**
 * @param {{
 *   store: ReturnType<import('../../entity-store.js').createEntityStore>,
 *   fetchImpl?: typeof fetch,
 * }} config
 * @returns {import('../contract.js').WhatsAppProvider}
 */
export function createLegacyWebhookProvider({ store, fetchImpl = fetch }) {
  /** @returns {Promise<import('../contract.js').SendResult>} */
  async function post(body) {
    const { webhookUrl, apiToken } = await loadSettings(store);
    if (!webhookUrl) return { ok: false, status: 'not_configured' };
    let safeUrl;
    try {
      safeUrl = assertSafeHttpsUrl(webhookUrl);
    } catch (e) {
      return failedResult(e);
    }
    try {
      const res = await fetchImpl(safeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
      return res.ok
        ? { ok: true, status: 'sent' }
        : { ok: false, status: 'failed', error: `HTTP ${res.status}` };
    } catch (e) {
      return failedResult(e);
    }
  }

  return {
    name: 'webhook',
    supportsInbound: false,
    // `context` carries the original fields (title, body, ids…) so the receiver sees the same body as before.
    sendMessage: (to, text, opts = {}) => post({ to, body: text, ...opts.context }),
    sendMedia: (to, fileUrl, opts = {}) =>
      post({ to, media_url: fileUrl, caption: opts.caption || '', ...opts.context }),
    verifyWebhook: () => false,
    answerWebhookChallenge: () => null,
    parseWebhook: () => [],
  };
}
