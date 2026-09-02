/**
 * Interactive creator/editor profiles — Phase 8.
 */
import { sanitizeUntrustedText } from '../../sanitize-prompt-data.js';
import { normalizeOneshotTurns } from './oneshot.js';
import { resolveOwnerId } from './owner-assistant.js';

function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    const err = new Error(`${field} required in clientState`);
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }
  return value.trim();
}

function formatTurnsForPrompt(turns, userLabel = 'משתמש', botLabel = 'מערכת') {
  return turns
    .map((m) => `${m.role === 'user' ? userLabel : botLabel}: ${m.content}`)
    .join('\n');
}

/**
 * @param {{ store: ReturnType<import('../../entity-store.js').createEntityStore> }} deps
 */
export async function buildAdminZimmerEditorContext(deps, { actor, clientState }) {
  const zimmerId = requireString(clientState?.zimmerId, 'zimmerId');
  const zimmer = await deps.store.get('Zimmer', zimmerId, actor);

  if (actor.role === 'owner' && String(zimmer.owner_id) !== String(actor.id)) {
    const err = new Error('Forbidden: zimmer belongs to another owner');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const recentTurns = normalizeOneshotTurns(clientState?.recentTurns);
  const todayHe = new Date().toLocaleDateString('he-IL');

  return {
    zimmerId,
    zimmer,
    zimmerJson: JSON.stringify({
      id: zimmer.id,
      name: zimmer.name,
      location: zimmer.location,
      price_per_night: zimmer.price_per_night,
      num_rooms: zimmer.num_rooms,
      max_guests: zimmer.max_guests,
      description: zimmer.description,
      data_zones: zimmer.data_zones || [],
      images: zimmer.images || [],
    }),
    historyText: formatTurnsForPrompt(recentTurns, 'מנהל', 'מערכת'),
    todayHe,
  };
}

/**
 * @param {{ store: ReturnType<import('../../entity-store.js').createEntityStore> }} deps
 */
export async function buildOwnerBookingCreatorContext(deps, { actor, clientState }) {
  const ownerId = resolveOwnerId(actor, clientState);
  if (!ownerId) {
    const err = new Error('ownerId required');
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }

  const zimmers = await deps.store.filter(
    'Zimmer',
    { owner_id: ownerId },
    '-created_date',
    200,
    actor,
  );

  const collectedData =
    clientState?.collectedData && typeof clientState.collectedData === 'object'
      ? clientState.collectedData
      : {};

  const recentTurns = normalizeOneshotTurns(clientState?.recentTurns, 30);
  const today = new Date().toISOString().split('T')[0];

  return {
    ownerId,
    zimmers,
    zimmerNames: zimmers.map((z) => z.name).join(', '),
    collectedData,
    collectedDataStr: JSON.stringify(collectedData),
    historyText: formatTurnsForPrompt(recentTurns, 'בעל המתחם', 'עוזר'),
    today,
  };
}

/**
 * @param {{ store: ReturnType<import('../../entity-store.js').createEntityStore> }} deps
 */
export async function buildOwnerZimmerCreatorContext(deps, { actor, clientState }) {
  resolveOwnerId(actor, clientState);

  const conversationData =
    clientState?.conversationData && typeof clientState.conversationData === 'object'
      ? clientState.conversationData
      : {};

  const recentTurns = normalizeOneshotTurns(clientState?.recentTurns, 40);
  const uploadedImageCount = Number(clientState?.uploadedImageCount) || 0;

  return {
    conversationData,
    conversationDataStr: JSON.stringify(conversationData),
    historyText: recentTurns
      .map((m) =>
        m.role === 'user'
          ? `בעל הצימר: ${m.content}`
          : `מערכת: ${m.content}`,
      )
      .join('\n'),
    uploadedImageCount,
  };
}

/**
 * @param {{ store: ReturnType<import('../../entity-store.js').createEntityStore> }} deps
 */
export async function buildOwnerZimmerKnowledgeContext(deps, { actor, clientState }) {
  const zimmerId = requireString(clientState?.zimmerId, 'zimmerId');
  const zimmer = await deps.store.get('Zimmer', zimmerId, actor);

  if (actor.role === 'owner' && String(zimmer.owner_id) !== String(actor.id)) {
    const err = new Error('Forbidden: zimmer belongs to another owner');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const zones = (zimmer.data_zones || [])
    .map((z) => sanitizeUntrustedText(String(z.content || '')))
    .filter(Boolean)
    .join('\n---\n');

  return {
    zimmerId,
    zimmer,
    zonesText: zones || 'אין',
  };
}
