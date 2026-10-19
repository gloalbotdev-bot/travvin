/**
 * Shared owner context — one compact snapshot used by every owner-panel profile,
 * so any bubble can answer any question (bookings, chats, questions, reviews...).
 */
import { sanitizeOwnerText, sanitizeUntrustedText } from '../../sanitize-prompt-data.js';
import { loadRecentOwnerActions } from '../conversation-service.js';
import { describeMinNightsRules } from '../../booking-price.js';
import { outdoorAreaSummary } from '../../outdoor-area.js';
import { loadOwnerThread, threadMemoryText } from '../owner-thread.js';

export const MAX_BOOKINGS_INDEX = 150;
const MAX_DETAILED_BOOKINGS = 40;
const MAX_BOOKINGS_INDEX_LINES = 80;
const MAX_LOOKUP_MATCHES = 15;
const MAX_CHATS = 8;
const CHAT_MESSAGES_PER_THREAD = 3;
const MAX_ZIMMERS = 80;

const DATE_ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const DATE_DM_RE = /\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/g;
const PHONE_RE = /\d[\d-\s]{6,}\d/g;
const STOP_WORDS = new Set([
  'של', 'את', 'על', 'עם', 'מה', 'מי', 'יש', 'אין', 'לי', 'זה', 'הזמנה', 'הזמנות', 'צימר',
  'מתי', 'איך', 'כמה', 'גם', 'או', 'אם', 'כל', 'היא', 'הוא', 'הם', 'לא', 'כן', 'אני',
]);

function bookingNights(b) {
  const a = Date.parse(`${b.check_in}T00:00:00Z`);
  const c = Date.parse(`${b.check_out}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(c) ? Math.max(0, Math.round((c - a) / 86400000)) : 0;
}

function bookingIndexLine(b) {
  const price = b.total_price != null ? ` | ₪${b.total_price}${b.price_override != null ? ' (מוסכם)' : ''}` : '';
  const kind = b.is_block ? 'חסימה' : b.status;
  return `${b.id} | ${b.guest_name || '—'} | ${b.zimmer_name || '—'} | ${b.check_in}→${b.check_out} | ${kind}${price}`;
}

function bookingDetailLine(b) {
  if (b.is_block) {
    return `• [חסימה] ${b.zimmer_name} | ${b.check_in}→${b.check_out} | סיבה: ${b.block_reason || b.guest_name || '—'}`;
  }
  const guests = b.num_adults || b.num_children
    ? `${b.num_adults || 0} מבוגרים + ${b.num_children || 0} ילדים`
    : `${b.num_guests || 1} אורחים`;
  const price = b.total_price != null
    ? ` | ₪${b.total_price}${b.price_override != null ? ' (מחיר מוסכם)' : ''}`
    : '';
  const notes = b.notes ? ` | הערות: ${sanitizeUntrustedText(String(b.notes), 200)}` : '';
  const cancel = b.cancel_request_reason ? ' | ⚠️ ביקשו ביטול' : '';
  return `• id:${b.id} | ${b.guest_name} | צימר: ${b.zimmer_name} | ${b.check_in}→${b.check_out} (${bookingNights(b)} לילות) | ${guests} | סטטוס: ${b.status}${price} | טלפון: ${b.guest_phone || '—'}${notes}${cancel}`;
}

/** Dates (YYYY-MM-DD) mentioned in free text; d/m without a year resolves to the next occurrence. */
export function extractMessageDates(text, today) {
  const out = new Set();
  const s = String(text || '');
  for (const m of s.matchAll(DATE_ISO_RE)) out.add(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of s.matchAll(DATE_DM_RE)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (d < 1 || d > 31 || mo < 1 || mo > 12) continue;
    let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(today.slice(0, 4));
    let iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!m[3] && iso < today) {
      y += 1;
      iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    out.add(iso);
  }
  return [...out];
}

/**
 * Bookings the owner is asking about — by guest name, phone digits or a date inside the stay.
 * @param {object[]} bookings
 * @param {string} message
 * @param {string} today
 */
export function lookupBookings(bookings, message, today) {
  const text = String(message || '');
  const dates = extractMessageDates(text, today);
  const phones = [...text.matchAll(PHONE_RE)].map((m) => m[0].replace(/\D/g, '')).filter((p) => p.length >= 7);
  const words = text
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[והבלמש](?=\p{L}{3,})/u, ''))
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  const hits = [];
  for (const b of bookings) {
    const name = String(b.guest_name || '');
    const phone = String(b.guest_phone || '').replace(/\D/g, '');
    const byName = words.some((w) => name.includes(w));
    const byPhone = phone && phones.some((p) => phone.endsWith(p.slice(-7)) || p.endsWith(phone.slice(-7)));
    const byDate = dates.some((d) => b.check_in === d || (b.check_in <= d && b.check_out > d));
    if (byName || byPhone || byDate) hits.push(b);
    if (hits.length >= MAX_LOOKUP_MATCHES) break;
  }
  return hits;
}

function chatsSummary(chats) {
  return chats
    .map((c) => {
      const msgs = (Array.isArray(c.messages) ? c.messages : []).slice(-CHAT_MESSAGES_PER_THREAD);
      const lines = msgs
        .map((m) => `   ${m.role === 'owner' ? 'בעלים' : 'לקוח'}: ${sanitizeUntrustedText(String(m.content || ''), 200)}`)
        .join('\n');
      return `• ${c.customer_name || 'לקוח'} | ${c.zimmer_name || ''} | הודעות: ${(c.messages || []).length}\n${lines}`;
    })
    .join('\n');
}

/** Compact zimmer line — keep amenity *names* so the model can propose a full amenities list. */
function zimmerPromptLine(z) {
  const seasonal = Array.isArray(z.seasonal_pricing) ? z.seasonal_pricing : [];
  const minRules = Array.isArray(z.min_nights_rules) ? z.min_nights_rules : [];
  const outdoor = outdoorAreaSummary(z);
  const amenityNames = (Array.isArray(z.amenities) ? z.amenities : [])
    .map((a) => (typeof a === 'string' ? a : a?.name || a?.label || ''))
    .map((s) => sanitizeUntrustedText(String(s), 40))
    .filter(Boolean)
    .slice(0, 24);
  const amenitiesStr = amenityNames.length
    ? `amenities: ${JSON.stringify(amenityNames)}${Array.isArray(z.amenities) && z.amenities.length > amenityNames.length ? ` (+${z.amenities.length - amenityNames.length})` : ''}`
    : 'amenities: []';
  const desc = z.description ? sanitizeUntrustedText(String(z.description), 160) : 'אין';
  return (
    `id:${z.id} | ${z.name} | מיקום: ${z.location || '—'} | מחיר/לילה: ${z.price_per_night ?? '—'} | אמצ"ש: ${z.weekday_price ?? '—'} | סופ"ש: ${z.weekend_price ?? '—'} | חדרים: ${z.num_rooms ?? '—'} | אורחים מקס: ${z.max_guests ?? '—'} | מינימום לילות: ${describeMinNightsRules(z) || 'ללא'} | min_nights_rules: ${JSON.stringify(minRules)} | seasonal_pricing: ${JSON.stringify(seasonal.slice(0, 6))}${seasonal.length > 6 ? ` (+${seasonal.length - 6})` : ''} | סטטוס: ${z.approval_status} | תיאור: ${desc} | ${amenitiesStr}${outdoor ? ` | ${outdoor}` : ''}`
  );
}

/**
 * @param {{ store: ReturnType<import('../../entity-store.js').createEntityStore> }} deps
 * @param {{ actor: import('../../authz.js').Actor, ownerId: string, message?: string, focus?: { date?: string, zimmerId?: string }|null, withThread?: boolean }} input
 */
export async function buildOwnerBaseContext(deps, input) {
  const { store } = deps;
  const { actor, ownerId, message = '', focus = null, withThread = true } = input;
  const t0 = Date.now();

  const [zimmers, bookings, questions, reviews, chats, recentActions, thread] = await Promise.all([
    store.filter('Zimmer', { owner_id: ownerId }, '-created_date', MAX_ZIMMERS, actor),
    store.filter('BookingRequest', { owner_id: ownerId }, '-created_date', MAX_BOOKINGS_INDEX, actor),
    store.filter('UnansweredQuestion', { owner_id: ownerId }, '-created_date', 20, actor),
    store.filter('Review', { owner_id: ownerId }, '-created_date', 20, actor),
    store.filter('DirectChat', { owner_id: ownerId }, '-updated_date', MAX_CHATS, actor).catch(() => []),
    loadRecentOwnerActions(store, actor, 10),
    withThread ? loadOwnerThread(store, ownerId, actor).catch(() => null) : Promise.resolve(null),
  ]);
  const fetchMs = Date.now() - t0;

  const today = new Date().toISOString().split('T')[0];
  const upcoming = bookings
    .filter((b) => b.check_out >= today || b.status === 'ממתינה')
    .sort((a, b) => String(a.check_in).localeCompare(String(b.check_in)))
    .slice(0, MAX_DETAILED_BOOKINGS);
  const upcomingIds = new Set(upcoming.map((b) => b.id));
  const lookup = lookupBookings(bookings, message, today).filter((b) => !upcomingIds.has(b.id));
  const lookupIds = new Set(lookup.map((b) => b.id));
  const indexRestAll = bookings.filter((b) => !upcomingIds.has(b.id) && !lookupIds.has(b.id));
  const indexRest = indexRestAll.slice(0, MAX_BOOKINGS_INDEX_LINES);
  const indexOmitted = indexRestAll.length - indexRest.length;

  const openQuestions = questions.filter((q) => q.status === 'ממתינה');
  const actionLogText = recentActions.length
    ? recentActions
        .slice(0, 5)
        .map((a) => `• [${a.action_type}] ${a.profile}: ${sanitizeUntrustedText(String(a.summary || ''), 120)}`)
        .join('\n')
    : '• (אין פעולות אחרונות)';

  const focusZimmer = focus?.zimmerId ? zimmers.find((z) => z.id === focus.zimmerId) : null;

  const snapshotStr = `
היום: ${today}

צימרים (${zimmers.length}):
${zimmers.map(zimmerPromptLine).join('\n')}

הזמנות קרובות וממתינות (${upcoming.length}):
${upcoming.map(bookingDetailLine).join('\n') || '• (אין)'}
${lookup.length ? `\nהזמנות שקשורות לשאלה (לפי שם / טלפון / תאריך):\n${lookup.map(bookingDetailLine).join('\n')}\n` : ''}
אינדקס שאר ההזמנות (${indexRest.length}${indexOmitted ? ` מתוך ${indexRestAll.length}` : ''}, שורה לכל הזמנה — id | אורח | צימר | תאריכים | סטטוס | מחיר):
${indexRest.map(bookingIndexLine).join('\n') || '(אין)'}${indexOmitted ? `\n… ועוד ${indexOmitted} הזמנות ישנות שלא הוצגו` : ''}

שאלות לקוחות פתוחות (${openQuestions.length}):
${questions.map((q) => `• "${sanitizeUntrustedText(String(q.question || ''), 300)}" על ${q.zimmer_name} | סטטוס: ${q.status}`).join('\n') || '• (אין)'}

ביקורות (${reviews.length}):
${reviews.map((r) => `• ${r.guest_name || 'אנונימי'} | ${r.zimmer_name} | דירוג: ${r.rating}/5 | "${sanitizeUntrustedText(String(r.text || ''), 300)}"`).join('\n') || '• (אין)'}

צ'אטים אחרונים עם לקוחות (${chats.length}):
${chatsSummary(chats) || '• (אין)'}

פעולות assistant אחרונות:
${actionLogText}
`;

  const contextMs = Date.now() - t0;
  return {
    ownerId,
    today,
    zimmers,
    bookings,
    questions,
    reviews,
    chats,
    recentActions,
    thread,
    focus: focus || null,
    focusZimmer,
    snapshotStr,
    memoryText: threadMemoryText(thread),
    userMessage: sanitizeOwnerText(message),
    timing: {
      contextMs,
      fetchMs,
      promptChars: snapshotStr.length,
      zimmerCount: zimmers.length,
      bookingCount: bookings.length,
    },
  };
}

/**
 * Parse clientState.surface / clientState.focus (never trusted for auth).
 * @param {unknown} clientState
 * @param {string} fallback
 */
export function parseOwnerSurface(clientState, fallback = 'home') {
  const cs = clientState && typeof clientState === 'object' ? clientState : {};
  const surface = typeof cs.surface === 'string' ? cs.surface : fallback;
  const f = cs.focus && typeof cs.focus === 'object' ? cs.focus : {};
  const focus = {};
  if (typeof f.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.date)) focus.date = f.date;
  if (typeof f.zimmerId === 'string' && f.zimmerId.trim()) focus.zimmerId = f.zimmerId.trim();
  return { surface, focus: Object.keys(focus).length ? focus : null };
}
