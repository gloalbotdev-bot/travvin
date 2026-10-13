import { getBookingTotal } from '@/lib/bookingPrice';

const isBlock = (b) => b.is_block || b.status === 'חסום';

const pad = (n) => String(n).padStart(2, '0');

const monthBounds = (year, month) => ({
  first: `${year}-${pad(month + 1)}-01`,
  end: month === 11 ? `${year + 1}-01-01` : `${year}-${pad(month + 2)}-01`,
  days: new Date(year, month + 1, 0).getDate(),
});

const prevMonth = (year, month) => (month === 0 ? [year - 1, 11] : [year, month - 1]);

const isApproved = (b) => b.status === 'אושרה' && !isBlock(b) && b.check_in && b.check_out;

/** Approved (non-block) nights that fall inside one calendar month. */
export function monthBookedNights(bookings, year, month) {
  const { first, end } = monthBounds(year, month);
  let booked = 0;
  for (const b of bookings || []) {
    if (!isApproved(b)) continue;
    const from = b.check_in > first ? b.check_in : first;
    const to = b.check_out < end ? b.check_out : end;
    if (to <= from) continue;
    booked += Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);
  }
  return booked;
}

/** Booked nights / available nights for one calendar month. Returns 0–100 or null when no units. */
export function monthOccupancy(bookings, unitCount, year, month) {
  if (!unitCount) return null;
  const { days } = monthBounds(year, month);
  return Math.min(100, Math.round((monthBookedNights(bookings, year, month) / (unitCount * days)) * 100));
}

/** Total of approved bookings whose check-in falls in the month. */
export function monthRevenue(bookings, zimmers, year, month) {
  const { first, end } = monthBounds(year, month);
  let sum = 0;
  for (const b of bookings || []) {
    if (!isApproved(b) || b.check_in < first || b.check_in >= end) continue;
    sum += getBookingTotal(b, (zimmers || []).find((z) => z.id === b.zimmer_id)) || 0;
  }
  return Math.round(sum);
}

/** Current-month occupancy plus the change (percentage points) vs the previous month. */
export function occupancySummary(bookings, unitCount, date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const current = monthOccupancy(bookings, unitCount, y, m);
  const prev = monthOccupancy(bookings, unitCount, ...prevMonth(y, m));
  return { current, delta: current == null || prev == null ? null : current - prev };
}

/** Occupancy %, revenue ₪ and booked nights for the current month, each with its change vs last month. */
export function monthStats(bookings, zimmers, unitCount, date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const [py, pm] = prevMonth(y, m);
  const occupancy = occupancySummary(bookings, unitCount, date);
  const revenue = monthRevenue(bookings, zimmers, y, m);
  const nights = monthBookedNights(bookings, y, m);
  return {
    occupancy,
    revenue: { current: revenue, delta: revenue - monthRevenue(bookings, zimmers, py, pm) },
    nights: { current: nights, delta: nights - monthBookedNights(bookings, py, pm) },
  };
}

/** Unbooked, unblocked nights from `fromIso` to the end of that month, summed across units. */
export function freeNightsLeft(bookings, unitIds, fromIso) {
  const [y, m, d] = fromIso.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  let free = 0;
  for (let day = d; day <= days; day += 1) {
    const iso = `${y}-${pad(m)}-${pad(day)}`;
    for (const id of unitIds) {
      const taken = (bookings || []).some((b) => b.zimmer_id === id && b.status !== 'נדחית' && b.check_in <= iso && b.check_out > iso);
      if (!taken) free += 1;
    }
  }
  return free;
}
