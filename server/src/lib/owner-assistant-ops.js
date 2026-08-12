/**
 * M15 #8ב — server-enforced OwnerInfoAssistant mutations.
 * Whitelists operation types/fields; verifies zimmer ownership before writes.
 */

const OP_TYPES = new Set(['create_zimmer', 'update_zimmer', 'create_booking']);

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
  'images',
  'info_summary',
]);

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

function pickZimmerFields(source) {
  const out = {};
  for (const key of ZIMMER_MUTABLE_FIELDS) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
      out[key] = source[key];
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

  const updated = await store.update('Zimmer', zid, clean, actor);
  const detail =
    clean.price_per_night != null ? `מחיר: ₪${clean.price_per_night}` : Object.keys(clean).join(', ');
  return {
    kind: 'update_zimmer',
    zimmer: updated,
    message: `✅ עדכנתי את "${updated.name || zimmer.name}" — ${detail}.`,
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
      num_guests: typeof op.num_guests === 'number' ? op.num_guests : null,
      status: 'אושרה',
      notes: typeof op.notes === 'string' ? op.notes : '',
    },
    { actor, createdById: actor.id, createdBy: actor.email },
  );

  const priceNote = booking.total_price != null ? ` · ₪${booking.total_price}` : '';
  return {
    kind: 'create_booking',
    booking,
    message: `✅ נוספה הזמנה ל-${booking.guest_name} בצימר "${matched.name}" (${op.check_in} → ${op.check_out}${priceNote}).`,
  };
}
