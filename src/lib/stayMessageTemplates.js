// Keep in sync with server/src/lib/stay-message-templates.js (server substitutes the variables at send time).

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
  { token: '{{username}}', label: 'שם האורח' },
  { token: '{{check_in}}', label: "שעת צ'ק-אין" },
  { token: '{{check_out}}', label: "שעת צ'ק-אאוט" },
  { token: '{{address}}', label: 'כתובת' },
  { token: '{{nav_link}}', label: 'קישור ניווט' },
  { token: '{{entry_code}}', label: 'קוד כניסה' },
  { token: '{{key_location}}', label: 'מיקום מפתח' },
  { token: '{{zimmer_name}}', label: 'שם הצימר' },
  { token: '{{num_guests}}', label: 'מספר אורחים' },
];
