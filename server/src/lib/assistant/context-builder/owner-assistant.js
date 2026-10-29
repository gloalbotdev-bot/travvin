/**
 * Owner assistant context builder — shared owner base + surface (home / calendar / bookings).
 */
import { sanitizeOwnerText } from '../../sanitize-prompt-data.js';
import { buildOwnerBaseContext, parseOwnerSurface } from './owner-base.js';

const MAX_RECENT_TURNS = 20;
const ASSISTANT_SURFACES = new Set(['home', 'calendar', 'bookings', 'messages', 'zimmer_creator']);

export function parseOwnerClientState(clientState) {
  const base =
    clientState && typeof clientState === 'object' && !Array.isArray(clientState)
      ? clientState
      : {};

  const recentTurns = normalizeRecentTurns(base.recentTurns);
  const { surface, focus } = parseOwnerSurface(base, 'home');

  return {
    recentTurns,
    surface: ASSISTANT_SURFACES.has(surface) ? surface : 'home',
    focus,
  };
}

function normalizeRecentTurns(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-MAX_RECENT_TURNS).flatMap((t) => {
    if (!t || typeof t !== 'object') return [];
    const role = t.role === 'user' || t.role === 'bot' ? t.role : null;
    if (!role) return [];
    const content = sanitizeOwnerText(String(t.content || ''));
    if (!content) return [];
    return [{ role, content }];
  });
}

/**
 * Resolve owner id from JWT actor — never trust client ownerId for owners.
 * @param {import('../../authz.js').Actor|null|undefined} actor
 * @param {unknown} clientState
 */
export function resolveOwnerId(actor, clientState) {
  if (!actor?.id) return null;
  if (actor.role === 'owner') return actor.id;
  if (actor.role === 'admin') {
    const requested = clientState?.ownerId;
    if (typeof requested === 'string' && requested.trim()) return requested.trim();
    return actor.id;
  }
  return null;
}

/**
 * @param {{ store: ReturnType<import('../../entity-store.js').createEntityStore> }} deps
 * @param {{ actor: import('../../authz.js').Actor, ownerId: string, message: string, clientState: unknown }} input
 */
export async function buildOwnerAssistantContext(deps, input) {
  const { actor, ownerId, message, clientState } = input;
  const parsed = parseOwnerClientState(clientState);
  const base = await buildOwnerBaseContext(deps, {
    actor,
    ownerId,
    message,
    focus: parsed.focus,
  });

  // Owners remember through the shared thread; admins (no thread) send their own recent turns.
  const historyText = base.memoryText
    ? ''
    : parsed.recentTurns
        .map((m) => (m.role === 'user' ? `בעל מתחם: ${m.content}` : `עוזר: ${m.content}`))
        .join('\n');

  const mode = clientState?.mode === 'info' || clientState?.mode === 'edit' ? clientState.mode : null;

  return {
    ...base,
    surface: parsed.surface,
    assistantMode: mode,
    historyText,
    contextStr: base.snapshotStr,
  };
}
