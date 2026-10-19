/**
 * Creator/editor response parsers — Phase 8.
 */
import { sanitizeOwnerText, sanitizeUntrustedText } from '../../sanitize-prompt-data.js';
import { sanitizeAmenities, sanitizeOutdoorArea } from '../../outdoor-area.js';

function pickString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sanitizeDataZones(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((z) => z && typeof z === 'object')
    .map((z) => ({
      content: sanitizeOwnerText(String(z.content || '')),
      source_label: sanitizeUntrustedText(String(z.source_label || 'עריכה ידנית')),
      source_type: sanitizeUntrustedText(String(z.source_type || 'טקסט חופשי')),
      source_date: sanitizeUntrustedText(String(z.source_date || '')),
    }))
    .filter((z) => z.content);
}

const BED_TYPES = new Set(['king', 'queen', 'single', 'bunk', 'sofa_bed', 'mattress', 'other']);

/** Returns undefined when the LLM did not send rooms (so the client keeps its rooms). */
export function sanitizeRoomsDetail(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((r) => r && typeof r === 'object')
    .slice(0, 40)
    .map((r) => ({
      room_name: sanitizeUntrustedText(pickString(r.room_name), 80),
      beds: (Array.isArray(r.beds) ? r.beds : [])
        .filter((b) => b && typeof b === 'object')
        .map((b) => {
          const sleeps = pickNumber(b.sleeps);
          const label = pickString(b.custom_label);
          return {
            bed_type: BED_TYPES.has(b.bed_type) ? b.bed_type : 'other',
            count: Math.max(1, Math.round(Number(b.count) || 1)),
            sleeps: sleeps != null && sleeps > 0 ? sleeps : null,
            custom_label: label ? sanitizeUntrustedText(label, 60) : null,
          };
        }),
      has_bathroom: r.has_bathroom === true,
      amenities: Array.isArray(r.amenities)
        ? r.amenities.map((a) => sanitizeUntrustedText(String(a || ''), 60)).filter(Boolean)
        : [],
    }));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_NIGHTS_SCOPES = new Set(['all', 'weekend', 'midweek']);

/** Returns undefined when the LLM did not send the field (so existing rules are kept). */
function sanitizeMinNightsRules(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((r) => r && typeof r === 'object')
    .map((r) => ({
      scope: MIN_NIGHTS_SCOPES.has(r.scope) ? r.scope : 'all',
      min_nights: Math.round(Number(r.min_nights) || 0),
      start_date: DATE_RE.test(r.start_date || '') ? r.start_date : null,
      end_date: DATE_RE.test(r.end_date || '') ? r.end_date : null,
      label: pickString(r.label) ? sanitizeUntrustedText(pickString(r.label)) : null,
    }))
    .filter((r) => r.min_nights > 1);
}

/**
 * @param {unknown} raw
 */
export function parseAdminZimmerEditorResponse(raw) {
  const action = pickString(raw?.action) || 'clarify';
  const message =
    pickString(raw?.message) || 'תשובת mock בעברית';

  let changes = null;
  if (raw?.changes && typeof raw.changes === 'object' && action !== 'clarify') {
    const ch = raw.changes;
    changes = {
      name: pickString(ch.name) || undefined,
      location: pickString(ch.location) || undefined,
      price_per_night: pickNumber(ch.price_per_night) ?? undefined,
      num_rooms: pickNumber(ch.num_rooms) ?? undefined,
      max_guests: pickNumber(ch.max_guests) ?? undefined,
      description: pickString(ch.description) || undefined,
      // Empty/missing zones never wipe the saved knowledge base.
      data_zones: sanitizeDataZones(ch.data_zones).length ? sanitizeDataZones(ch.data_zones) : undefined,
      min_nights_rules: sanitizeMinNightsRules(ch.min_nights_rules),
      amenities: sanitizeAmenities(ch.amenities),
      // null from the LLM means "nothing outdoors mentioned", never "wipe the existing yard".
      outdoor_area: sanitizeOutdoorArea(ch.outdoor_area) ?? undefined,
    };
    Object.keys(changes).forEach((k) => {
      if (changes[k] === undefined) delete changes[k];
    });
    if (Object.keys(changes).length === 0) changes = null;
  }

  const uiEffects = [];
  if ((action === 'update' || action === 'confirm') && changes) {
    uiEffects.push({ type: 'zimmer_changes_preview', changes });
  }

  return {
    content: message,
    uiEffects,
    parsed: { action, message, changes },
  };
}

/**
 * @param {unknown} raw
 */
export function parseOwnerBookingCreatorResponse(raw, opts = {}) {
  let action = pickString(raw?.action) || 'ask';
  let message =
    pickString(raw?.message) || 'תשובת mock בעברית';

  let booking = null;
  if (raw?.booking && typeof raw.booking === 'object') {
    const b = raw.booking;
    booking = {
      guest_name: pickString(b.guest_name) || null,
      guest_phone: pickString(b.guest_phone) || null,
      check_in: pickString(b.check_in) || null,
      check_out: pickString(b.check_out) || null,
      zimmer_name: pickString(b.zimmer_name) || null,
      num_guests: (() => {
        const n = pickNumber(b.num_guests);
        return n != null && n > 0 ? Math.round(n) : null;
      })(),
      notes: pickString(b.notes) || null,
      status: b.status === 'ממתינה' || b.status === 'אושרה' ? b.status : null,
      price_override: (() => {
        const n = pickNumber(b.price_override);
        return n != null && n > 0 ? Math.round(n) : null;
      })(),
    };
  }

  const collectedStatus = opts.collectedData?.status;
  if (booking && !booking.status && (collectedStatus === 'ממתינה' || collectedStatus === 'אושרה')) {
    booking.status = collectedStatus;
  }
  const collectedGuests = Number(opts.collectedData?.num_guests);
  if (booking && booking.num_guests == null && Number.isFinite(collectedGuests) && collectedGuests > 0) {
    booking.num_guests = Math.round(collectedGuests);
  }
  // Never create without an explicit status — ask the owner instead of defaulting.
  if (action === 'create' && booking && !booking.status) {
    action = 'ask';
    message = 'להוסיף את ההזמנה כמאושרת או כממתינה לאישור?';
  }
  // Never invent guest count — ask instead of defaulting to 1.
  if (action === 'create' && booking && booking.num_guests == null) {
    action = 'ask';
    message = 'כמה אורחים?';
  }

  const uiEffects = [];
  if (action === 'create' && booking) {
    uiEffects.push({ type: 'booking_preview', booking });
  }

  return {
    content: message,
    uiEffects,
    parsed: { action, message, booking },
  };
}

/**
 * @param {unknown} raw
 */
export function parseOwnerZimmerCreatorResponse(raw) {
  const action = pickString(raw?.action) || 'collect';
  const message =
    pickString(raw?.message) || 'תשובת mock בעברית';

  let zimmerData = null;
  if (raw?.zimmer_data && typeof raw.zimmer_data === 'object') {
    const z = raw.zimmer_data;
    zimmerData = {
      name: pickString(z.name) || null,
      location: pickString(z.location) || null,
      price_per_night: pickNumber(z.price_per_night),
      weekday_price: pickNumber(z.weekday_price),
      weekend_price: pickNumber(z.weekend_price),
      num_rooms: pickNumber(z.num_rooms),
      max_guests: pickNumber(z.max_guests),
      max_guests_event: pickNumber(z.max_guests_event),
      description: pickString(z.description) || null,
      data_zones: sanitizeDataZones(z.data_zones).length ? sanitizeDataZones(z.data_zones) : null,
      contact_phone: pickString(z.contact_phone) || null,
      expose_availability_calendar:
        typeof z.expose_availability_calendar === 'boolean' ? z.expose_availability_calendar : null,
      additional_bathrooms_count: pickNumber(z.additional_bathrooms_count),
      min_nights_rules: sanitizeMinNightsRules(z.min_nights_rules),
      rooms_detail: sanitizeRoomsDetail(z.rooms_detail),
      outdoor_area: sanitizeOutdoorArea(z.outdoor_area) ?? null,
      unclear_placement: Array.isArray(z.unclear_placement)
        ? z.unclear_placement.map((s) => sanitizeUntrustedText(String(s || ''), 40)).filter(Boolean)
        : [],
    };
    // Omitted keys must not overwrite data collected in earlier turns (client merges with spread).
    for (const key of Object.keys(zimmerData)) {
      if (zimmerData[key] === null || zimmerData[key] === undefined) delete zimmerData[key];
    }
  }

  const uiEffects = [];
  if (action === 'build' && zimmerData) {
    uiEffects.push({ type: 'zimmer_preview', zimmerData });
  }

  return {
    content: message,
    uiEffects,
    parsed: { action, message, zimmer_data: zimmerData },
  };
}
