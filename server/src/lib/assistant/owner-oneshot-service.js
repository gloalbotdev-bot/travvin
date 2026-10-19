/**
 * Owner-panel one-shot profiles (calendar day advice, calendar suggestions,
 * home suggestions, reply drafts). Each prompt = shared owner base → surface task → schema.
 * The client sends ids only; the server loads the data.
 */
import { buildOwnerBaseContext } from './context-builder/owner-base.js';
import { resolveOwnerId } from './context-builder/owner-assistant.js';
import { buildOwnerBasePrompt } from './prompt-builder/owner-base.js';
import { describeMinNightsRules } from '../booking-price.js';
import { formatZimmerKnowledgeForPrompt, sanitizeUntrustedText } from '../sanitize-prompt-data.js';
import { invokeLlm } from '../llm/index.js';
import {
  CALENDAR_DAY_ADVICE_SCHEMA,
  CALENDAR_SUGGESTIONS_SCHEMA,
  HOME_SUGGESTIONS_SCHEMA,
  REPLY_DRAFT_SCHEMA,
} from './profiles.js';

export const OWNER_ONESHOT_PROFILES = new Set([
  'owner_calendar_day_advice',
  'owner_calendar_suggestions',
  'owner_home_suggestions',
  'owner_reply_draft',
]);

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validation(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = 'VALIDATION';
  return err;
}

function forbidden() {
  const err = new Error('Forbidden: record belongs to another owner');
  err.status = 403;
  err.code = 'FORBIDDEN';
  return err;
}

function nextFridayIso() {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * @param {*} req
 * @param {*} profile
 * @param {import('../authz.js').Actor} actor
 * @param {{ store: ReturnType<import('../entity-store.js').createEntityStore> }} deps
 */
export async function handleOwnerOneshotProfile(req, profile, actor, deps) {
  const ownerId = resolveOwnerId(actor, req.clientState);
  if (!ownerId) throw validation('owner context required');
  const cs = req.clientState || {};

  const base = await buildOwnerBaseContext(deps, { actor, ownerId, message: req.message, withThread: false });

  let prompt;
  let schema;
  let pick;
  switch (profile.id) {
    case 'owner_calendar_day_advice': {
      if (typeof cs.date !== 'string' || !DATE_RE.test(cs.date)) throw validation('clientState.date required');
      ({ prompt } = buildDayAdvice(base, cs.date));
      schema = CALENDAR_DAY_ADVICE_SCHEMA;
      pick = (raw) => ({
        summary: typeof raw?.summary === 'string' ? raw.summary : '',
        recommendations: Array.isArray(raw?.recommendations) ? raw.recommendations : [],
      });
      break;
    }
    case 'owner_calendar_suggestions':
      prompt = buildCalendarSuggestions(base);
      schema = CALENDAR_SUGGESTIONS_SCHEMA;
      pick = (raw) => ({ suggestions: Array.isArray(raw?.suggestions) ? raw.suggestions : [] });
      break;
    case 'owner_home_suggestions':
      prompt = buildHomeSuggestions(base);
      schema = HOME_SUGGESTIONS_SCHEMA;
      pick = (raw) => ({ suggestions: Array.isArray(raw?.suggestions) ? raw.suggestions : [] });
      break;
    case 'owner_reply_draft':
      prompt = await buildReplyDraft(deps, actor, ownerId, base, cs);
      schema = REPLY_DRAFT_SCHEMA;
      pick = (raw) => ({
        reply: typeof raw?.reply === 'string' ? raw.reply : typeof raw?.message === 'string' ? raw.message : '',
      });
      break;
    default:
      throw validation(`Unknown owner profile: ${profile.id}`);
  }

  const raw = await invokeLlm({ prompt, response_json_schema: schema });
  const parsed = pick(raw);
  return {
    conversationId: null,
    message: {
      role: 'assistant',
      content: parsed.reply || parsed.summary || '',
      time: new Date().toISOString(),
    },
    uiEffects: [],
    executedActions: [],
    meta: { profile: profile.id, responseMode: profile.responseMode, parsed },
  };
}

function buildDayAdvice(base, iso) {
  const dayBookings = base.bookings.filter(
    (b) => b.check_in <= iso && b.check_out > iso && b.status !== 'נדחית' && !b.is_block,
  );
  const occupiedIds = new Set(dayBookings.map((b) => b.zimmer_id));
  const zimmerInfo = base.zimmers.map((z) => ({
    name: z.name,
    base_price: z.price_per_night,
    weekday_price: z.weekday_price,
    weekend_price: z.weekend_price,
    occupied: occupiedIds.has(z.id),
    seasonal: (z.seasonal_pricing || []).filter((r) => r.start_date <= iso && r.end_date >= iso),
    min_nights: describeMinNightsRules(z) || null,
  }));
  const dayName = HEB_DAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  const prompt = `${buildOwnerBasePrompt({ ...base, focus: { date: iso } }, { surface: 'calendar', includeSnapshot: false })}
המשימה: אתה יועץ תמחור. תן סיכום מתומצת (עד 3 משפטים) והמלצת מחיר לכל נכס לתאריך ${iso} (יום ${dayName}), בהתחשב בתפוסה, יום בשבוע, עונתיות, מינימום לילות (min_nights; חמשוש = סופ"ש) ושוק.
נכסים: ${JSON.stringify(zimmerInfo)}.
החזר JSON בלבד.`;
  return { prompt };
}

function buildCalendarSuggestions(base) {
  const today = base.today;
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const occupancy = base.bookings.filter(
    (b) => b.status === 'אושרה' && b.check_in >= today && b.check_in <= in30,
  ).length;
  const pending = base.bookings.filter((b) => b.status === 'ממתינה').length;
  const zimmerList = base.zimmers.map((z) => `${z.name} (מחיר ${z.price_per_night || '?'}/לילה)`).join(', ');
  return `${buildOwnerBasePrompt(base, { surface: 'calendar', includeSnapshot: false })}
המשימה: נתח את היומן ותן 3-4 הצעות פעולה קצרות לשיפור הכנסה ותפוסה.
נכסים: ${zimmerList}
הזמנות ב-30 הימים הקרובים: ${occupancy}
הזמנות ממתינות: ${pending}
תאריך נוכחי: ${today}
החזר JSON בלבד.`;
}

function buildHomeSuggestions(base) {
  const pendingQuestions = base.questions.filter((q) => q.status === 'ממתינה');
  const fri = nextFridayIso();
  const freeWeekend =
    base.bookings.filter((b) => b.status === 'אושרה' && b.check_in <= fri && b.check_out > fri).length <
    Math.max(1, base.zimmers.length);
  const sample = pendingQuestions[0]
    ? `, למשל: "${sanitizeUntrustedText(String(pendingQuestions[0].question || ''), 80)}"`
    : '';
  return `${buildOwnerBasePrompt(base, { surface: 'home', includeSnapshot: false })}
המשימה: אתה יועץ לבעל צימרים בישראל. נתונים: ${pendingQuestions.length} שאלות לקוחות ממתינות${sample}. ${base.zimmers.length} צימרים בבעלות. ${freeWeekend ? 'יש לילות פנויות בסוף השבוע הקרוב' : 'אין לילות פנויות בסוף השבוע הקרוב'}.
החזר בדיוק 2 הצעות לשיפור בעברית, כל אחת עם: title (כותרת קצרה), body (משפט אחד), action_label (טקסט כפתור), action_type ("add_info" להוספת מידע לנכס או "create_offer" ליצירת מבצע). JSON בלבד.`;
}

async function loadOwned(deps, actor, ownerId, entity, id) {
  const row = await deps.store.get(entity, id, actor);
  if (String(row.owner_id) !== String(ownerId)) throw forbidden();
  return row;
}

async function buildReplyDraft(deps, actor, ownerId, base, cs) {
  if (cs.kind === 'question') {
    if (typeof cs.questionId !== 'string' || !cs.questionId) throw validation('clientState.questionId required');
    const q = await loadOwned(deps, actor, ownerId, 'UnansweredQuestion', cs.questionId);
    const zimmer = base.zimmers.find((z) => z.id === q.zimmer_id) || null;
    const zones = formatZimmerKnowledgeForPrompt(zimmer);
    return `${buildOwnerBasePrompt(base, { surface: 'messages', includeSnapshot: false })}
המשימה: ענה על שאלת הלקוח בעברית, בקצרה ובאדיבות, על סמך פרטי הנכס בלבד.
צימר: ${q.zimmer_name || zimmer?.name || ''}
שאלה: ${sanitizeUntrustedText(String(q.question || ''), 1000)}
${q.customer_search_summary ? `סיכום חיפוש הלקוח: ${sanitizeUntrustedText(String(q.customer_search_summary), 500)}` : ''}
פרטי הנכס:
${zones || '(אין מידע נוסף)'}
אם אין מידע מספיק, החזר תשובה קצרה שמזמינה את הלקוח לפנות ישירות לבעלים.
החזר JSON בלבד: {"reply":"תוכן התשובה"}`;
  }

  if (cs.kind !== 'chat') throw validation('clientState.kind must be chat or question');
  const ids = (Array.isArray(cs.threadIds) ? cs.threadIds : []).filter((x) => typeof x === 'string').slice(0, 20);
  if (!ids.length) throw validation('clientState.threadIds required');
  const threads = await Promise.all(ids.map((id) => loadOwned(deps, actor, ownerId, 'DirectChat', id)));
  const merged = threads
    .flatMap((t) =>
      (t.messages || []).map((m, idx) => ({
        ...m,
        zimmerName: t.zimmer_name,
        order: `${t.created_date || ''}#${String(idx).padStart(5, '0')}`,
      })),
    )
    .sort((a, b) => a.order.localeCompare(b.order));
  const targetZimmerId =
    typeof cs.zimmerId === 'string' && cs.zimmerId ? cs.zimmerId : threads[threads.length - 1]?.zimmer_id;
  const zimmer = base.zimmers.find((z) => z.id === targetZimmerId) || null;
  const zones = formatZimmerKnowledgeForPrompt(zimmer);
  const hist = merged
    .slice(-12)
    .map(
      (m) =>
        `${m.role === 'owner' ? 'בעלים' : 'לקוח'}${threads.length > 1 && m.zimmerName ? ` (${m.zimmerName})` : ''}: ${sanitizeUntrustedText(String(m.content || ''), 600)}`,
    )
    .join('\n');
  const lastCustomer = [...merged].reverse().find((m) => m.role === 'customer');
  const booking = typeof cs.bookingId === 'string' && cs.bookingId
    ? base.bookings.find((b) => b.id === cs.bookingId)
    : null;
  return `${buildOwnerBasePrompt(base, { surface: 'messages', includeSnapshot: false })}
המשימה: כתוב תשובה קצרה, אדיבה ומועילה בעברית ללקוח בצ'אט.
צימר: ${zimmer?.name || threads[0]?.zimmer_name || ''}
פרטי הנכס:
${zones || '(אין מידע נוסף)'}
${booking ? `הזמנה: ${booking.check_in} עד ${booking.check_out}, ${booking.num_guests || ''} אורחים, סטטוס: ${booking.status}` : ''}
היסטוריית צ'אט:
${hist || '(תחילת שיחה)'}
ההודעה האחרונה מהלקוח: ${sanitizeUntrustedText(String(lastCustomer?.content || ''), 600)}
החזר JSON בלבד: {"reply":"תוכן התשובה"}`;
}
