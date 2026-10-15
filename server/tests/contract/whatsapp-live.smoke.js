/**
 * LIVE WhatsApp check against the real provider — opt-in, uses plan quota.
 * Runs only with WHATSAPP_LIVE_TEST=1. Sends one message to WHATSAPP_LIVE_TEST_TO
 * (default: the channel's own number, so no new chat is opened).
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

if (process.env.WHATSAPP_LIVE_TEST !== '1') {
  console.log('whatsapp live: skipped (set WHATSAPP_LIVE_TEST=1 to run — sends a real message)');
  process.exit(0);
}

const { createWhatsAppProvider } = await import('../../src/lib/whatsapp/index.js');

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

const provider = createWhatsAppProvider({ store: /** @type {any} */ ({}) });
assert(provider.name !== 'none' && provider.name !== 'webhook', `real provider configured (${provider.name})`);

const health = provider.health ? await provider.health() : null;
assert(health?.connected === true, `channel connected (state=${health?.state})`);

const to = process.env.WHATSAPP_LIVE_TEST_TO || health?.account || '';
const sent = await provider.sendMessage(to, `✅ Travvin live test ${new Date().toISOString()}`);
assert(sent.ok && !!sent.providerMessageId, `message sent to ${to} (id=${sent.providerMessageId || sent.error})`);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nwhatsapp live: all checks passed');
