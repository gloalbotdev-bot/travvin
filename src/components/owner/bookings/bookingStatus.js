// Shared booking-status helpers for the bookings page (Figma redesign).

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export function isToday(iso) {
  return !!iso && startOfDay(iso).getTime() === startOfDay(new Date()).getTime();
}

export function isUpcoming(b) {
  return b.status === 'אושרה' && !b.checked_out && startOfDay(b.check_in) > startOfDay(new Date());
}

export function isActive(b) {
  if (b.status !== 'אושרה' || b.checked_out) return false;
  const today = startOfDay(new Date());
  return startOfDay(b.check_in) <= today && startOfDay(b.check_out) >= today;
}

export function isPast(b) {
  return startOfDay(b.check_out) < startOfDay(new Date());
}

export function needsAttention(b) {
  return b.status === 'ממתינה' || !!b.cancel_request_reason;
}

// Map a booking to the colored status pill shown in the Figma.
export function statusDisplay(booking) {
  if (booking.status === 'ממתינה') return { label: 'דורש טיפול', bg: '#FFF8E1', color: '#92400E', dot: '#F59E0B' };
  if (booking.status === 'נדחתה') return { label: 'נדחתה', bg: '#FFEBEE', color: '#C62828', dot: '#EF4444' };
  if (booking.status === 'חסום') return { label: 'חסום', bg: '#ECEFF1', color: '#455A64', dot: '#607D8B' };
  if (booking.checked_out) return { label: 'הסתיימה', bg: '#E8F5E9', color: '#2E7D32', dot: '#4CAF50' };
  if (isActive(booking)) return { label: 'כרגע בנכס', bg: '#E8F5E9', color: '#2E7D32', dot: '#4CAF50' };
  if (isUpcoming(booking)) return { label: 'מגיעים בקרוב', bg: '#E8F5E9', color: '#2E7D32', dot: '#4CAF50' };
  return { label: 'הזמנה מאושרת', bg: '#E8F5E9', color: '#2E7D32', dot: '#4CAF50' };
}

// Nights count for "משך שהייה".
export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.round((startOfDay(checkOut) - startOfDay(checkIn)) / 86400000);
}

// Format a date range like "20 באוג' – 10 בספט'".
const HEB_MONTHS_SHORT = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
export function formatRange(checkIn, checkOut) {
  const fmt = (iso) => {
    const d = new Date(iso);
    return `${d.getDate()} ב${HEB_MONTHS_SHORT[d.getMonth()]}`;
  };
  return `${fmt(checkIn)} – ${fmt(checkOut)}`;
}