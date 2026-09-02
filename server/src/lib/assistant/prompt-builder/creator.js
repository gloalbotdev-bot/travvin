/**
 * Interactive creator/editor prompt builders — Phase 8.
 */

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
    "data_zones": [{"content":"...","source_label":"עריכה ידנית","source_type":"טקסט חופשי","source_date":"${ctx.todayHe}"}]
  }
}

אם action=clarify: אל תכניס changes.
אם action=update או confirm: הכנס changes עם כל שדות הצימר (גם אלה שלא השתנו).`;
}

export function buildOwnerBookingCreatorPrompt(ctx, message) {
  return `אתה עוזר לבעל צימר להוסיף הזמנה אחת למערכת.
הצימרים הזמינים (חובה לבחור אחד מהם לפי השם): ${ctx.zimmerNames || 'אין צימרים'}
תאריך היום: ${ctx.today}

כללים חשובים:
1. כל צ'אט מיועד להזמנה אחת בלבד.
2. חובה לקרוא את ההודעה הנוכחית של הבעלים בעיון ולחלץ ממנה את כל הפרטים שנמסרו בה — גם אם נמסרו מספר פרטים בהודעה אחת (שם + טלפון + תאריכים + צימר...). אסור לקחת רק פרט אחד ולהתעלם מהשאר.
3. שמור בזיכרון את הפרטים שכבר נאספו בסבבים קודמים (מסופקים לך למטה כ- accumulated). מזג (merge) אותם עם החדשים מההודעה הנוכחית.
4. אל תבקש פרט שכבר יש לך (גם אם מ-accumulated וגם מההודעה הנוכחית). בקש רק את החסר.
5. ב-booking החזר את התמונה המלאה והמעודכנת אחרי המיזוג (גם הפרטים שכבר היו + החדשים). אם נתון לא ידוע — רשום null/מחרוזת ריקה.

שדות חובה: guest_name, guest_phone, check_in (YYYY-MM-DD), check_out (YYYY-MM-DD), zimmer_name (אחד מהרשימה למעלה).
שדות רשות: num_guests, notes, status ("ממתינה" או "אושרה").
- אם הבעלים מבקש הזמנה "בהמתנה"/"ממתינה"/"לא מאושרת" → status חייב להיות "ממתינה". אל תכתוב את זה ב-notes.
- אם לא צוין אחרת → status "אושרה".
- notes רק להערות אמיתיות (לא סטטוס).

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
    "notes": "..."
  }
}`;
}

export function buildOwnerZimmerCreatorPrompt(ctx, message) {
  return `אתה עוזר לבעל צימר ליצור את פרופיל הצימר שלו במערכת.
היסטוריית השיחה:
${ctx.historyText || 'אין'}

הודעה נוכחית: "${message}"

נתונים שנאספו עד כה: ${ctx.conversationDataStr}
תמונות שהועלו: ${ctx.uploadedImageCount}

המשימה שלך:
1. עדכן/השלם את נתוני הצימר לפי ההודעה החדשה
2. אם יש מספיק נתונים (לפחות שם), הצע לסכם ולבנות
3. אם חסר מידע חשוב — שאל שאלה ספציפית אחת
4. אם הבעל אומר "בנה", "סיים", "אוקיי", "תן לי לראות", "יצור" — עבור למצב BUILD

ענה JSON בלבד:
{
  "action": "collect" | "build",
  "message": "...",
  "zimmer_data": {
    "name": "...",
    "location": "...",
    "price_per_night": number or null,
    "weekday_price": number or null,
    "weekend_price": number or null,
    "num_rooms": number or null,
    "max_guests": number or null,
    "description": "...",
    "data_zones": []
  }
}

אם action=build, מלא את zimmer_data בצורה מלאה ומפורטת לפי כל מה שנאמר בשיחה.
חובה לבקש מהבעל מחיר נפרד לאמצע השבוע (א'-ה', weekday_price) ולסוף השבוע (ה'-ש', weekend_price). אם הבעל נתן רק מחיר אחד ולא ציין חלוקה — הגדר את אותו מחיר גם ל-weekday_price וגם ל-weekend_price (ול-price_per_night). אף פעם אל תשאיר את שניהם null כשיש מחיר כלשהו.
ה-description צריך להיות תיאור מפנה ומושך.
ה-data_zones צריכים לכלול מידע ייחודי שנאמר בשיחה (כגון: מדיניות ביטול, חיות מחמד, ציוד מיוחד וכו').`;
}

export function buildOwnerZimmerKnowledgePrompt(ctx) {
  return `
סכם את כל המידע הידוע על הצימר הבא בצורה קצרה וברורה לבעל המתחם.
כלול: מה ייחודי בנכס, מה שאלות האורחים הנפוצות, ומה כדאי לשפר.

שם צימר: ${ctx.zimmer.name}
מיקום: ${ctx.zimmer.location || 'לא צוין'}
מחיר ללילה: ${ctx.zimmer.price_per_night ? '₪' + ctx.zimmer.price_per_night : 'לא צוין'}
תיאור: ${ctx.zimmer.description || 'אין'}
אזורי מידע שנאספו:
${ctx.zonesText}
`.trim();
}
