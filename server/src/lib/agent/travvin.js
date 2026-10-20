/**
 * Travvin binding for the agent core — the only file in lib/agent that imports app code.
 * Plugs the existing assistant (owner_assistant / customer_chat profiles), the users table,
 * WhatsAppSession storage and zimmer data into createAgent().
 */
import { handleAssistantChat } from '../assistant/assistant-service.js';
import { SERVICE_ACTOR } from '../service-role.js';
import { userToAuth } from '../user-store.js';
import { getFrontendUrl } from '../env.js';
import { toWhatsAppNumber } from '../whatsapp/index.js';
import { createAgent } from './core.js';

const SESSION_FIELDS = [
  'channel', 'address', 'user_id', 'role', 'display_name', 'profile', 'conversation_id',
  'mode', 'mode_expires_at', 'recent_turns', 'quick_options', 'opted_out', 'last_inbound_at',
];
const MAX_ZIMMERS_LISTED = 5;

/**
 * @param {{
 *   prisma: import('@prisma/client').PrismaClient,
 *   store: ReturnType<import('../entity-store.js').createEntityStore>,
 * }} deps
 */
export function createTravvinAgent({ prisma, store }) {
  return createAgent({
    brain: {
      chat: (req, identity) =>
        handleAssistantChat(req, identity.kind === 'user' ? identity.actor : null, {
          prisma,
          store,
          user: identity.kind === 'user' ? identity.user : null,
        }),
    },
    identities: { resolve: (_channel, address) => resolveIdentityByPhone(prisma, address) },
    sessions: createSessionRepo(store),
    renderEffects: (effects) => renderEffects(store, effects),
  });
}

/**
 * Match the sender's number against users.phone (stored in any local/intl format).
 * More than one account on the same number → 'ambiguous' (never guess whose data to show).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} address International digits.
 * @returns {Promise<import('./core.js').AgentIdentity>}
 */
export async function resolveIdentityByPhone(prisma, address) {
  const number = toWhatsAppNumber(address);
  if (number.length < 9) return { kind: 'anonymous' };
  const tail = number.slice(-9);
  const candidates = await prisma.$queryRaw`
    SELECT id FROM users
    WHERE regexp_replace(coalesce(phone, ''), '\\D', '', 'g') LIKE ${`%${tail}`}
  `;
  const ids = /** @type {{ id: string }[]} */ (candidates).map((r) => r.id);
  if (ids.length === 0) return { kind: 'anonymous' };
  const rows = await prisma.user.findMany({ where: { id: { in: ids } } });
  const matches = rows.filter((u) => toWhatsAppNumber(u.phone || '') === number);
  if (matches.length === 0) return { kind: 'anonymous' };
  if (matches.length > 1) return { kind: 'ambiguous' };
  const user = userToAuth(matches[0]);
  return {
    kind: 'user',
    actor: { id: user.id, role: user.role, email: user.email },
    user,
    name: user.full_name || user.email,
  };
}

/** @param {ReturnType<import('../entity-store.js').createEntityStore>} store */
function createSessionRepo(store) {
  const opts = { actor: SERVICE_ACTOR, createdById: SERVICE_ACTOR.id, createdBy: SERVICE_ACTOR.email };
  const pick = (s) =>
    Object.fromEntries(SESSION_FIELDS.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));

  return {
    async get(channel, address) {
      const [row] = await store.filter('WhatsAppSession', { channel, address }, '-updated_date', 1, SERVICE_ACTOR);
      return row || null;
    },
    async save(session) {
      if (session.id) {
        return { ...(await store.update('WhatsAppSession', session.id, pick(session), SERVICE_ACTOR)), id: session.id };
      }
      return store.create('WhatsAppSession', pick(session), opts);
    },
  };
}

/**
 * Turn assistant uiEffects (cards, widgets, buttons in the web app) into WhatsApp-friendly text.
 * @param {ReturnType<import('../entity-store.js').createEntityStore>} store
 * @param {object[]} effects
 */
async function renderEffects(store, effects) {
  const appUrl = getFrontendUrl() || '';
  /** @type {string[]} */
  const lines = [];
  /** @type {{ label: string, text: string }[]} */
  let quickOptions = [];

  for (const e of /** @type {any[]} */ (effects)) {
    switch (e?.type) {
      case 'show_zimmers': {
        const zimmers = await loadZimmers(store, (e.zimmerIds || []).slice(0, MAX_ZIMMERS_LISTED));
        if (zimmers.length) lines.push(zimmers.map(formatZimmerLine).join('\n'));
        break;
      }
      case 'show_zimmer': {
        const [z] = await loadZimmers(store, [e.zimmerId]);
        if (z) lines.push(formatZimmerDetails(z));
        break;
      }
      case 'quick_options':
        // Options ending with ": " are prompts the web UI pre-fills for typing — not standalone replies.
        quickOptions = (e.options || []).filter(
          (o) => o?.label && o?.text && !String(o.text).trimEnd().endsWith(':'),
        );
        break;
      case 'booking_form':
        if (appUrl) lines.push(`📅 להשלמת ההזמנה באפליקציה: ${appUrl}/chat`);
        break;
      case 'date_search_widget':
        lines.push('📅 כתבו תאריכים (למשל 12-14/11) וכמה אורחים, ואחפש שוב.');
        break;
      case 'owner_action_links':
        if (appUrl) lines.push(`🔗 לפרטים המלאים בפאנל: ${appUrl}/owner`);
        break;
      default:
        break;
    }
  }
  return { lines, quickOptions };
}

async function loadZimmers(store, ids) {
  const rows = await Promise.all(
    ids.filter(Boolean).map((id) => store.get('Zimmer', id, SERVICE_ACTOR).catch(() => null)),
  );
  return rows.filter(Boolean);
}

function formatZimmerLine(z) {
  const parts = [`🏡 *${z.name}*`];
  if (z.location) parts.push(z.location);
  if (z.price_per_night) parts.push(`₪${z.price_per_night} ללילה`);
  return parts.join(' · ');
}

function formatZimmerDetails(z) {
  const lines = [formatZimmerLine(z)];
  const facts = [
    z.num_rooms ? `${z.num_rooms} חדרים` : '',
    z.max_guests ? `עד ${z.max_guests} אורחים` : '',
  ].filter(Boolean);
  if (facts.length) lines.push(facts.join(' · '));
  if (z.description) lines.push(String(z.description).slice(0, 400));
  return lines.join('\n');
}
