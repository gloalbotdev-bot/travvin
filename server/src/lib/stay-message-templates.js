/**
 * Default customer stay-message templates + {{variable}} substitution.
 * Keep DEFAULT_TEMPLATES / TEMPLATE_VARIABLES in sync with src/lib/stayMessageTemplates.js.
 */

export const TIME_NOT_SET = 'לא הוגדרה';

export const DEFAULT_TEMPLATES = {
  pre_checkin:
    "שלום {{username}}, מחכים לכם מחר! 🌟\nשעת הצ'ק-אין: {{check_in}}. מצורפים פרטי ההגעה והניווט. נסיעה טובה ובטוחה!",
  checkin_day:
    "בוקר טוב {{username}}! ☀️\nהחופשה שלכם מתחילה היום. שעת הצ'ק-אין: {{check_in}}. עד שתגיעו, הכנו לכם כמה המלצות מעולות למקומות, מסעדות ואטרקציות בסביבה.",
  checkin:
    'ברוכים הבאים {{username}}!\nשתהיה לכם שהייה נעימה ומהנה. נשמח שתאשרו שהכל תקין, ואם חסר לכם משהו – אנחנו זמינים עבורכם.',
  post_checkin:
    '{{username}}, מקווים שהתארגנתם בכיף!\nרק רצינו להזכיר שאנחנו כאן לכל שאלה או בקשה. שיהיה המשך שהייה קסומה!',
  morning_checkout:
    "בוקר טוב {{username}}, מקווים שנהניתם! 🌿\nתזכורת קלה: שעת הצ'ק-אאוט היום: {{check_out}}. מצורפות הנחיות קצרות לקראת היציאה.",
  pre_checkout:
    "{{username}}, תודה רבה שהתארחתם אצלנו!\nתזכורת ידידותית: שעת העזיבה מתקרבת (שעת הצ'ק-אאוט: {{check_out}}). נשמח לראותכם שוב בעתיד!",
};

export const TEMPLATE_VARIABLES = [
  'username',
  'check_in',
  'check_out',
  'checkin_time',
  'checkout_time',
  'address',
  'nav_link',
  'entry_code',
  'key_location',
  'zimmer_name',
  'num_guests',
];

/**
 * @param {Record<string, any>} stay zimmer.stay_settings
 * @param {Record<string, any>} booking
 * @param {string} guestName
 */
export function buildStayVars(stay, booking, guestName) {
  const s = stay || {};
  const b = booking || {};
  const checkIn = s.checkin_time || TIME_NOT_SET;
  const checkOut = s.checkout_time || TIME_NOT_SET;
  const guests = b.num_guests ?? b.num_adults;
  return {
    username: guestName || '',
    check_in: checkIn,
    check_out: checkOut,
    checkin_time: checkIn,
    checkout_time: checkOut,
    address: s.address || '',
    nav_link: s.nav_link || '',
    entry_code: s.entry_code || '',
    key_location: s.key_location || '',
    zimmer_name: b.zimmer_name || '',
    num_guests: guests != null && guests !== '' ? String(guests) : '',
  };
}

/** Tokens not in TEMPLATE_VARIABLES are dropped so raw `{{...}}` never reaches a guest. */
export function substituteVars(text, vars) {
  if (!text) return '';
  const out = String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k] ?? '') : '',
  );
  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+([,!.?])/g, '$1').replace(/[ \t]{2,}/g, ' ').replace(/^[\s,]+/, ''))
    .join('\n')
    .trim();
}

/** True when the template already places this variable (or its alias) in the text. */
export function templateUses(text, ...keys) {
  const t = String(text || '');
  return keys.some((k) => new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`).test(t));
}
