/**
 * Zimmer outdoor_area (yard) — sanitize LLM/owner input and summarize for prompts.
 * Mirrors the outdoor helpers in src/lib/rooms.js.
 */
import { sanitizeUntrustedText } from './sanitize-prompt-data.js';

const PRIVACY = new Set(['private', 'shared']);
const MAX_ITEMS = 40;

// Same keyword set as classifyAmenity's "outdoor" group in src/lib/rooms.js.
const OUTDOOR_KEYWORDS = ['בריכה', 'בריכת', 'ג׳קוזי', 'גקוזי', 'גינה', 'מרפסת', 'מנגל', 'חניה', 'נדנדה', 'סאונה', 'ערסל', 'פינת ישיבה', 'משתלה', 'דשא', 'חצר'];

const cleanStr = (v, max = 300) => (typeof v === 'string' ? sanitizeUntrustedText(v).slice(0, max).trim() : '');

function sanitizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanStr(raw.name, 80);
  if (!name) return null;
  const out = { name };
  if (PRIVACY.has(raw.privacy)) out.privacy = raw.privacy;
  if (typeof raw.heated === 'boolean') out.heated = raw.heated;
  if (typeof raw.covered === 'boolean') out.covered = raw.covered;
  ['size', 'hours', 'note'].forEach((k) => {
    const v = cleanStr(raw[k], k === 'note' ? 300 : 80);
    if (v) out[k] = v;
  });
  return out;
}

/**
 * @returns {object|null|undefined} undefined when the field was not sent (keep existing),
 *   null when explicitly cleared / empty.
 */
export function sanitizeOutdoorArea(raw) {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  const description = cleanStr(raw.description, 800);
  if (description) out.description = description;
  const size = Number(raw.size_sqm);
  if (Number.isFinite(size) && size > 0) out.size_sqm = size;
  if (PRIVACY.has(raw.privacy)) out.privacy = raw.privacy;
  if (Array.isArray(raw.photos)) {
    const photos = raw.photos.filter((p) => typeof p === 'string' && p.trim());
    if (photos.length) out.photos = photos;
  }
  if (Array.isArray(raw.items)) {
    const seen = new Set();
    const items = raw.items
      .map(sanitizeItem)
      .filter((it) => it && !seen.has(it.name) && seen.add(it.name))
      .slice(0, MAX_ITEMS);
    if (items.length) out.items = items;
  }
  return Object.keys(out).length ? out : null;
}

const hasOutdoorArea = (z) => !!(z?.outdoor_area && typeof z.outdoor_area === 'object' && Object.keys(z.outdoor_area).length);

/** Yard items; legacy zimmers without outdoor_area derive them from the flat amenities list. */
export function effectiveOutdoorItems(zimmer) {
  if (hasOutdoorArea(zimmer)) {
    return (Array.isArray(zimmer.outdoor_area.items) ? zimmer.outdoor_area.items : []).map(sanitizeItem).filter(Boolean);
  }
  return (Array.isArray(zimmer?.amenities) ? zimmer.amenities : [])
    .filter((a) => OUTDOOR_KEYWORDS.some((w) => String(a).includes(w)))
    .map((a) => ({ name: cleanStr(String(a), 80) }))
    .filter((it) => it.name);
}

function itemLabel(item, areaPrivacy) {
  const parts = [];
  if (item.heated) parts.push('מחומם');
  if (item.covered) parts.push('מקורה');
  if (item.size) parts.push(item.size);
  if (item.hours) parts.push(item.hours);
  if (item.privacy && item.privacy !== areaPrivacy) parts.push(item.privacy === 'private' ? 'פרטי' : 'משותף');
  if (item.note) parts.push(item.note);
  return parts.length ? `${item.name} (${parts.join(', ')})` : item.name;
}

/** One-line yard summary for prompts, e.g. "חצר: פרטית, 200 מ״ר — בריכה (מחומם), מנגל". '' when none. */
export function outdoorAreaSummary(zimmer) {
  const a = hasOutdoorArea(zimmer) ? zimmer.outdoor_area : {};
  const head = [];
  if (a.privacy) head.push(a.privacy === 'private' ? 'פרטית' : 'משותפת');
  if (Number(a.size_sqm) > 0) head.push(`${a.size_sqm} מ״ר`);
  const itemsStr = effectiveOutdoorItems(zimmer).map((it) => itemLabel(it, a.privacy)).join(', ');
  const description = cleanStr(a.description, 300);
  const parts = [head.join(', '), itemsStr].filter(Boolean).join(' — ');
  const body = [parts, description].filter(Boolean).join('. ');
  return body ? `חצר: ${body}` : '';
}

export function sanitizeAmenities(raw) {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  return [...new Set(raw.map((a) => cleanStr(a, 80)).filter(Boolean))];
}
