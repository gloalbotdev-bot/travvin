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

function seasonalMultiplierForDate(seasonalPricing, dateStr) {
  for (const rule of seasonalPricing || []) {
    if (rule.start_date && rule.end_date && dateStr >= rule.start_date && dateStr <= rule.end_date) {
      const pct = clampPercentage(rule.adjustment, rule.percentage);
      return rule.adjustment === 'decrease' ? (1 - pct / 100) : (1 + pct / 100);
    }
  }
  return 1;
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
  const day = new Date(dateStr + 'T00:00:00').getUTCDay();
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