/**
 * M15 #8ב — server-enforced OwnerInfoAssistant mutations.
 * Whitelists operation types/fields; verifies zimmer ownership before writes.
 */

import { calcBookingTotalForZimmer, checkMinNights, describeMinNightsRules } from './booking-price.js';
import { sanitizeAmenities, sanitizeOutdoorArea } from './outdoor-area.js';

const OP_TYPES = new Set([
  'create_zimmer',
  'update_zimmer',
  'create_booking',
  'update_booking',
  'block_dates',
  'add_seasonal_price',
]);

const BOOKING_PATCH_KEYS = [
  'guest_name',
  'guest_phone',
  'check_in',
  'check_out',
  'num_guests',
  'notes',
  'status',
  'price_override',
  'zimmer_name',
  'zimmer_id',
];

const BOOKING_STATUSES = new Set(['אושרה', 'ממתינה', 'נדחתה']);

/** Agreed total only when the owner stated a positive amount — 0 means "use list price". */
function positivePriceOverride(value) {
  const n = Number(value);
  return value != null && value !== '' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Fields the assistant may set on Zimmer create/update (no owner_id / approval_status). */
export const ZIMMER_MUTABLE_FIELDS = new Set([
  'name',
  'location',
  'price_per_night',
  'weekday_price',
  'weekend_price',
  'num_rooms',
  'max_guests',
  'description',
  'partial_pricing_enabled',
  'min_guests',
  'price_per_adult',
  'price_per_child',
  'seasonal_pricing',
  'min_nights_rules',
  'images',
  'info_summary',
  'amenities',
  'outdoor_area',
  'rooms_detail',
  'max_guests_event',
  'contact_phone',
  'expose_availability_calendar',
  'additional_bathrooms_count',
  'data_zones',
]);

const FIELD_SANITIZERS = {
  outdoor_area: sanitizeOutdoorArea,
  amenities: (v) => {
    const list = sanitizeAmenities(v);
    return list && list.length ? list : undefined;
  },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ operation: object, ownerId: string, actor: object, ownerName?: string }} opts
 */
export async function executeOwnerAssistantOp(store, { operation, ownerId, actor, ownerName = '' }) {
  if (!ownerId) {
    const err = new Error('owner_id required');
    err.status = 400;
    throw err;
  }
  if (!actor?.id) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }
  if (actor.role !== 'admin' && actor.id !== ownerId) {
    const err = new Error('Forbidden: cannot run assistant ops for another owner');
    err.status = 403;
    throw err;
  }
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    const err = new Error('Forbidden: owner or admin only');
    err.status = 403;
    throw err;
  }

  const op = sanitizeOperation(operation);
  if (!op) {
    const err = new Error('Invalid or missing operation');
    err.status = 400;
    throw err;
  }

  switch (op.type) {
    case 'create_zimmer':
      return createZimmer(store, op, ownerId, ownerName, actor);
    case 'update_zimmer':
      return updateZimmer(store, op, ownerId, actor);
    case 'create_booking':
      return createBooking(store, op, ownerId, actor);
    case 'update_booking':
      return updateBooking(store, op, ownerId, actor);
    case 'block_dates':
      return blockDates(store, op, ownerId, actor);
    case 'add_seasonal_price':
      return addSeasonalPrice(store, op, ownerId, actor);
    default: {
      const err = new Error(`Unsupported operation type: ${op.type}`);
      err.status = 400;
      throw err;
    }
  }
}

/**
 * @param {unknown} raw
 * @returns {object|null}
 */
export function sanitizeOperation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type;
  if (!OP_TYPES.has(type)) return null;
  return { ...raw, type };
}

const hasText = (v) => typeof v === 'string' && v.trim() !== '';
const hasValue = (v) => v !== undefined && v !== null && v !== '';

/**
 * True when a proposed operation carries the minimum it needs to run — LLMs with
 * structured output sometimes return a bare `{ type }` on plain questions.
 * @param {object|null} op — sanitized operation
 */
export function isActionableOperation(op) {
  if (!op) return false;
  switch (op.type) {
    case 'create_zimmer':
      return hasText(op.name);
    case 'update_zimmer': {
      const fieldKeys = op.fields && typeof op.fields === 'object' ? Object.keys(op.fields).filter((k) => hasValue(op.fields[k])) : [];
      const topKeys = [...ZIMMER_MUTABLE_FIELDS, 'price'].filter((k) => k !== 'name' && hasValue(op[k]));
      return fieldKeys.length > 0 || topKeys.length > 0;
    }
    case 'create_booking':
      return hasText(op.guest_name) && hasText(op.check_in) && hasText(op.check_out);
    case 'update_booking': {
      const hasTarget = hasText(op.booking_id) || hasText(op.guest_name);
      // guest_name / check_in alone identify the row; they count as changes only with booking_id.
      const changeKeys = ['guest_phone', 'check_out', 'num_guests', 'notes', 'status', 'price_override', 'zimmer_name', 'zimmer_id'];
      let hasChange = changeKeys.some((k) => hasValue(op[k]));
      if (hasText(op.booking_id) && (hasText(op.guest_name) || hasText(op.check_in))) hasChange = true;
      return hasTarget && hasChange;
    }
    case 'block_dates':
      return hasText(op.start_date);
    case 'add_seasonal_price':
      return hasText(op.start_date) && hasText(op.end_date) &&
        [op.price_per_night, op.weekday_price, op.weekend_price, op.percentage].some(hasValue);
    default:
      return false;
  }
}

/**
 * Human-readable confirmation text for a proposed operation (shown before execution).
 * @param {object} op — sanitized operation
 * @param {object[]} [zimmers]
 * @returns {{ summary: string, details: string[] }}
 */
export function describeOwnerOperation(op, zimmers = []) {
  const zimmerName =
    (op.zimmer_id && zimmers.find((z) => z.id === op.zimmer_id)?.name) ||
    op.zimmer_name ||
    (op.type !== 'create_zimmer' ? op.name : '') ||
    '';
  const details = [];
  switch (op.type) {
    case 'create_zimmer': {
      const f = pickZimmerFields(op);
      if (f.location) details.push(`מיקום: ${f.location}`);
      if (f.price_per_night != null) details.push(`מחיר ללילה: ₪${f.price_per_night}`);
      if (f.weekday_price != null) details.push(`אמצ"ש: ₪${f.weekday_price}`);
      if (f.weekend_price != null) details.push(`סופ"ש: ₪${f.weekend_price}`);
      if (f.num_rooms != null) details.push(`חדרים: ${f.num_rooms}`);
      if (f.max_guests != null) details.push(`אורחים: ${f.max_guests}`);
      return { summary: `ליצור צימר חדש "${op.name || ''}"`, details };
    }
    case 'update_zimmer': {
      const fields = pickZimmerFields({ ...(op.fields || {}) });
      return {
        summary: `לעדכן את "${zimmerName || 'הצימר'}"`,
        details: Object.keys(fields).length ? [formatUpdateDetail(fields)] : [],
      };
    }
    case 'create_booking': {
      details.push(`אורח: ${op.guest_name || '—'}${op.guest_phone ? ` · ${op.guest_phone}` : ''}`);
      details.push(`תאריכים: ${op.check_in || '?'} → ${op.check_out || '?'}`);
      if (op.num_guests) details.push(`אורחים: ${op.num_guests}`);
      details.push(`סטטוס: ${op.status === 'ממתינה' ? 'ממתינה לאישור' : 'מאושרת'}`);
      const override = positivePriceOverride(op.price_override);
      if (override != null) {
        details.push(`מחיר מוסכם: ₪${override}`);
      } else {
        const z = zimmers.find(
          (x) =>
            x.id === op.zimmer_id ||
            x.name === op.zimmer_name ||
            (op.zimmer_name && (x.name.includes(op.zimmer_name) || op.zimmer_name.includes(x.name))),
        );
        if (z && op.check_in && op.check_out) {
          const list = calcBookingTotalForZimmer(z, op.check_in, op.check_out);
          if (list != null) details.push(`מחיר מחירון: ₪${list}`);
        }
      }
      if (op.notes) details.push(`הערות: ${op.notes}`);
      return { summary: `להוסיף הזמנה ב"${zimmerName || '?'}"`, details };
    }
    case 'update_booking': {
      const who = op.guest_name || op.booking_id || 'הזמנה';
      details.push(`יעד: ${who}${op.check_in ? ` · ${op.check_in}` : ''}`);
      for (const k of BOOKING_PATCH_KEYS) {
        if (k === 'guest_name' || !hasValue(op[k])) continue;
        if (k === 'price_override') {
          const o = positivePriceOverride(op[k]);
          if (o != null) details.push(`מחיר מוסכם: ₪${o}`);
          continue;
        }
        details.push(`${k}: ${op[k]}`);
      }
      return { summary: `לעדכן הזמנה של "${who}"`, details };
    }
    case 'block_dates':
      details.push(`מ-${op.start_date || '?'}${op.end_date ? ` עד ${op.end_date}` : ''}`);
      if (op.reason) details.push(`סיבה: ${op.reason}`);
      return { summary: `לחסום תאריכים ב"${zimmerName || '?'}"`, details };
    case 'add_seasonal_price':
      details.push(`${op.start_date || '?'} עד ${op.end_date || '?'}`);
      details.push(
        op.price_per_night != null
          ? `מחיר ללילה: ₪${op.price_per_night}`
          : `${op.adjustment === 'decrease' ? 'הנחה' : 'תוספת'} ${op.percentage ?? '?'}%`,
      );
      return { summary: `להוסיף תמחור עונתי ל"${zimmerName || '?'}"`, details };
    default:
      return { summary: 'לבצע פעולה', details };
  }
}

function pickZimmerFields(source) {
  const out = {};
  for (const key of ZIMMER_MUTABLE_FIELDS) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
      const value = FIELD_SANITIZERS[key] ? FIELD_SANITIZERS[key](source[key]) : source[key];
      if (value !== undefined && value !== null) out[key] = value;
    }
  }
  return out;
}

/** Map common LLM field aliases → schema keys. */
function normalizeZimmerFieldAliases(raw) {
  const src = { ...raw };
  if (src.price != null && src.price_per_night == null) {
    src.price_per_night = src.price;
  }
  if (src.fields && typeof src.fields === 'object') {
    const f = { ...src.fields };
    if (f.price != null && f.price_per_night == null) f.price_per_night = f.price;
    src.fields = f;
  }
  return src;
}

function matchZimmerByName(zimmers, name) {
  if (!name || !Array.isArray(zimmers)) return null;
  const q = String(name).trim();
  if (!q) return null;
  return (
    zimmers.find((z) => z.name === q) ||
    zimmers.find((z) => z.name.includes(q) || q.includes(z.name)) ||
    null
  );
}

async function resolveOwnerZimmer(store, ownerId, actor, op) {
  const zimmers = await store.filter('Zimmer', { owner_id: ownerId }, '-created_date', 200, actor);
  if (op.zimmer_id) {
    const zimmer = await store.get('Zimmer', op.zimmer_id, actor);
    if (String(zimmer.owner_id) !== String(ownerId)) {
      const err = new Error('Forbidden: zimmer belongs to another owner');
      err.status = 403;
      throw err;
    }
    return zimmer;
  }
  const hint = op.zimmer_name || op.name;
  const matched = matchZimmerByName(zimmers, hint);
  if (!matched) {
    const err = new Error(
      hint
        ? `Zimmer not found: ${hint}`
        : 'update_zimmer requires zimmer_id or zimmer_name',
    );
    err.status = hint ? 404 : 400;
    if (hint) {
      err.message = `⚠️ לא מצאתי צימר בשם "${hint}". לא בוצע עדכון.`;
    }
    throw err;
  }
  return matched;
}

async function createZimmer(store, op, ownerId, ownerName, actor) {
  if (!op.name || typeof op.name !== 'string') {
    const err = new Error('create_zimmer requires name');
    err.status = 400;
    throw err;
  }
  const fields = pickZimmerFields(op);
  const zimmer = await store.create(
    'Zimmer',
    {
      ...fields,
      name: op.name.trim(),
      owner_id: ownerId,
      owner_name: ownerName || '',
      approval_status: 'אושר',
    },
    { actor, createdById: actor.id, createdBy: actor.email },
  );
  return {
    kind: 'create_zimmer',
    zimmer,
    message: `✅ יצרתי את הצימר "${zimmer.name}" בהצלחה והוא פורסם.`,
  };
}

async function updateZimmer(store, op, ownerId, actor) {
  const normalized = normalizeZimmerFieldAliases(op);
  const zimmer = await resolveOwnerZimmer(store, ownerId, actor, normalized);
  const zid = zimmer.id;

  const rawFields = {
    ...(normalized.fields && typeof normalized.fields === 'object' ? normalized.fields : {}),
  };
  ZIMMER_MUTABLE_FIELDS.forEach((k) => {
    if (
      normalized[k] !== undefined &&
      normalized[k] !== null &&
      normalized[k] !== '' &&
      rawFields[k] === undefined
    ) {
      rawFields[k] = normalized[k];
    }
  });
  const clean = pickZimmerFields(rawFields);
  if (!Object.keys(clean).length) {
    const err = new Error('update_zimmer requires at least one field');
    err.status = 400;
    throw err;
  }

  // If the model returns only newly added amenities (common), merge instead of wiping the list.
  if (Array.isArray(clean.amenities)) {
    clean.amenities = mergeAmenitiesList(zimmer.amenities, clean.amenities);
  }

  const updated = await store.update('Zimmer', zid, clean, actor);
  return {
    kind: 'update_zimmer',
    zimmer: updated,
    message: `✅ עדכנתי את "${updated.name || zimmer.name}" — ${formatUpdateDetail(clean)}.`,
  };
}

function amenityLabel(a) {
  if (typeof a === 'string') return a.trim();
  if (a && typeof a === 'object') return String(a.name || a.label || '').trim();
  return '';
}

/** Keep existing amenities when the incoming list barely overlaps (additive update). */
export function mergeAmenitiesList(existingRaw, incomingRaw) {
  const existing = Array.isArray(existingRaw) ? existingRaw : [];
  const incoming = Array.isArray(incomingRaw) ? incomingRaw : [];
  if (!incoming.length) return existing.length ? existing : incoming;
  if (!existing.length) return incoming;

  const existingLabels = existing.map(amenityLabel).filter(Boolean);
  const incomingLabels = incoming.map(amenityLabel).filter(Boolean);
  const existingSet = new Set(existingLabels.map((s) => s.toLowerCase()));
  const covered = incomingLabels.filter((s) => existingSet.has(s.toLowerCase())).length;
  const coverage = existingLabels.length ? covered / existingLabels.length : 1;
  if (coverage >= 0.5) return incoming;

  const seen = new Set(existingLabels.map((s) => s.toLowerCase()));
  const merged = [...existing];
  for (const item of incoming) {
    const label = amenityLabel(item).toLowerCase();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    merged.push(item);
  }
  return merged;
}

const UPDATE_FIELD_LABELS = {
  name: 'שם',
  location: 'מיקום',
  description: 'תיאור',
  num_rooms: 'חדרים',
  max_guests: 'אורחים מקס',
  partial_pricing_enabled: 'תמחור חלקי',
  min_guests: 'מינימום אורחים',
  price_per_adult: 'מחיר למבוגר',
  price_per_child: 'מחיר לילד',
  seasonal_pricing: 'תמחור עונתי',
  min_nights_rules: 'מינימום לילות',
  images: 'תמונות',
  info_summary: 'סיכום מידע',
  amenities: 'מתקנים',
  outdoor_area: 'מתחם חיצוני (חצר)',
};

function formatUpdateDetail(clean) {
  const parts = [];
  if (clean.price_per_night != null) parts.push(`מחיר בסיס: ₪${clean.price_per_night}`);
  if (clean.weekday_price != null) parts.push(`אמצ"ש: ₪${clean.weekday_price}`);
  if (clean.weekend_price != null) parts.push(`סופ"ש: ₪${clean.weekend_price}`);
  for (const [key, value] of Object.entries(clean)) {
    if (key === 'price_per_night' || key === 'weekday_price' || key === 'weekend_price') continue;
    const label = UPDATE_FIELD_LABELS[key] || key;
    if (key === 'min_nights_rules') {
      parts.push(`${label}: ${describeMinNightsRules({ min_nights_rules: value }) || 'ללא'}`);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
      parts.push(`${label}: ${value}`);
    } else {
      parts.push(label);
    }
  }
  return parts.join(' · ') || Object.keys(clean).join(', ');
}

function addDaysIso(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

function requireDate(value, field) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    const err = new Error(`${field} must be YYYY-MM-DD`);
    err.status = 400;
    throw err;
  }
  return value;
}

/** Same record shape as BlockDateForm: a BookingRequest with is_block. end_date = check-out day (exclusive). */
async function blockDates(store, op, ownerId, actor) {
  const zimmer = await resolveOwnerZimmer(store, ownerId, actor, op);
  const start = requireDate(op.start_date, 'start_date');
  let end = typeof op.end_date === 'string' && DATE_RE.test(op.end_date) ? op.end_date : null;
  if (!end || end <= start) end = addDaysIso(start, 1);
  const reason = typeof op.reason === 'string' && op.reason.trim() ? op.reason.trim().slice(0, 80) : 'חסום';

  const block = await store.create(
    'BookingRequest',
    {
      zimmer_id: zimmer.id,
      zimmer_name: zimmer.name,
      owner_id: ownerId,
      guest_name: reason,
      guest_phone: '',
      check_in: start,
      check_out: end,
      status: 'חסום',
      is_block: true,
      block_reason: reason,
      num_guests: null,
    },
    { actor, createdById: actor.id, createdBy: actor.email },
  );
  return {
    kind: 'block_dates',
    booking: block,
    zimmer,
    message: `✅ חסמתי את "${zimmer.name}" מ-${start} עד ${end} (${reason}).`,
  };
}

/** Appends one seasonal_pricing rule — absolute price_per_night, or adjustment + percentage. */
async function addSeasonalPrice(store, op, ownerId, actor) {
  const zimmer = await resolveOwnerZimmer(store, ownerId, actor, op);
  const start = requireDate(op.start_date, 'start_date');
  const end = requireDate(op.end_date, 'end_date');
  if (end < start) {
    const err = new Error('end_date must not be before start_date');
    err.status = 400;
    throw err;
  }
  const rule = { start_date: start, end_date: end };
  if (typeof op.label === 'string' && op.label.trim()) rule.label = op.label.trim().slice(0, 60);
  const absolute = Number(op.price_per_night);
  if (op.price_per_night != null && Number.isFinite(absolute) && absolute > 0) {
    rule.price_per_night = Math.round(absolute);
  } else {
    const pct = Number(op.percentage);
    if (!Number.isFinite(pct) || pct <= 0) {
      const err = new Error('add_seasonal_price requires price_per_night or percentage');
      err.status = 400;
      throw err;
    }
    rule.adjustment = op.adjustment === 'decrease' ? 'decrease' : 'increase';
    rule.percentage = Math.min(rule.adjustment === 'decrease' ? 75 : 100, Math.round(pct));
  }
  const current = Array.isArray(zimmer.seasonal_pricing) ? zimmer.seasonal_pricing : [];
  const updated = await store.update('Zimmer', zimmer.id, { seasonal_pricing: [...current, rule] }, actor);
  const detail = rule.price_per_night != null
    ? `₪${rule.price_per_night} ללילה`
    : `${rule.adjustment === 'decrease' ? 'הנחה' : 'תוספת'} ${rule.percentage}%`;
  return {
    kind: 'add_seasonal_price',
    zimmer: updated,
    message: `✅ הוספתי תמחור עונתי ל-"${zimmer.name}": ${start} עד ${end} — ${detail}.`,
  };
}

async function createBooking(store, op, ownerId, actor) {
  const required = ['guest_name', 'guest_phone', 'zimmer_name', 'check_in', 'check_out'];
  for (const key of required) {
    if (!op[key] || typeof op[key] !== 'string') {
      const err = new Error(`create_booking requires ${key}`);
      err.status = 400;
      throw err;
    }
  }
  if (!DATE_RE.test(op.check_in) || !DATE_RE.test(op.check_out)) {
    const err = new Error('check_in and check_out must be YYYY-MM-DD');
    err.status = 400;
    throw err;
  }

  const zimmers = await store.filter('Zimmer', { owner_id: ownerId }, '-created_date', 200, actor);
  const matched = zimmers.find(
    (z) =>
      z.name === op.zimmer_name ||
      z.name.includes(op.zimmer_name) ||
      (op.zimmer_name && op.zimmer_name.includes(z.name)),
  );
  if (!matched) {
    const err = new Error(`Zimmer not found: ${op.zimmer_name}`);
    err.status = 404;
    err.message = `⚠️ לא מצאתי צימר בשם "${op.zimmer_name}". ההזמנה לא נוצרה.`;
    throw err;
  }

  const priceOverride = positivePriceOverride(op.price_override);
  const numGuests =
    typeof op.num_guests === 'number' && Number.isFinite(op.num_guests) && op.num_guests > 0
      ? Math.round(op.num_guests)
      : null;

  const booking = await store.create(
    'BookingRequest',
    {
      guest_name: op.guest_name.trim(),
      guest_phone: op.guest_phone.trim(),
      zimmer_id: matched.id,
      zimmer_name: matched.name,
      owner_id: ownerId,
      check_in: op.check_in,
      check_out: op.check_out,
      num_guests: numGuests,
      status: op.status === 'ממתינה' ? 'ממתינה' : 'אושרה',
      notes: typeof op.notes === 'string' ? op.notes : '',
      ...(priceOverride != null ? { price_override: priceOverride } : {}),
    },
    { actor, createdById: actor.id, createdBy: actor.email },
  );

  const priceNote = booking.total_price != null
    ? ` · ₪${booking.total_price}${priceOverride != null ? ' (מחיר מוסכם)' : ''}`
    : '';
  const statusNote = booking.status === 'ממתינה' ? ' · ממתינה לאישור' : '';
  const minNights = checkMinNights(matched, op.check_in, op.check_out);
  const minNightsNote = minNights.ok
    ? ''
    : `\n⚠️ שים לב: ${minNights.message} — ההזמנה נוצרה בכל זאת כי הוזנה ידנית.`;
  return {
    kind: 'create_booking',
    booking,
    message: `✅ נוספה הזמנה ל-${booking.guest_name} בצימר "${matched.name}" (${op.check_in} → ${op.check_out}${priceNote}${statusNote}).${minNightsNote}`,
  };
}

async function findOwnerBooking(store, op, ownerId, actor) {
  const rows = await store.filter('BookingRequest', { owner_id: ownerId }, '-created_date', 500, actor);
  const live = rows.filter((b) => !b.is_block && b.status !== 'חסום');
  if (hasText(op.booking_id)) {
    const byId = live.find((b) => b.id === op.booking_id);
    if (byId) return byId;
  }
  if (!hasText(op.guest_name)) return null;
  const name = op.guest_name.trim();
  const byName = live.filter(
    (b) => b.guest_name === name || (b.guest_name && (b.guest_name.includes(name) || name.includes(b.guest_name))),
  );
  if (hasText(op.check_in)) {
    const onDate = byName.filter((b) => b.check_in === op.check_in);
    if (onDate.length === 1) return onDate[0];
    if (onDate.length > 1) return null;
  }
  return byName.length === 1 ? byName[0] : null;
}

async function updateBooking(store, op, ownerId, actor) {
  const existing = await findOwnerBooking(store, op, ownerId, actor);
  if (!existing) {
    const err = new Error(
      hasText(op.booking_id) || hasText(op.guest_name)
        ? `⚠️ לא מצאתי הזמנה מתאימה${op.guest_name ? ` עבור "${op.guest_name}"` : ''}.`
        : 'update_booking requires booking_id or guest_name',
    );
    err.status = hasText(op.booking_id) || hasText(op.guest_name) ? 404 : 400;
    throw err;
  }

  const patch = {};
  if (hasText(op.guest_name) && op.guest_name.trim() !== existing.guest_name) {
    patch.guest_name = op.guest_name.trim();
  }
  if (hasText(op.guest_phone)) patch.guest_phone = op.guest_phone.trim();
  if (hasText(op.check_in) && DATE_RE.test(op.check_in)) patch.check_in = op.check_in;
  if (hasText(op.check_out) && DATE_RE.test(op.check_out)) patch.check_out = op.check_out;
  if (typeof op.num_guests === 'number' && Number.isFinite(op.num_guests) && op.num_guests > 0) {
    patch.num_guests = Math.round(op.num_guests);
  }
  if (typeof op.notes === 'string') patch.notes = op.notes;
  if (hasText(op.status) && BOOKING_STATUSES.has(op.status)) patch.status = op.status;

  if (op.price_override !== undefined) {
    const override = positivePriceOverride(op.price_override);
    patch.price_override = override; // null clears override → list price on next compute
  }

  if (hasText(op.zimmer_id) || hasText(op.zimmer_name)) {
    const zimmers = await store.filter('Zimmer', { owner_id: ownerId }, '-created_date', 200, actor);
    const matched = hasText(op.zimmer_id)
      ? zimmers.find((z) => z.id === op.zimmer_id)
      : zimmers.find(
          (z) =>
            z.name === op.zimmer_name ||
            z.name.includes(op.zimmer_name) ||
            (op.zimmer_name && op.zimmer_name.includes(z.name)),
        );
    if (!matched) {
      const err = new Error(`⚠️ לא מצאתי צימר בשם "${op.zimmer_name || op.zimmer_id}".`);
      err.status = 404;
      throw err;
    }
    patch.zimmer_id = matched.id;
    patch.zimmer_name = matched.name;
  }

  if (Object.keys(patch).length === 0) {
    const err = new Error('אין שינויים לעדכון');
    err.status = 400;
    throw err;
  }

  const booking = await store.update('BookingRequest', existing.id, patch, actor);
  const priceNote = booking.total_price != null ? ` · ₪${booking.total_price}` : '';
  return {
    kind: 'update_booking',
    booking,
    message: `✅ עודכנה ההזמנה של ${booking.guest_name} (${booking.check_in} → ${booking.check_out}${priceNote}).`,
  };
}
