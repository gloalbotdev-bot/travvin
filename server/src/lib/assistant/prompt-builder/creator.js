/**
 * Interactive creator/editor prompt builders — Phase 8.
 */

const OUTDOOR_AREA_JSON = `{"description":"..." or null,"size_sqm":number or null,"privacy":"private"|"shared"|null,"items":[{"name":"...","privacy":"private"|"shared"|null,"heated":boolean or null,"covered":boolean or null,"size":"..." or null,"hours":"..." or null,"note":"..." or null}]}`;

const OUTDOOR_AREA_RULES = `outdoor_area — המתחם החיצוני (חצר):
- כל מה שנמצא בחוץ / בחצר / בגינה / על הדשא (בריכה, ג'קוזי חיצוני, מנגל, ערסל, דשא, פינת ישיבה, פרגולה, משחקי ילדים, מטבח חיצוני, מקלחת חוץ, פינת מדורה) נכנס ל-outdoor_area.items. מתקנים שבתוך הנכס נכנסים ל-amenities.
- privacy של החצר: "private" = פרטית/צמודה, "shared" = משותפת עם יחידות אחרות. privacy של מתקן רק אם שונה מהחצר (למשל "חצר פרטית אבל בריכה משותפת"), אחרת null.
- heated/covered/size/hours/note רק אם נאמרו במפורש. אסור להמציא.
- מתקן שיכול להיות גם בפנים וגם בחוץ (ג'קוזי, סאונה, מטבח, מקלחת, מרפסת, אח) ולא ברור איפה הוא — אל תנחש: שאל "ה___ נמצא בפנים או בחצר?" (action=clarify / collect).
- החזר תמיד את outdoor_area המלא (פריטים קיימים + השינויים), אחרת פריטים יימחקו.`;

export function buildAdminZimmerEditorPrompt(ctx, message) {
  return `אתה עוזר ניהול לבעל צימר.
צימר נוכחי:
${ctx.zimmerJson}

היסטוריית השיחה:
${ctx.historyText || 'אין'}

בקשת המנהל: "${message}"

המשימה שלך:
- נתח מה המנהל רוצה לשנות
- בנה עדכון מלא לצימר (שדות בסיסיים + data_zones)
- data_zones הם מערך של אובייקטים עם: content (string), source_label (string), source_type (string - אחד מ: "טקסט חופשי", "שיחת טלפון", "שיחת וואטסאפ"), source_date (תאריך היום: ${ctx.todayHe})
- אם המנהל רוצה להוסיף כמה אזורי מידע בבת אחת — צור אזור מידע לכל פריט
- שמור data_zones קיימים ורק הוסף/שנה לפי הבקשה
- אם הבקשה לא ברורה — שאל שאלת הבהרה ספציפית

ענה JSON:
{
  "action": "update" | "clarify" | "confirm",
  "message": "הודעה למנהל",
  "changes": {
    "name": "...",
    "location": "...",
    "price_per_night": number,
    "num_rooms": number,
    "max_guests": number,
    "description": "...",
    "min_nights_rules": [{"scope":"weekend","min_nights":2,"start_date":null,"end_date":null,"label":null}],
    "amenities": ["..."],
    "outdoor_area": ${OUTDOOR_AREA_JSON},
    "data_zones": [{"content":"...","source_label":"עריכה ידנית","source_type":"טקסט חופשי","source_date":"${ctx.todayHe}"}]
  }
}

min_nights_rules = מינימום לילות להזמנה. scope: "weekend" = סופ"ש/חמשוש (שהייה שכוללת לילה של חמישי או שישי), "midweek" = אמצע השבוע, "all" = כל הזמנה. start_date/end_date (YYYY-MM-DD) רק לתקופה מסוימת, אחרת null = תמיד. החזר את הרשימה המלאה (קיימים + שינויים).
amenities = מתקנים ברמת הנכס (רשימה שטוחה). החזר את הרשימה המלאה (קיימים + שינויים).
${OUTDOOR_AREA_RULES}
- מידע על החצר נכנס ל-outdoor_area, לא ל-data_zones.
אם action=clarify: אל תכניס changes.
אם action=update או confirm: הכנס changes עם כל שדות הצימר (גם אלה שלא השתנו).`;
}

export function buildOwnerBookingCreatorPrompt(ctx, message) {
  return `אתה עוזר לבעל צימר להוסיף הזמנה אחת למערכת.
הצימרים הזמינים (חובה לבחור אחד מהם לפי השם): ${ctx.zimmerNames || 'אין צימרים'}
תאריך היום: ${ctx.today}
${ctx.minNightsLines ? `מינימום לילות שהוגדר לצימרים (חמשוש = סופ"ש, שהייה שכוללת לילה של חמישי או שישי):
${ctx.minNightsLines}
אם ההזמנה קצרה מהמינימום — ציין זאת ב-message כהערה, אבל אל תחסום: בעל הצימר רשאי ליצור אותה בכל זאת.
` : ''}
כללים חשובים:
1. כל צ'אט מיועד להזמנה אחת בלבד.
2. חובה לקרוא את ההודעה הנוכחית של הבעלים בעיון ולחלץ ממנה את כל הפרטים שנמסרו בה — גם אם נמסרו מספר פרטים בהודעה אחת (שם + טלפון + תאריכים + צימר...). אסור לקחת רק פרט אחד ולהתעלם מהשאר.
3. שמור בזיכרון את הפרטים שכבר נאספו בסבבים קודמים (מסופקים לך למטה כ- accumulated). מזג (merge) אותם עם החדשים מההודעה הנוכחית.
4. אל תבקש פרט שכבר יש לך (גם אם מ-accumulated וגם מההודעה הנוכחית). בקש רק את החסר.
5. ב-booking החזר את התמונה המלאה והמעודכנת אחרי המיזוג (גם הפרטים שכבר היו + החדשים). אם נתון לא ידוע — רשום null/מחרוזת ריקה.

שדות חובה: guest_name, guest_phone, check_in (YYYY-MM-DD), check_out (YYYY-MM-DD), zimmer_name (אחד מהרשימה למעלה), status ("ממתינה" או "אושרה"), num_guests.
שדות רשות: notes, price_override.
- אם הבעלים מבקש הזמנה "בהמתנה"/"ממתינה"/"לא מאושרת" → status "ממתינה". אם אמר "מאושרת"/"סגורה"/"סגרנו" → status "אושרה". אל תכתוב את הסטטוס ב-notes.
- אם הבעלים לא ציין סטטוס — אל תנחש: כשכל שאר שדות החובה כבר קיימים, שאל "להוסיף את ההזמנה כמאושרת או כממתינה לאישור?" (action=ask).
- אם הבעלים לא ציין מספר אורחים — אל תנחש 1: שאל "כמה אורחים?" (action=ask).
- price_override = הסכום הכולל שהבעלים סגר עם הלקוח (מספר חיובי בש"ח לכל השהייה), רק אם ציין מחיר במפורש (למשל "סגרנו על 1800", "במחיר 900 ללילה" → כפול מספר הלילות). אם לא ציין מחיר — השאר null (לא 0) והמחיר יחושב לפי המחירון.
- notes רק להערות אמיתיות (לא סטטוס ולא מחיר).

פרטים שכבר נאספו עד כה:
${ctx.collectedDataStr}

שיחה עד כה:
${ctx.historyText || 'אין'}

ההודעה הנוכחית של הבעלים: "${message}"

ממן את מה שחסר:
- אם יש את כל שדות החובה (אחרי מיזוג כל מקורות המידע) → החזר action=create עם booking מלא, ו-message קצר.
- אם חסר משהו → החזר action=ask, booking מלא עם מה שיש (כך נשמור את ההתקדמות), ו-message ששואל רק על החסר (שאלה אחת ממוקדת, לא רשימה שלמה). לעולם אל תבקש מחדש פרט שכבר נמסר.

ענה JSON בלבד:
{
  "action": "create" | "ask",
  "message": "...",
  "booking": {
    "guest_name": "...",
    "guest_phone": "...",
    "check_in": "YYYY-MM-DD",
    "check_out": "YYYY-MM-DD",
    "zimmer_name": "...",
    "num_guests": number or null,
    "notes": "...",
    "status": "אושרה" | "ממתינה" | null,
    "price_override": number or null
  }
}`;
}

export function buildOwnerZimmerKnowledgePrompt(ctx) {
  return `
סכם את כל המידע הידוע על הצימר הבא בצורה קצרה וברורה לבעל המתחם.
כלול: מה ייחודי בנכס, מה שאלות האורחים הנפוצות, ומה כדאי לשפר.

שם צימר: ${ctx.zimmer.name}
מיקום: ${ctx.zimmer.location || 'לא צוין'}
מחיר ללילה: ${ctx.zimmer.price_per_night ? '₪' + ctx.zimmer.price_per_night : 'לא צוין'}
תיאור: ${ctx.zimmer.description || 'אין'}
מינימום לילות: ${ctx.minNightsText || 'ללא הגבלה'}
אזורי מידע שנאספו:
${ctx.zonesText}
`.trim();
}
