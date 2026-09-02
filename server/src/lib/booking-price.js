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

function seasonalMultiplierForDate(seasonalPricing, dateStr) {
  for (const rule of seasonalPricing || []) {
    if (rule.start_date && rule.end_date && dateStr >= rule.start_date && dateStr <= rule.end_date) {
      const pct = clampPercentage(rule.adjustment, rule.percentage);
      return rule.adjustment === 'decrease' ? 1 - pct / 100 : 1 + pct / 100;
    }
  }
  return 1;
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

export function formatILS(n) {
  const num = Math.round(Number(n) || 0);
  return `₪${num.toLocaleString('he-IL')}`;
}
