// Shared helpers for Zimmer rooms detail, amenities + contact phone.

// bed_type stored as neutral English keys; Hebrew labels live here only for display.
export const BED_TYPES = [
  { key: 'king', label: 'מלכותית' },
  { key: 'queen', label: 'זוגית' },
  { key: 'single', label: 'יחיד' },
  { key: 'bunk', label: 'קומתיים' },
  { key: 'sofa_bed', label: 'ספה נפתחת' },
  { key: 'mattress', label: 'מזרן' },
  { key: 'other', label: 'אחר' },
];

// People per single bed of this type. Types missing here (sofa_bed, other) vary and must be
// provided per bed via `sleeps` — never assume.
export const FIXED_BED_CAPACITY = { king: 2, queen: 2, bunk: 2, single: 1, mattress: 1 };

export const bedTypeLabel = (key) => BED_TYPES.find((b) => b.key === key)?.label || (key || '');

// Display label for a single bed entry — custom name wins over the generic "אחר".
export const bedLabel = (bed) => (bed?.custom_label && String(bed.custom_label).trim()) || bedTypeLabel(bed?.bed_type);

// Canonical bed entry. `sleeps` / `custom_label` are omitted when unknown (schema types are non-null).
export function normalizeBed(b) {
  const out = { bed_type: b?.bed_type || 'queen', count: Math.max(1, Number(b?.count) || 1) };
  const sleeps = Number(b?.sleeps);
  if (sleeps > 0) out.sleeps = sleeps;
  const label = b?.custom_label == null ? '' : String(b.custom_label).trim();
  if (label && out.bed_type === 'other') out.custom_label = label;
  return out;
}

// People per one bed of this entry, or null when unknown.
export function bedSleeps(bed) {
  const s = Number(bed?.sleeps);
  if (s > 0) return s;
  return FIXED_BED_CAPACITY[bed?.bed_type] ?? null;
}

// beds[] is authoritative when non-empty, or when empty without a legacy beds_count
// (a room intentionally left without beds, e.g. not yet assigned).
const hasBedsArray = (room) => Array.isArray(room?.beds)
  && (room.beds.length > 0 || room.beds_count == null || Number(room.beds_count) === 0);

// Normalize any room record (old beds_count/bed_type OR new beds[]) to a beds[] array.
export function roomBeds(room) {
  if (!room) return [];
  if (hasBedsArray(room)) return room.beds.map(normalizeBed);
  // Legacy single-bed shape
  const count = Math.max(1, Number(room.beds_count) || 1);
  return [{ bed_type: room.bed_type || 'queen', count }];
}

// Human label for a room's beds, e.g. "2 מיטות · מלכותית, יחיד"
export function roomBedsLabel(room) {
  const beds = roomBeds(room);
  const total = beds.reduce((s, b) => s + b.count, 0);
  const types = [...new Set(beds.map(bedLabel).filter(Boolean))];
  const typeStr = types.length ? ` · ${types.join(', ')}` : '';
  return `${total} מיטות${typeStr}`;
}

// Sleeping places across rooms. Beds with unknown capacity are counted separately, not guessed.
export function roomsSleepingCapacity(roomsDetail) {
  let assigned = 0;
  let unknownBeds = 0;
  (Array.isArray(roomsDetail) ? roomsDetail : []).forEach((r) => {
    roomBeds(r).forEach((b) => {
      const s = bedSleeps(b);
      if (s == null) unknownBeds += b.count;
      else assigned += s * b.count;
    });
  });
  return { assigned, unknownBeds };
}

// Owner-defined bed types ("other" + custom_label) found across the given zimmers, deduped by name.
export function collectCustomBedTypes(zimmers) {
  const byName = new Map();
  (Array.isArray(zimmers) ? zimmers : []).forEach((z) => {
    (Array.isArray(z?.rooms_detail) ? z.rooms_detail : []).forEach((r) => {
      roomBeds(r).forEach((b) => {
        if (b.bed_type !== 'other' || !b.custom_label) return;
        const key = b.custom_label.toLowerCase();
        const prev = byName.get(key);
        if (!prev) byName.set(key, { custom_label: b.custom_label, sleeps: b.sleeps ?? null });
        else if (prev.sleeps == null && b.sleeps) prev.sleeps = b.sleeps;
      });
    });
  });
  return [...byName.values()];
}

// Total beds across rooms_detail.
// Returns null when there is no rooms_detail — callers must NOT fall back to num_rooms
// (rooms ≠ beds). null means "don't show beds".
export function totalBeds(roomsDetail) {
  if (!Array.isArray(roomsDetail) || roomsDetail.length === 0) return null;
  return roomsDetail.reduce((sum, r) => sum + roomBeds(r).reduce((s, b) => s + b.count, 0), 0);
}

// Total bathrooms = private (has_bathroom/has_private_bathroom per room) + additional/shared count.
export function bathroomsCount(roomsDetail, additional = 0) {
  let count = Number(additional) || 0;
  if (Array.isArray(roomsDetail)) {
    count += roomsDetail.filter((r) => r && (r.has_bathroom || r.has_private_bathroom)).length;
  }
  return count;
}

// Total in-room guest capacity across rooms (sum of max_guests_in_room). null if none set.
export function roomsCapacity(roomsDetail) {
  if (!Array.isArray(roomsDetail) || roomsDetail.length === 0) return null;
  const sum = roomsDetail.reduce((s, r) => s + (Number(r?.max_guests_in_room) || 0), 0);
  return sum || null;
}

// ---- Amenity auto-classification ----
// A flat amenities[] is classified into 3 groups via keyword matching.
export const AMENITY_GROUPS = [
  { key: 'property', label: 'בנכס', icon: 'home' },
  { key: 'outdoor', label: 'בחוץ', icon: 'tree' },
  { key: 'nearby', label: 'בסביבה', icon: 'pin' },
];

const AMENITY_KEYWORDS = {
  outdoor: ['בריכה', 'בריכת', 'ג׳קוזי', 'גקוזי', 'גינה', 'מרפסת', 'מנגל', 'חניה', 'נדנדה', 'סאונה', 'ערסל', 'פינת ישיבה', 'משתלה', 'דשא', 'חצר'],
  nearby: ['מכולת', 'סופר', 'מסעדה', 'חוף', 'שביל', 'נוף', 'אטרקציה', 'בית קפה', 'קניון', 'תחנה', 'מרכז', 'טבע', 'שמורה'],
};

export function classifyAmenity(name) {
  if (!name) return 'property';
  const n = String(name).toLowerCase();
  for (const [group, words] of Object.entries(AMENITY_KEYWORDS)) {
    if (words.some((w) => n.includes(w.toLowerCase()))) return group;
  }
  return 'property';
}

export function groupAmenities(amenities) {
  const out = { property: [], outdoor: [], nearby: [] };
  (amenities || []).forEach((a) => {
    const g = classifyAmenity(a);
    out[g].push(a);
  });
  return out;
}

// ---- Outdoor area (yard) ----
// `detailed` items get the extended fields (heated / covered / size / hours) in the editor.
export const OUTDOOR_ITEM_CATALOG = [
  { name: 'בריכה', detailed: true },
  { name: "ג'קוזי", detailed: true },
  { name: 'סאונה', detailed: true },
  { name: 'מטבח חיצוני', detailed: true },
  { name: 'מנגל' },
  { name: 'ערסל' },
  { name: 'דשא' },
  { name: 'פינת ישיבה' },
  { name: 'פרגולה' },
  { name: 'משחקי ילדים' },
  { name: 'מקלחת חוץ' },
  { name: 'פינת מדורה' },
  { name: 'חניה' },
];

const DETAILED_OUTDOOR_WORDS = ['בריכ', "ג'קוזי", 'ג׳קוזי', 'גקוזי', 'ספא', 'סאונה', 'מטבח'];

export const isDetailedOutdoorItem = (name) => {
  const n = String(name || '');
  return DETAILED_OUTDOOR_WORDS.some((w) => n.includes(w));
};

// Amenities that may be indoors or outdoors — creators ask the owner where they are.
export const AMBIGUOUS_PLACEMENT = ["ג'קוזי", 'סאונה', 'מטבח', 'מקלחת', 'מרפסת', 'אח'];

// Subset checked in code after the AI build (others are left to the AI's judgment to avoid
// asking about e.g. every shower). `words` are the spellings found in owner text.
const PLACEMENT_WATCH = [
  { name: "ג'קוזי", words: ["ג'קוזי", 'ג׳קוזי', 'גקוזי', 'ספא'] },
  { name: 'סאונה', words: ['סאונה'] },
];

const mentionsAny = (text, words) => words.some((w) => String(text || '').includes(w));

// Ambiguous items mentioned by the owner but not placed indoors (room amenities) or outdoors.
export function detectUnclearPlacement(ownerText, zimmer, { resolved = [], aiUnclear = [] } = {}) {
  const outdoorNames = (zimmer?.outdoor_area?.items || []).map((it) => it?.name || '');
  const roomAmenities = (zimmer?.rooms_detail || []).flatMap((r) => r?.amenities || []);
  const placed = (words) => [...outdoorNames, ...roomAmenities].some((n) => mentionsAny(n, words));
  const out = [];
  PLACEMENT_WATCH.forEach(({ name, words }) => {
    if (mentionsAny(ownerText, words) && !placed(words)) out.push(name);
  });
  (Array.isArray(aiUnclear) ? aiUnclear : []).forEach((n) => {
    const name = cleanStr(n);
    if (name && !out.includes(name)) out.push(name);
  });
  return out.filter((n) => !resolved.includes(n));
}

// Apply the owner's answer: 'outside' → yard only, 'inside' → property amenities, 'both' → both.
export function applyPlacement(zimmer, name, choice) {
  const watch = PLACEMENT_WATCH.find((w) => w.name === name);
  const words = watch ? watch.words : [name];
  const area = zimmer.outdoor_area && typeof zimmer.outdoor_area === 'object' ? zimmer.outdoor_area : {};
  let items = Array.isArray(area.items) ? area.items : [];
  let amenities = Array.isArray(zimmer.amenities) ? zimmer.amenities : [];
  const inYard = items.some((it) => mentionsAny(it?.name, words));
  const inAmenities = amenities.some((a) => mentionsAny(a, words));
  if (choice !== 'inside' && !inYard) items = [...items, { name }];
  if (choice === 'inside') items = items.filter((it) => !mentionsAny(it?.name, words));
  if (choice !== 'outside' && !inAmenities) amenities = [...amenities, name];
  if (choice === 'outside') amenities = amenities.filter((a) => !mentionsAny(a, words));
  return { ...zimmer, amenities, outdoor_area: { ...area, items } };
}

export const OUTDOOR_PRIVACY_LABELS = { private: 'פרטי', shared: 'משותף' };

const cleanStr = (v) => (v == null ? '' : String(v).trim());

export function normalizeOutdoorItem(item) {
  const name = cleanStr(item?.name);
  if (!name) return null;
  const out = { name };
  if (item.privacy === 'private' || item.privacy === 'shared') out.privacy = item.privacy;
  if (typeof item.heated === 'boolean') out.heated = item.heated;
  if (typeof item.covered === 'boolean') out.covered = item.covered;
  ['size', 'hours', 'note'].forEach((k) => {
    const v = cleanStr(item[k]);
    if (v) out[k] = v;
  });
  return out;
}

// Canonical outdoor_area for saving, or null when nothing meaningful was entered.
export function normalizeOutdoorAreaForSave(area) {
  if (!area || typeof area !== 'object') return null;
  const out = {};
  const description = cleanStr(area.description);
  if (description) out.description = description;
  const size = Number(area.size_sqm);
  if (area.size_sqm !== '' && area.size_sqm != null && size > 0) out.size_sqm = size;
  if (area.privacy === 'private' || area.privacy === 'shared') out.privacy = area.privacy;
  const photos = (Array.isArray(area.photos) ? area.photos : []).filter((p) => cleanStr(p));
  if (photos.length) out.photos = photos;
  const seen = new Set();
  const items = (Array.isArray(area.items) ? area.items : [])
    .map(normalizeOutdoorItem)
    .filter((it) => it && !seen.has(it.name) && seen.add(it.name));
  if (items.length) out.items = items;
  return Object.keys(out).length ? out : null;
}

export const hasOutdoorArea = (zimmer) => {
  const a = zimmer?.outdoor_area;
  return !!(a && typeof a === 'object' && Object.keys(a).length);
};

// Yard items: the structured outdoor_area when present; for legacy zimmers derive from amenities.
export function effectiveOutdoorItems(zimmer) {
  if (hasOutdoorArea(zimmer)) {
    return (Array.isArray(zimmer.outdoor_area.items) ? zimmer.outdoor_area.items : [])
      .map(normalizeOutdoorItem)
      .filter(Boolean);
  }
  return (Array.isArray(zimmer?.amenities) ? zimmer.amenities : [])
    .filter((a) => classifyAmenity(a) === 'outdoor')
    .map((name) => ({ name: String(name).trim() }));
}

// Editor seed: the stored outdoor_area, or a draft derived from legacy amenities.
export function outdoorAreaDraft(zimmer) {
  if (hasOutdoorArea(zimmer)) {
    const a = zimmer.outdoor_area;
    return {
      description: a.description || '',
      size_sqm: a.size_sqm ?? '',
      privacy: a.privacy || '',
      photos: Array.isArray(a.photos) ? a.photos : [],
      items: Array.isArray(a.items) ? a.items : [],
    };
  }
  return { description: '', size_sqm: '', privacy: '', photos: [], items: effectiveOutdoorItems(zimmer) };
}

// One-line item label, e.g. "בריכה (מחומם, מקורה, 4x8, 08:00-22:00, משותף)".
export function outdoorItemLabel(item, areaPrivacy) {
  const parts = [];
  if (item.heated) parts.push('מחומם');
  if (item.covered) parts.push('מקורה');
  if (item.size) parts.push(item.size);
  if (item.hours) parts.push(item.hours);
  if (item.privacy && item.privacy !== areaPrivacy) parts.push(OUTDOOR_PRIVACY_LABELS[item.privacy]);
  if (item.note) parts.push(item.note);
  return parts.length ? `${item.name} (${parts.join(', ')})` : item.name;
}

// Plain-text summary for AI context, e.g. "חצר: פרטית, 200 מ״ר — בריכה (מחומם), מנגל".
export function outdoorAreaSummary(zimmer) {
  const items = effectiveOutdoorItems(zimmer);
  const a = hasOutdoorArea(zimmer) ? zimmer.outdoor_area : {};
  const head = [];
  if (a.privacy) head.push(a.privacy === 'private' ? 'פרטית' : 'משותפת');
  if (a.size_sqm) head.push(`${a.size_sqm} מ״ר`);
  const itemsStr = items.map((it) => outdoorItemLabel(it, a.privacy)).join(', ');
  const parts = [head.join(', '), itemsStr].filter(Boolean).join(' — ');
  const body = [parts, a.description].filter(Boolean).join('. ');
  return body ? `חצר: ${body}` : '';
}

// ---- Phone normalization (E.164 for wa.me / tel) ----
export function normalizePhoneE164(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d]/g, '');
  if (!s) return null;
  if (s.startsWith('972')) s = s.slice(3);
  else if (s.startsWith('00972')) s = s.slice(5);

  if (s.length === 10 && s.startsWith('0')) s = s.slice(1);
  else if (s.length === 9 && s.startsWith('0')) s = s.slice(1);
  else if (s.length === 9 && !s.startsWith('0')) {
    // already without leading 0
  } else {
    return null;
  }
  if (s.length !== 9) return null;
  return '972' + s;
}

// Format an E.164 Israeli number back to a readable local form: 972501234567 → 050-123-4567
export function formatPhoneDisplay(e164) {
  if (!e164) return '';
  let s = String(e164);
  if (s.startsWith('972')) s = s.slice(3);
  if (s.length === 9 && !s.startsWith('0')) s = '0' + s;
  if (s.length === 10 && s.startsWith('0')) {
    return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`;
  }
  return s;
}

export function whatsappLink(phoneE164, text) {
  const base = `https://wa.me/${phoneE164}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

// Crude "who's it for" estimate from max_guests (displayed as an estimate, not a fact).
export function matchTag(maxGuests) {
  if (maxGuests == null || isNaN(Number(maxGuests))) return null;
  const g = Number(maxGuests);
  if (g <= 2) return 'זוגות';
  if (g <= 4) return 'זוגות + ילדים';
  return 'משפחות / קבוצות';
}

// ---- Auto amenity detection from free text ----
// Canonical amenity name → synonyms that, when found in text, signal this amenity is present.
// Used to auto-populate amenities from owner description (no AI guessing — only keyword matches).
export const AMENITY_DICTIONARY = [
  { name: 'Wi-Fi', words: ['וייפיי', 'ויפי', 'wi-fi', 'wifi', 'אינטרנט', 'wi fi'] },
  { name: 'מזגן', words: ['מזגן', 'ממוזג', 'מיזוג'] },
  { name: 'טלוויזיה', words: ['טלוויזיה', 'טלויזיה', 'טלויזור', 'tv', 'מסך'] },
  { name: 'מטבחון', words: ['מטבחון', 'מטבח'] },
  { name: 'מקרר', words: ['מקרר'] },
  { name: 'מדיח כלים', words: ['מדיח'] },
  { name: 'בריכה פרטית', words: ['בריכה פרטית', 'בריכת זרמים', 'בריכת זרם', 'בריכה מחוממת'] },
  { name: "ג'קוזי ספא", words: ['ג׳קוזי', 'גקוזי', 'ספא', 'spa'] },
  { name: 'סאונה', words: ['סאונה'] },
  { name: 'מנגל', words: ['מנגל', 'גריל', 'bbq'] },
  { name: 'חניה', words: ['חניה', 'חנייה'] },
  { name: 'חימום', words: ['חימום', 'מחמם'] },
  { name: 'אח', words: ['קמין'] },
  { name: 'מגבות', words: ['מגבות'] },
  { name: 'מייבש שיער', words: ['מייבש שיער', 'מייבש'] },
  { name: 'נטפליקס', words: ['נטפליקס', 'netflix'] },
  { name: 'נוף מרשים', words: ['נוף מרשים', 'נוף ל', 'נוף פתוח'] },
  { name: 'ערסל', words: ['ערסל'] },
  { name: 'משחקי ילדים', words: ['משחקי ילדים', 'נדנדה', 'מגלשה', 'מתקני ילדים'] },
  { name: 'מזרון אורטופדי', words: ['אורטופדי'] },
  { name: 'שולחן סנוקר', words: ['סנוקר', 'ביליארד'] },
  { name: 'מטבח חיצוני', words: ['מטבח חיצוני', 'מטבח אאוטדור', 'מטבח חוץ'] },
  { name: 'חצר פרטית', words: ['חצר פרטית', 'חצר מ'] },
];

// Detect amenities present in free text by keyword matching. Returns deduped canonical names.
// `existing` entries already on the record are preserved (merged). Hebrew-aware word boundary.
export function extractAmenitiesFromText(text, existing = []) {
  if (!text) return [];
  const t = ' ' + String(text).toLowerCase() + ' ';
  const found = [];
  for (const def of AMENITY_DICTIONARY) {
    let matched = false;
    for (const raw of def.words) {
      if (!raw) continue;
      const w = String(raw).toLowerCase();
      // Special short/ambiguous tokens get word-boundary checks; long ones use substring.
      if (w.length <= 3 || w === 'tv') {
        const re = new RegExp(`(^|[^a-z\u05D0-\u05EA])${escapeReg(w)}(?=$|[^a-z\u05D0-\u05EA])`, 'i');
        if (re.test(t)) { matched = true; break; }
      } else {
        if (t.includes(w)) { matched = true; break; }
      }
    }
    if (matched) found.push(def.name);
  }
  // Preserve spelling-free existing values; dedup case-insensitively against found.
  const merged = [...existing];
  for (const a of found) {
    if (!merged.some((m) => String(m).trim() === a)) merged.push(a);
  }
  return merged;
}

function escapeReg(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Normalize a rooms_detail entry to the canonical shape the entity schema expects
// (beds[] + derived beds_count + bed_type), used by creators/editors before saving.
// An explicitly empty beds[] stays empty (beds_count 0) — never inject a default bed.
export function normalizeRoomForSave(r) {
  const beds = hasBedsArray(r)
    ? r.beds.map(normalizeBed)
    : [{ bed_type: r?.bed_type || 'queen', count: Math.max(1, Number(r?.beds_count) || 1) }];
  const beds_count = beds.reduce((s, b) => s + b.count, 0);
  return {
    room_name: r?.room_name || null,
    beds,
    beds_count,
    bed_type: beds[0]?.bed_type || 'queen',
    max_guests_in_room: (r?.max_guests_in_room === '' || r?.max_guests_in_room == null) ? null : Number(r.max_guests_in_room),
    has_bathroom: !!r?.has_bathroom,
    room_photo: r?.room_photo || null,
    amenities: (Array.isArray(r?.amenities) ? r.amenities : []).filter((a) => String(a).trim()),
  };
}