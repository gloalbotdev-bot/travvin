// Shared booking price calculation used across dashboard, calendar, bookings list, and creator.

export function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut) - new Date(checkIn);
  const nights = Math.ceil(diff / 86400000);
  return Math.max(0, nights);
}

export function calcBookingTotal(checkIn, checkOut, pricePerNight) {
  const nights = calcNights(checkIn, checkOut);
  const price = Number(pricePerNight) || 0;
  if (nights <= 0) return 0;
  return nights * price;
}

// ---- Seasonal pricing ----
// increase capped at 100%, decrease capped at 75%
export function clampPercentage(adjustment, pct) {
  const p = Math.max(0, Number(pct) || 0);
  if (adjustment === 'decrease') return Math.min(75, p);
  return Math.min(100, p);
}

// Find the seasonal rule covering a date, if any.
function seasonalRuleForDate(seasonalPricing, dateStr) {
  for (const rule of seasonalPricing || []) {
    if (rule.start_date && rule.end_date && dateStr >= rule.start_date && dateStr <= rule.end_date) {
      return rule;
    }
  }
  return null;
}

// A rule may set an absolute price_per_night, or a percentage adjustment.
function seasonalMultiplierForDate(seasonalPricing, dateStr) {
  const rule = seasonalRuleForDate(seasonalPricing, dateStr);
  if (!rule) return 1;
  const pct = clampPercentage(rule.adjustment, rule.percentage);
  return rule.adjustment === 'decrease' ? (1 - pct / 100) : (1 + pct / 100);
}

// ---- Partial (per-person) pricing ----
// Applies when the owner enabled partial pricing and the group is smaller than
// max capacity but at least the declared minimum. When occupancy is unknown
// (0 guests) we fall back to the full nightly price.
// Midweek (Sun–Wed) vs weekend (Thu–Fri nights). Saturday night counts as weekday.
const WEEKEND_DAYS = new Set([4, 5]); // Thursday(4), Friday(5)
function weekdayOrWeekendPrice(zimmer, dateStr) {
  const base = Number(zimmer?.price_per_night) || 0;
  if (!dateStr) return base;
  const day = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  const isWeekend = WEEKEND_DAYS.has(day);
  return isWeekend
    ? (zimmer?.weekend_price != null ? Number(zimmer.weekend_price) : base)
    : (zimmer?.weekday_price != null ? Number(zimmer.weekday_price) : base);
}

export function basePricePerNight(zimmer, numAdults = 0, numChildren = 0, dateStr = null) {
  const total = (Number(numAdults) || 0) + (Number(numChildren) || 0);
  const max = Number(zimmer?.max_guests) || 0;
  const min = Number(zimmer?.min_guests) || 0;
  if (total > 0 && zimmer?.partial_pricing_enabled && zimmer.price_per_adult != null && total < max && total >= min) {
    return (Number(numAdults) || 0) * (Number(zimmer.price_per_adult) || 0)
         + (Number(numChildren) || 0) * (Number(zimmer.price_per_child) || 0);
  }
  return weekdayOrWeekendPrice(zimmer, dateStr);
}

export function effectivePricePerNight(zimmer, dateStr, numAdults = 0, numChildren = 0) {
  const base = basePricePerNight(zimmer, numAdults, numChildren, dateStr);
  const rule = seasonalRuleForDate(zimmer?.seasonal_pricing, dateStr);
  if (!rule) return base;
  // Absolute price override for the date window.
  if (rule.price_per_night != null && rule.price_per_night !== '' && !Number.isNaN(Number(rule.price_per_night))) {
    return Math.round(Number(rule.price_per_night));
  }
  return Math.round(base * seasonalMultiplierForDate(zimmer?.seasonal_pricing, dateStr));
}

// Total for a stay, honoring partial pricing + seasonal adjustments per night.
export function calcBookingTotalForZimmer(zimmer, checkIn, checkOut, numAdults = 0, numChildren = 0) {
  const nights = calcNights(checkIn, checkOut);
  if (nights <= 0) return 0;
  let total = 0;
  let cursor = new Date(checkIn);
  for (let i = 0; i < nights; i++) {
    const ds = cursor.toISOString().split('T')[0];
    total += effectivePricePerNight(zimmer, ds, numAdults, numChildren);
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return total;
}

// True when partial per-person pricing applies for this occupancy.
export function isPartialPricing(zimmer, numAdults = 0, numChildren = 0) {
  const total = (Number(numAdults) || 0) + (Number(numChildren) || 0);
  const max = Number(zimmer?.max_guests) || 0;
  const min = Number(zimmer?.min_guests) || 0;
  return !!(total > 0 && zimmer?.partial_pricing_enabled && zimmer.price_per_adult != null && total < max && total >= min);
}

// Rank available zimmers: closest fill to the requested group first,
// then bigger places that can host them (full or partial).
export function rankZimmersByFit(zimmers, numAdults = 0, numChildren = 0) {
  const total = (Number(numAdults) || 0) + (Number(numChildren) || 0);
  return [...zimmers].sort((a, b) => {
    const da = Math.max(0, (Number(a.max_guests) || 0) - total);
    const db = Math.max(0, (Number(b.max_guests) || 0) - total);
    if (da !== db) return da - db;
    return (Number(a.price_per_night) || 0) - (Number(b.price_per_night) || 0);
  });
}

export function zimmerPriceSummary(zimmer, checkIn, checkOut, numAdults = 0, numChildren = 0) {
  const total = calcBookingTotalForZimmer(zimmer, checkIn, checkOut, numAdults, numChildren);
  const nights = calcNights(checkIn, checkOut);
  const avg = nights > 0 ? Math.round(total / nights) : 0;
  return { total, avg, nights, isPartial: isPartialPricing(zimmer, numAdults, numChildren) };
}

// Prefer stored total_price; fall back to zimmer-aware calculation.
export function getBookingTotal(booking, zimmer) {
  if (
    booking?.price_override != null &&
    booking.price_override !== '' &&
    !Number.isNaN(Number(booking.price_override)) &&
    Number(booking.price_override) > 0
  ) {
    return Number(booking.price_override);
  }
  if (booking?.total_price != null && !Number.isNaN(Number(booking.total_price))) {
    return Number(booking.total_price);
  }
  if (zimmer) {
    return calcBookingTotalForZimmer(zimmer, booking?.check_in, booking?.check_out, booking?.num_adults, booking?.num_children);
  }
  return calcBookingTotal(booking?.check_in, booking?.check_out, booking?.price_per_night);
}

export function formatILS(n) {
  const num = Math.round(Number(n) || 0);
  return `₪${num.toLocaleString('he-IL')}`;
}

// ---- Minimum nights rules (חמשוש / אמצ"ש / תמיד) ----
// zimmer.min_nights_rules: [{ scope: 'all'|'weekend'|'midweek', min_nights, start_date?, end_date?, label? }]
// A rule without dates applies always. Weekend = stay includes a Thu/Fri night.
// Mirrors server/src/lib/booking-price.js.

function civilDayOfWeek(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

function isWeekendNight(dateStr) {
  return WEEKEND_DAYS.has(civilDayOfWeek(dateStr));
}

function stayNightDates(checkIn, checkOut) {
  const nights = calcNights(checkIn, checkOut);
  const out = [];
  let t = Date.parse(`${checkIn}T00:00:00Z`);
  for (let i = 0; i < nights; i++) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86400000;
  }
  return out;
}

function ruleCoversDate(rule, dateStr) {
  if (rule.start_date && dateStr < rule.start_date) return false;
  if (rule.end_date && dateStr > rule.end_date) return false;
  return true;
}

function activeMinNightsRules(zimmer) {
  return (zimmer?.min_nights_rules || []).filter((r) => r && Number(r.min_nights) > 1);
}

function fmtShortDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-');
  return d && m && y ? `${d}/${m}/${y}` : String(dateStr);
}

function minNightsScopeText(scope) {
  if (scope === 'weekend') return 'בסופ"ש (חמשוש)';
  if (scope === 'midweek') return 'באמצע השבוע';
  return 'בצימר זה';
}

function minNightsPeriodText(rule) {
  if (!rule.start_date && !rule.end_date) return '';
  const range = rule.start_date && rule.end_date
    ? `בין ${fmtShortDate(rule.start_date)} ל-${fmtShortDate(rule.end_date)}`
    : rule.start_date
      ? `החל מ-${fmtShortDate(rule.start_date)}`
      : `עד ${fmtShortDate(rule.end_date)}`;
  return rule.label ? `${rule.label} (${range})` : range;
}

export const MIN_NIGHTS_SCOPE_LABELS = {
  all: 'כל הזמנה',
  weekend: 'סופ"ש (חמשוש)',
  midweek: 'אמצ"ש',
};

// Highest min_nights among rules that apply to this stay, or null.
export function getMinNightsRequirement(zimmer, checkIn, checkOut) {
  const rules = activeMinNightsRules(zimmer);
  if (!rules.length || !checkIn || !checkOut) return null;
  const nights = stayNightDates(checkIn, checkOut);
  if (!nights.length) return null;
  const stayHasWeekend = nights.some(isWeekendNight);
  let best = null;
  for (const rule of rules) {
    const covered = nights.filter((ds) => ruleCoversDate(rule, ds));
    if (!covered.length) continue;
    if (rule.scope === 'weekend' && !covered.some(isWeekendNight)) continue;
    if (rule.scope === 'midweek' && stayHasWeekend) continue;
    const required = Math.round(Number(rule.min_nights));
    if (!best || required > best.required) best = { required, rule };
  }
  return best;
}

export function checkMinNights(zimmer, checkIn, checkOut) {
  const nights = calcNights(checkIn, checkOut);
  const req = getMinNightsRequirement(zimmer, checkIn, checkOut);
  if (!req || nights >= req.required) {
    return { ok: true, required: req?.required ?? null, nights, message: '' };
  }
  const period = minNightsPeriodText(req.rule);
  const message = `${minNightsScopeText(req.rule.scope)}${period ? ` (${period})` : ''} ניתן להזמין מינימום ${req.required} לילות`;
  return { ok: false, required: req.required, nights, rule: req.rule, message };
}

// One Hebrew line per rule, for display.
export function listMinNightsRules(zimmer) {
  return activeMinNightsRules(zimmer).map((r) => {
    const scope = MIN_NIGHTS_SCOPE_LABELS[r.scope] || MIN_NIGHTS_SCOPE_LABELS.all;
    const period = minNightsPeriodText(r);
    return `${scope}: מינימום ${Math.round(Number(r.min_nights))} לילות${period ? ` (${period})` : ' (תמיד)'}`;
  });
}

// Short Hebrew description of all rules, for AI prompts. '' when none.
export function describeMinNightsRules(zimmer) {
  return listMinNightsRules(zimmer).join('; ');
}

// " | מינימום לילות: ..." for AI context lines, plus a warning when the searched stay is too short.
export function minNightsPromptNote(zimmer, checkIn, checkOut) {
  const rules = describeMinNightsRules(zimmer);
  if (!rules) return '';
  let out = ` | מינימום לילות: ${rules}`;
  if (checkIn && checkOut) {
    const res = checkMinNights(zimmer, checkIn, checkOut);
    if (!res.ok) out += ` | ⚠️ לא ניתן להזמין בתאריכים שנבחרו (${res.nights} לילות) — דורש מינימום ${res.required} לילות`;
  }
  return out;
}

export const MIN_NIGHTS_PROMPT_RULE = 'מינימום לילות: לצימר עם "מינימום לילות" (חמשוש = סופ"ש, שהייה שכוללת לילה של חמישי או שישי) אי אפשר להזמין שהייה קצרה יותר. אם מסומן ⚠️ לתאריכים שנבחרו — אמור זאת ללקוח בבירור והצע להאריך את השהייה (למשל חמישי עד שבת) או צימר אחר. כשהלקוח שואל על מינימום לילות — ענה לפי הנתון.';

// ---- Promotions (owner-defined weekly deals) ----
// Clamped to the allowed 30%–80% range.
export function clampDiscount(pct) {
  return Math.min(80, Math.max(30, Math.round(Number(pct) || 0)));
}

// Discounted total for the promo's own stay window. Uses the full nightly price
// (ignores partial per-person pricing) so the deal is a flat discount on the stay.
export function promoStayTotal(zimmer, promo, numAdults = 0, numChildren = 0) {
  const base = calcBookingTotalForZimmer(zimmer, promo?.check_in, promo?.check_out, numAdults, numChildren);
  return Math.round(base * (1 - clampDiscount(promo?.discount_percent) / 100));
}

export function promoOriginalPerNight(zimmer, promo) {
  const nights = calcNights(promo?.check_in, promo?.check_out);
  if (nights <= 0) return Number(zimmer?.price_per_night) || 0;
  return Math.round(calcBookingTotalForZimmer(zimmer, promo.check_in, promo.check_out, 0, 0) / nights);
}

export function promoDiscountedPerNight(zimmer, promo) {
  const nights = calcNights(promo?.check_in, promo?.check_out);
  if (nights <= 0) return 0;
  return Math.round(promoStayTotal(zimmer, promo, 0, 0) / nights);
}