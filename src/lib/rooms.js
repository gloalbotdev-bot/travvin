// Shared helpers for Zimmer rooms detail, amenities + contact phone.

// bed_type stored as neutral English keys; Hebrew labels live here only for display.
export const BED_TYPES = [
  { key: 'king', label: 'מלכותית' },
  { key: 'queen', label: 'זוגית' },
  { key: 'single', label: 'יחיד' },
  { key: 'bunk', label: 'קומתיים' },
  { key: 'sofa_bed', label: 'ספה נפתחת' },
  { key: 'other', label: 'אחר' },
];

export const bedTypeLabel = (key) => BED_TYPES.find((b) => b.key === key)?.label || (key || '');

// Normalize any room record (old beds_count/bed_type OR new beds[]) to a beds[] array.
export function roomBeds(room) {
  if (!room) return [];
  if (Array.isArray(room.beds) && room.beds.length) {
    return room.beds.map((b) => ({ bed_type: b.bed_type || 'queen', count: Math.max(1, Number(b.count) || 1) }));
  }
  // Legacy single-bed shape
  const count = Math.max(1, Number(room.beds_count) || 1);
  return [{ bed_type: room.bed_type || 'queen', count }];
}

// Human label for a room's beds, e.g. "2 מיטות · מלכותית, יחיד"
export function roomBedsLabel(room) {
  const beds = roomBeds(room);
  const total = beds.reduce((s, b) => s + b.count, 0);
  const types = beds.map((b) => bedTypeLabel(b.bed_type)).filter(Boolean);
  const typeStr = types.length ? ` · ${types.join(', ')}` : '';
  return `${total} מיטות${typeStr}`;
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
export function normalizeRoomForSave(r) {
  const beds = Array.isArray(r?.beds) && r.beds.length
    ? r.beds.map((b) => ({ bed_type: b.bed_type || 'queen', count: Math.max(1, Number(b.count) || 1) }))
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