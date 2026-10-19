/**
 * Booking price helpers (M15 #10 #21) — Asia/Jerusalem weekday/weekend.
 * Mirrors src/lib/bookingPrice.js with timezone-safe day-of-week.
 */

const WEEKEND_DAYS = new Set([4, 5]); // Thu, Fri nights

/** 0=Sun … 6=Sat for civil date YYYY-MM-DD in Asia/Jerusalem */
export function getDayOfWeekIsrael(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  // Noon UTC keeps the Jerusalem calendar date aligned for IL offsets (+2/+3)
  const utc = new Date(`${dateStr}T12:00:00.000Z`);
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
  }).format(utc);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

export function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const nights = Math.ceil((b - a) / 86400000);
  return Math.max(0, nights);
}

export function addDaysIso(dateStr, n) {
  const a = Date.parse(`${dateStr}T00:00:00Z`);
  if (!Number.isFinite(a)) return dateStr;
  return new Date(a + n * 86400000).toISOString().slice(0, 10);
}

export function clampPercentage(adjustment, pct) {
  const p = Math.max(0, Number(pct) || 0);
  if (adjustment === 'decrease') return Math.min(75, p);
  return Math.min(100, p);
}

export function clampDiscount(pct) {
  return Math.min(80, Math.max(30, Math.round(Number(pct) || 0)));
}

function seasonalRuleForDate(seasonalPricing, dateStr) {
  for (const rule of seasonalPricing || []) {
    if (rule.start_date && rule.end_date && dateStr >= rule.start_date && dateStr <= rule.end_date) {
      return rule;
    }
  }
  return null;
}

function seasonalMultiplierForDate(seasonalPricing, dateStr) {
  const rule = seasonalRuleForDate(seasonalPricing, dateStr);
  if (!rule) return 1;
  const pct = clampPercentage(rule.adjustment, rule.percentage);
  return rule.adjustment === 'decrease' ? 1 - pct / 100 : 1 + pct / 100;
}

function weekdayOrWeekendPrice(zimmer, dateStr) {
  const base = Number(zimmer?.price_per_night) || 0;
  if (!dateStr) return base;
  const isWeekend = WEEKEND_DAYS.has(getDayOfWeekIsrael(dateStr));
  return isWeekend
    ? zimmer?.weekend_price != null
      ? Number(zimmer.weekend_price)
      : base
    : zimmer?.weekday_price != null
      ? Number(zimmer.weekday_price)
      : base;
}

export function basePricePerNight(zimmer, numAdults = 0, numChildren = 0, dateStr = null) {
  const total = (Number(numAdults) || 0) + (Number(numChildren) || 0);
  const max = Number(zimmer?.max_guests) || 0;
  const min = Number(zimmer?.min_guests) || 0;
  if (
    total > 0 &&
    zimmer?.partial_pricing_enabled &&
    zimmer.price_per_adult != null &&
    total < max &&
    total >= min
  ) {
    return (
      (Number(numAdults) || 0) * (Number(zimmer.price_per_adult) || 0) +
      (Number(numChildren) || 0) * (Number(zimmer.price_per_child) || 0)
    );
  }
  return weekdayOrWeekendPrice(zimmer, dateStr);
}

export function effectivePricePerNight(zimmer, dateStr, numAdults = 0, numChildren = 0) {
  const base = basePricePerNight(zimmer, numAdults, numChildren, dateStr);
  const rule = seasonalRuleForDate(zimmer?.seasonal_pricing, dateStr);
  if (!rule) return Math.round(base);
  // Absolute price for the date window overrides percentages (mirrors src/lib/bookingPrice.js).
  if (rule.price_per_night != null && rule.price_per_night !== '' && !Number.isNaN(Number(rule.price_per_night))) {
    return Math.round(Number(rule.price_per_night));
  }
  return Math.round(base * seasonalMultiplierForDate(zimmer?.seasonal_pricing, dateStr));
}

export function calcBookingTotalForZimmer(
  zimmer,
  checkIn,
  checkOut,
  numAdults = 0,
  numChildren = 0,
) {
  const nights = calcNights(checkIn, checkOut);
  if (nights <= 0) return 0;
  let total = 0;
  let ds = checkIn;
  for (let i = 0; i < nights; i++) {
    total += effectivePricePerNight(zimmer, ds, numAdults, numChildren);
    ds = addDaysIso(ds, 1);
  }
  return total;
}

export function datesOverlap(aIn, aOut, bIn, bOut) {
  if (!aIn || !aOut || !bIn || !bOut) return false;
  return aIn < bOut && aOut > bIn;
}

export function isPartialPricing(zimmer, numAdults = 0, numChildren = 0) {
  const total = (Number(numAdults) || 0) + (Number(numChildren) || 0);
  const max = Number(zimmer?.max_guests) || 0;
  const min = Number(zimmer?.min_guests) || 0;
  return !!(
    total > 0 &&
    zimmer?.partial_pricing_enabled &&
    zimmer.price_per_adult != null &&
    total < max &&
    total >= min
  );
}

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

// ---- Minimum nights rules (חמשוש / אמצ"ש / תמיד) ----
// zimmer.min_nights_rules: [{ scope: 'all'|'weekend'|'midweek', min_nights, start_date?, end_date?, label? }]
// A rule without dates applies always. Weekend = stay includes a Thu/Fri night.
// Mirrored in src/lib/bookingPrice.js.

function isWeekendNight(dateStr) {
  return WEEKEND_DAYS.has(getDayOfWeekIsrael(dateStr));
}

function stayNightDates(checkIn, checkOut) {
  const nights = calcNights(checkIn, checkOut);
  const out = [];
  let ds = checkIn;
  for (let i = 0; i < nights; i++) {
    out.push(ds);
    ds = addDaysIso(ds, 1);
  }
  return out;
}

function ruleCoversDate(rule, dateStr) {
  if (rule.start_date && dateStr < rule.start_date) return false;
  if (rule.end_date && dateStr > rule.end_date) return false;
  return true;
}

function activeMinNightsRules(zimmer) {
  return (Array.isArray(zimmer?.min_nights_rules) ? zimmer.min_nights_rules : []).filter(
    (r) => r && Number(r.min_nights) > 1,
  );
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
  const range =
    rule.start_date && rule.end_date
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

/** Highest min_nights among rules that apply to this stay, or null. */
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

/** Short Hebrew description of all rules, for display and AI prompts. '' when none. */
export function describeMinNightsRules(zimmer) {
  return activeMinNightsRules(zimmer)
    .map((r) => {
      const scope = MIN_NIGHTS_SCOPE_LABELS[r.scope] || MIN_NIGHTS_SCOPE_LABELS.all;
      const period = minNightsPeriodText(r);
      return `${scope}: מינימום ${Math.round(Number(r.min_nights))} לילות${period ? ` (${period})` : ' (תמיד)'}`;
    })
    .join('; ');
}

export function formatILS(n) {
  const num = Math.round(Number(n) || 0);
  return `₪${num.toLocaleString('he-IL')}`;
}
