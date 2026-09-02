/**
 * Creator/editor response parsers — Phase 8.
 */
import { sanitizeUntrustedText } from '../../sanitize-prompt-data.js';

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
      content: sanitizeUntrustedText(String(z.content || '')),
      source_label: sanitizeUntrustedText(String(z.source_label || 'עריכה ידנית')),
      source_type: sanitizeUntrustedText(String(z.source_type || 'טקסט חופשי')),
      source_date: sanitizeUntrustedText(String(z.source_date || '')),
    }))
    .filter((z) => z.content);
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
      data_zones: sanitizeDataZones(ch.data_zones),
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
export function parseOwnerBookingCreatorResponse(raw) {
  const action = pickString(raw?.action) || 'ask';
  const message =
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
      num_guests: pickNumber(b.num_guests),
      notes: pickString(b.notes) || null,
      status: b.status === 'ממתינה' || b.status === 'אושרה' ? b.status : null,
    };
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
      description: pickString(z.description) || null,
      data_zones: sanitizeDataZones(z.data_zones),
    };
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
