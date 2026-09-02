/**
 * Owner assistant context builder — Phase 6.
 */
import { sanitizeUntrustedText } from '../../sanitize-prompt-data.js';
import { loadRecentOwnerActions } from '../conversation-service.js';

const MAX_RECENT_TURNS = 8;

export function parseOwnerClientState(clientState) {
  const base =
    clientState && typeof clientState === 'object' && !Array.isArray(clientState)
      ? clientState
      : {};

  const mode = base.mode === 'edit' ? 'edit' : 'info';
  const recentTurns = normalizeRecentTurns(base.recentTurns);

  return { mode, recentTurns };
}

function normalizeRecentTurns(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-MAX_RECENT_TURNS).flatMap((t) => {
    if (!t || typeof t !== 'object') return [];
    const role = t.role === 'user' || t.role === 'bot' ? t.role : null;
    if (!role) return [];
    const content = sanitizeUntrustedText(String(t.content || '')).slice(0, 2000);
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
  const { store } = deps;
  const { actor, ownerId, message, clientState } = input;
  const parsed = parseOwnerClientState(clientState);

  const [zimmers, bookings, questions, reviews, recentActions] = await Promise.all([
    store.filter('Zimmer', { owner_id: ownerId }, '-created_date', 200, actor),
    store.filter('BookingRequest', { owner_id: ownerId }, '-created_date', 100, actor),
    store.filter('UnansweredQuestion', { owner_id: ownerId }, '-created_date', 20, actor),
    store.filter('Review', { owner_id: ownerId }, '-created_date', 20, actor),
    loadRecentOwnerActions(store, actor, 10),
  ]);

  const today = new Date().toISOString().split('T')[0];
  const historyText = parsed.recentTurns
    .map((m) =>
      m.role === 'user' ? `בעל מתחם: ${m.content}` : `עוזר: ${m.content}`,
    )
    .join('\n');

  const actionLogText =
    recentActions.length > 0
      ? recentActions
          .slice(0, 5)
          .map(
            (a) =>
              `• [${a.action_type}] ${a.profile}: ${sanitizeUntrustedText(String(a.summary || '')).slice(0, 120)}`,
          )
          .join('\n')
      : '• (אין פעולות אחרונות)';

  const contextStr = `
היום: ${today}

צימרים (${zimmers.length}):
${zimmers
  .map(
    (z) =>
      `id:${z.id} | ${z.name} | מיקום: ${z.location || '—'} | מחיר/לילה: ${z.price_per_night ?? '—'} | אמצ"ש: ${z.weekday_price ?? '—'} | סופ"ש: ${z.weekend_price ?? '—'} | חדרים: ${z.num_rooms ?? '—'} | אורחים מקס: ${z.max_guests ?? '—'} | סטטוס: ${z.approval_status} | תיאור: ${z.description || 'אין'}`,
  )
  .join('\n')}

הזמנות (${bookings.length}):
${bookings
  .map(
    (b) =>
      `• ${b.guest_name} | צימר: ${b.zimmer_name} | כניסה: ${b.check_in} | יציאה: ${b.check_out} | אורחים: ${b.num_guests || 1} | סטטוס: ${b.status} | טלפון: ${b.guest_phone}`,
  )
  .join('\n')}

שאלות לקוחות פתוחות (${questions.filter((q) => q.status === 'ממתינה').length}):
${questions
  .map((q) => `• "${q.question}" על ${q.zimmer_name} | סטטוס: ${q.status}`)
  .join('\n')}

ביקורות (${reviews.length}):
${reviews
  .map(
    (r) =>
      `• ${r.guest_name || 'אנונימי'} | ${r.zimmer_name} | דירוג: ${r.rating}/5 | "${r.text || ''}"`,
  )
  .join('\n')}

פעולות assistant אחרונות:
${actionLogText}
`;

  return {
    mode: parsed.mode,
    ownerId,
    zimmers,
    bookings,
    questions,
    reviews,
    contextStr,
    historyText,
    userMessage: sanitizeUntrustedText(message),
    recentActions,
  };
}
