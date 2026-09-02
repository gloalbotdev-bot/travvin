/**
 * One-shot assistant profiles — Phase 7 (tips, summaries, vacation agent).
 */
import { sanitizeUntrustedText } from '../../sanitize-prompt-data.js';
import { resolveOwnerId } from './owner-assistant.js';

const MAX_RECENT_TURNS = 12;
const MAX_TURN_CHARS = 2000;

export function normalizeOneshotTurns(raw, limit = MAX_RECENT_TURNS) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-limit).flatMap((t) => {
    if (!t || typeof t !== 'object') return [];
    const role = t.role === 'user' || t.role === 'bot' ? t.role : null;
    if (!role) return [];
    const content = sanitizeUntrustedText(String(t.content || '')).slice(0, MAX_TURN_CHARS);
    if (!content) return [];
    return [{ role, content }];
  });
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

/**
 * @param {{ store: ReturnType<import('../../entity-store.js').createEntityStore> }} deps
 * @param {{ actor: import('../../authz.js').Actor, clientState: unknown }} input
 */
export async function buildOwnerTipsContext(deps, { actor, clientState }) {
  const ownerId = resolveOwnerId(actor, clientState);
  if (!ownerId) {
    const err = new Error('ownerId required');
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }

  const [zimmers, bookings] = await Promise.all([
    deps.store.filter('Zimmer', { owner_id: ownerId }, '-created_date', 200, actor),
    deps.store.filter('BookingRequest', { owner_id: ownerId }, '-created_date', 500, actor),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const checkinsToday = bookings.filter(
    (b) => b.check_in === today && b.status === 'אושרה',
  ).length;
  const checkoutsToday = bookings.filter(
    (b) => b.check_out === today && b.status === 'אושרה',
  ).length;
  const currentlyStaying = bookings.filter(
    (b) => b.status === 'אושרה' && b.check_in <= today && b.check_out > today,
  ).length;
  const monthBookings = bookings.filter(
    (b) => b.status === 'אושרה' && b.check_in?.startsWith(thisMonth),
  );
  const monthRevenue = monthBookings.reduce((sum, b) => {
    const nights = Math.max(
      1,
      Math.ceil((new Date(b.check_out) - new Date(b.check_in)) / 86400000),
    );
    const zimmer = zimmers.find((z) => z.id === b.zimmer_id);
    return sum + (zimmer?.price_per_night || 0) * nights;
  }, 0);
  const pendingCount = bookings.filter((b) => b.status === 'ממתינה').length;
  const zimmerNames = zimmers.map((z) => z.name).join(', ');

  return {
    ownerId,
    zimmerNames: zimmerNames || 'צימר',
    checkinsToday,
    checkoutsToday,
    currentlyStaying,
    monthBookingsCount: monthBookings.length,
    monthRevenue,
    pendingCount,
  };
}

/**
 * @param {{ store: ReturnType<import('../../entity-store.js').createEntityStore> }} deps
 * @param {{ actor: import('../../authz.js').Actor, clientState: unknown }} input
 */
export async function buildAdminSessionSummaryContext(deps, { actor, clientState }) {
  const sessionId = requireString(clientState?.sessionId, 'sessionId');
  const session = await deps.store.get('ChatSession', sessionId, actor);
  const msgText = (session.messages || [])
    .map((m) => `${m.role === 'user' ? 'לקוח' : 'בוט'}: ${m.content}`)
    .join('\n');

  return {
    sessionId,
    session,
    msgText: msgText || 'אין הודעות',
    zimmerCount: session.zimmer_ids_shown?.length || 0,
    bookingCreated: !!session.booking_created,
  };
}

/**
 * @param {{ store: ReturnType<import('../../entity-store.js').createEntityStore> }} deps
 * @param {{ actor: import('../../authz.js').Actor, clientState: unknown }} input
 */
export async function buildInfoSummaryContext(deps, { actor, clientState }) {
  const zimmerId = requireString(clientState?.zimmerId, 'zimmerId');
  const zimmer = await deps.store.get('Zimmer', zimmerId, actor);

  if (actor.role === 'owner' && String(zimmer.owner_id) !== String(actor.id)) {
    const err = new Error('Forbidden: zimmer belongs to another owner');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const zones = Array.isArray(zimmer.data_zones) ? zimmer.data_zones : [];
  let indices = Array.isArray(clientState?.zoneIndices)
    ? clientState.zoneIndices.filter((i) => Number.isInteger(i) && i >= 0 && i < zones.length)
    : [];

  if (indices.length === 0 && zones.length > 0) {
    indices = zones.map((_, i) => i);
  }

  const picked = indices.map((i) => zones[i]).filter(Boolean);
  const raw = picked
    .map((z, i) => {
      const label = z.source_label || z.source_type || `מקור ${i + 1}`;
      return `[${label}] ${z.content || ''}`;
    })
    .join('\n');

  if (!raw.trim()) {
    const err = new Error('No data zones selected for summary');
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }

  return { zimmerId, zimmer, raw, zoneCount: picked.length };
}

/**
 * @param {{ store: ReturnType<import('../../entity-store.js').createEntityStore>, prisma?: import('@prisma/client').PrismaClient }} deps
 * @param {{ actor: import('../../authz.js').Actor, clientState: unknown }} input
 */
export async function buildVacationAgentContext(deps, { actor, user, clientState }) {
  const recentTurns = normalizeOneshotTurns(clientState?.recentTurns);

  let bookings = [];
  let profile = null;

  if (actor?.id) {
    bookings = await deps.store.filter(
      'BookingRequest',
      { created_by_id: actor.id },
      '-created_date',
      60,
      actor,
    );
    const now = new Date();
    bookings = bookings
      .filter((b) => new Date(b.check_in) >= now)
      .sort((a, b) => new Date(a.check_in) - new Date(b.check_in));

    const profiles = await deps.store.filter(
      'CustomerProfile',
      { user_id: actor.id },
      '-created_date',
      1,
      actor,
    );
    profile = profiles[0] || null;
  }

  let contextText = `פרטי הלקוח: ${user?.full_name || user?.email || actor?.email || 'אורח'}.`;
  if (profile) {
    if (profile.vacation_preferences) {
      contextText += `\nהעדפות נופש: ${profile.vacation_preferences}`;
    }
    if (profile.preferred_regions) {
      contextText += `\nאזורים מועדפים: ${profile.preferred_regions}`;
    }
    if (profile.num_guests_usual) {
      contextText += `\nמספר אורחים רגיל: ${profile.num_guests_usual}`;
    }
  }

  if (bookings.length > 0) {
    contextText += `\n\nהזמנות קרובות:`;
    bookings.slice(0, 3).forEach((b) => {
      const parts = [
        b.num_adults ? `${b.num_adults} מבוגרים` : null,
        b.num_children ? `${b.num_children} ילדים` : null,
      ]
        .filter(Boolean)
        .join(' + ');
      contextText += `\n- ${b.zimmer_name} | כניסה ${b.check_in} עד ${b.check_out} | ${parts || 'הרכב לא צוין'} | סטטוס: ${b.status}`;
    });
  } else {
    contextText += `\nאין הזמנות קרובות כרגע.`;
  }

  const historyText = recentTurns
    .map((m) => (m.role === 'user' ? `לקוח: ${m.content}` : `סוכן: ${m.content}`))
    .join('\n');

  return { contextText, historyText, bookings, profile };
}
