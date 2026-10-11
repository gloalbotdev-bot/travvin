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

const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const dayMonth = (iso) => { const d = new Date(iso); return `${d.getDate()} ב${HEB_MONTHS[d.getMonth()]}`; };
const daysFromToday = (iso) => Math.round((startOfDay(iso) - startOfDay(new Date())) / 86400000);

// Desktop status badge + secondary line (Figma 1776:19992).
export function figmaStatus(booking) {
  const YELLOW = '#FFFF00';
  const CYAN = '#D9F3F9';
  const GRAY = '#EFEFEF';
  const cancelNote = booking.cancel_request_reason ? 'התקבלה בקשת ביטול' : '';

  if (booking.status === 'חסום' || booking.is_block) return { label: 'חסום', bg: GRAY, sub: booking.block_reason || '' };
  if (booking.status === 'ממתינה') return { label: 'ממתינה לאישור', bg: YELLOW, sub: cancelNote };
  if (booking.status === 'נדחתה') return { label: 'בוטלה', bg: GRAY, sub: 'התאריכים חזרו להיות פנויים' };
  if (booking.checked_out || isPast(booking)) return { label: 'הסתיימה', bg: GRAY, sub: '' };
  if (isToday(booking.check_in)) {
    return { label: 'צ’ק אין להיום', bg: YELLOW, sub: cancelNote || (booking.check_in_time ? `מגיעים ב־${booking.check_in_time}` : 'מגיעים היום') };
  }
  if (isActive(booking)) {
    const left = daysFromToday(booking.check_out);
    const sub = left <= 0 ? 'עוזבים היום' : left === 1 ? 'עוזבים מחר' : `עוזבים ב־${dayMonth(booking.check_out)}`;
    return { label: 'מתארחים עכשיו', bg: CYAN, sub: cancelNote || sub };
  }
  const until = daysFromToday(booking.check_in);
  const sub = until === 1 ? 'מגיעים מחר' : `מגיעים בעוד ${until} ימים`;
  return { label: 'מאושרת', bg: GRAY, sub: cancelNote || sub };
}

// "15–17 באוגוסט" or "30 ביולי – 2 באוגוסט".
export function formatRangeLong(checkIn, checkOut) {
  if (!checkIn || !checkOut) return '';
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}–${b.getDate()} ב${HEB_MONTHS[b.getMonth()]}`;
  }
  return `${dayMonth(checkIn)} – ${dayMonth(checkOut)}`;
}

export function nightsLabel(n) {
  return n === 1 ? 'לילה אחד' : `${n} לילות`;
}

export function guestsLabel(n) {
  return n === 1 ? 'אורח אחד' : `${n} אורחים`;
}

// True when no approved booking covers the coming Friday→Saturday.
export function isNextWeekendFree(bookings) {
  const fri = new Date();
  fri.setDate(fri.getDate() + ((5 - fri.getDay() + 7) % 7 || 7));
  const sat = new Date(fri); sat.setDate(sat.getDate() + 1);
  return !bookings.some(b => b.status === 'אושרה' && new Date(b.check_in) <= fri && new Date(b.check_out) >= sat);
}

export function bookingNumber(booking) {
  return String(booking.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
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