/**
 * WhatsApp ops CLI (uses the same provider layer as the server).
 *
 *   npm run whatsapp -- health                      channel connected? which number?
 *   npm run whatsapp -- usage                       plan limits left
 *   npm run whatsapp -- check <phone>               does the number have WhatsApp?
 *   npm run whatsapp -- send <phone> <text...>      send a real message
 *   npm run whatsapp -- webhook <public-base-url>   point the provider webhook at this server
 *   npm run whatsapp -- chat <phone> <text...>      run the AI agent as if <phone> wrote <text>
 *                                                   (prints the reply, sends nothing)
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Same env order as src/index.js: server/.env wins, root .env.local fills the rest.
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const { PrismaClient } = await import('@prisma/client');
const { createEntityStore } = await import('../src/lib/entity-store.js');
const { createWhatsAppProvider, sendWhatsAppText } = await import('../src/lib/whatsapp/index.js');

const [cmd, ...args] = process.argv.slice(2);
const prisma = new PrismaClient();
const store = createEntityStore(prisma);
const provider = createWhatsAppProvider({ store });

async function main() {
  switch (cmd) {
    case 'health':
      return print(await need('health')());
    case 'usage':
      return print(await need('getUsage')());
    case 'check':
      return print(await need('checkNumber')(arg(0, 'phone')));
    case 'send': {
      const text = args.slice(1).join(' ');
      if (!text) throw new Error('usage: send <phone> <text...>');
      return print(await sendWhatsAppText(store, { to: arg(0, 'phone'), text, source: 'manual', intent: 'cli.test' }));
    }
    case 'webhook': {
      const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
      if (!secret) throw new Error('WHATSAPP_WEBHOOK_SECRET is not set');
      const base = arg(0, 'public-base-url').replace(/\/$/, '');
      const url = `${base}/api/whatsapp/webhook?secret=${encodeURIComponent(secret)}`;
      const r = await need('configureWebhook')(url);
      return print({ ...r, url: url.replace(encodeURIComponent(secret), '<secret>') });
    }
    case 'chat': {
      const text = args.slice(1).join(' ');
      if (!text) throw new Error('usage: chat <phone> <text...>');
      const { createTravvinAgent } = await import('../src/lib/agent/travvin.js');
      const { toWhatsAppNumber } = await import('../src/lib/whatsapp/index.js');
      const agent = createTravvinAgent({ prisma, store });
      const r = await agent.handleMessage({ channel: 'whatsapp', address: toWhatsAppNumber(arg(0, 'phone')), text });
      console.log(`[identity: ${r.identity.kind}${r.identity.actor ? ` ${r.identity.actor.role}` : ''} | profile: ${r.session.profile || '-'} | mode: ${r.session.mode}]`);
      console.log(r.reply ?? '(no reply)');
      return;
    }
    default:
      console.log('commands: health | usage | check <phone> | send <phone> <text> | webhook <public-base-url> | chat <phone> <text>');
      console.log(`provider: ${provider.name}`);
  }
}

function need(method) {
  const fn = provider[method];
  if (typeof fn !== 'function') throw new Error(`provider "${provider.name}" does not support ${method}`);
  return fn.bind(provider);
}

function arg(i, name) {
  if (!args[i]) throw new Error(`missing <${name}>`);
  return args[i];
}

function print(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

main()
  .catch((e) => {
    console.error('error:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
