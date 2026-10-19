/**
 * Interactive creator/editor profiles — Phase 8.
 */
import { MAX_OWNER_TEXT_CHARS, sanitizeUntrustedText } from '../../sanitize-prompt-data.js';
import { normalizeOneshotTurns } from './oneshot.js';
import { resolveOwnerId } from './owner-assistant.js';
import { describeMinNightsRules } from '../../booking-price.js';

export const MAX_WIZARD_TURNS = 100;

function wizardTurns(raw) {
  return normalizeOneshotTurns(raw, MAX_WIZARD_TURNS, { maxChars: MAX_OWNER_TEXT_CHARS });
}

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

  const recentTurns = wizardTurns(clientState?.recentTurns);
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
      min_nights_rules: zimmer.min_nights_rules || [],
      amenities: zimmer.amenities || [],
      outdoor_area: zimmer.outdoor_area || null,
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

  const recentTurns = wizardTurns(clientState?.recentTurns);
  const today = new Date().toISOString().split('T')[0];

  return {
    ownerId,
    zimmers,
    zimmerNames: zimmers.map((z) => z.name).join(', '),
    minNightsLines: zimmers
      .map((z) => {
        const d = describeMinNightsRules(z);
        return d ? `- ${z.name}: ${d}` : '';
      })
      .filter(Boolean)
      .join('\n'),
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

  const recentTurns = wizardTurns(clientState?.recentTurns);
  const uploadedImageCount = Number(clientState?.uploadedImageCount) || 0;
  const customBedTypes = (Array.isArray(clientState?.customBedTypes) ? clientState.customBedTypes : [])
    .slice(0, 20)
    .flatMap((t) => {
      const label = sanitizeUntrustedText(String(t?.custom_label || ''), 60);
      if (!label) return [];
      const sleeps = Number(t?.sleeps);
      return [{ custom_label: label, sleeps: Number.isFinite(sleeps) && sleeps > 0 ? sleeps : null }];
    });

  return {
    conversationData,
    conversationDataStr: JSON.stringify(conversationData),
    customBedTypes,
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
    minNightsText: describeMinNightsRules(zimmer),
  };
}
