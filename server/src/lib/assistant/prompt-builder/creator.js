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

/** Mirrors src/lib/rooms.js AMBIGUOUS_PLACEMENT. */
const AMBIGUOUS_PLACEMENT = ["ג'קוזי", 'סאונה', 'מטבח', 'מקלחת', 'מרפסת', 'אח'];

export function buildOwnerZimmerCreatorPrompt(ctx, message) {
  const customTypesLine = ctx.customBedTypes?.length
    ? `\n- סוגי מיטה שהבעל כבר הגדיר בצימרים אחרים (השתמש באותו custom_label ו-sleeps אם הוא מזכיר אותם): ${ctx.customBedTypes.map((t) => `${t.custom_label}${t.sleeps ? ` (${t.sleeps} ישנים)` : ''}`).join(', ')}.`
    : '';

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
    "max_guests_event": number or null,
    "description": "...",
    "data_zones": [],
    "contact_phone": "...",
    "expose_availability_calendar": boolean,
    "additional_bathrooms_count": number,
    "min_nights_rules": [
      { "scope": "weekend|midweek|all", "min_nights": number, "start_date": "YYYY-MM-DD" or null, "end_date": "YYYY-MM-DD" or null, "label": "..." or null }
    ],
    "rooms_detail": [
      { "room_name": "...", "beds": [{"bed_type": "king|queen|single|bunk|sofa_bed|mattress|other", "count": number, "sleeps": number or null, "custom_label": "..." or null}], "has_bathroom": boolean, "amenities": ["..."] }
    ],
    "outdoor_area": ${OUTDOOR_AREA_JSON},
    "unclear_placement": ["..."]
  }
}

אם action=build, מלא את zimmer_data בצורה מלאה ומפורטת לפי כל מה שנאמר בשיחה.
חובה לבקש מהבעל מחיר נפרד לאמצע השבוע (א'-ה', weekday_price) ולסוף השבוע (ה'-ש', weekend_price). אם הבעל נתן רק מחיר אחד ולא ציין חלוקה — הגדר את אותו מחיר גם ל-weekday_price וגם ל-weekend_price (ול-price_per_night). אף פעם אל תשאיר את שניהם null כשיש מחיר כלשהו.
min_nights_rules — מינימום לילות להזמנה. אחרי המחירים מותר לשאול פעם אחת: "יש מינימום לילות להזמנה? למשל חמשוש — מינימום 2 לילות בסופ"ש". scope: weekend = סופ"ש/חמשוש (שהייה שכוללת לילה של חמישי או שישי), midweek = אמצע השבוע, all = כל הזמנה. start_date/end_date רק אם הבעל ציין תקופה מסוימת (למשל "בקיץ" / "ביולי-אוגוסט"), אחרת null = תמיד. אם הבעל לא ציין — החזר [].
ה-description צריך להיות ניסוח מחדש קצר ומושך של מה שהבעל אמר בפועל בלבד. אסור להמציא תכונות, מתקנים או נתונים שהבעל לא ציין. אם הבעל לא אמר "בריכה" — אל תכתוב בריכה. ציין רק עובדות.
max_guests = כמות האורחים שיישנים בפועל (מקומות שינה). שים לב: מיטה זוגית/מלכותית היא מיטה אחת שמתאימה ל-2 אורחים.
max_guests_event = כמות האורחים שניתן לארח באירוע/אירוע יוקרתי במקום, רק אם הבעל ציין. אחרת null.
ה-data_zones צריכים לכלול מידע ייחודי שנאמר בשיחה (כגון: מדיניות ביטול, חיות מחמד, ציוד מיוחד וכו').
contact_phone: טלפון/וואטסאפ ליצירת קשר אם הבעל ציין. אחרת null.
expose_availability_calendar: נאות רק אם הבעל אמר במפורש שרוצה לחשוף יומן זמינות ללקוחות. ברירת מחדל false.
rooms_detail — כללים מחייבים:
- אם הבעל ציין מספר חדרים (num_rooms) — בנה בדיוק מספר כזה של חדרים. אם לא ציין — בנה רק חדרים שהוזכרו בטקסט.
- שבץ בחדר רק מיטות שהבעל ציין במפורש עבור אותו חדר. חדר שלא צוינו עבורו מיטות יקבל "beds": [].
- אסור בהחלט להמציא או להשלים מיטות כדי להגיע ל-max_guests. אם יש פער — המערכת תשאל את הבעל, לא אתה תנחש.
- bed_type: king=מלכותית, queen=זוגית, single=יחיד, bunk=קומתיים, sofa_bed=ספה נפתחת, mattress=מזרן. כל סוג אחר (למשל "פוטון") — bed_type="other" ו-custom_label=השם המדויק שהבעל כתב. אל תתרגם סוג לא מוכר לסוג קרוב.${customTypesLine}
- sleeps = כמה אנשים ישנים במיטה אחת מהסוג הזה. king/queen/bunk=2, single/mattress=1. עבור sofa_bed ו-other: מלא sleeps רק אם הבעל כתב במפורש (למשל "ספה נפתחת ל-3"), אחרת null.
- כשהבעל עונה על שאלת שיבוץ (למשל "8 מיטות יחיד בחדר 2") — עדכן רק את החדרים שהוזכרו והשאר את שאר החדרים בדיוק כפי שהיו בנתונים שנאספו. החזר תמיד את rooms_detail המלא (כל החדרים), לא רק את החדרים שהשתנו.
- אם אינך בטוח (קיבולת של ספה/סוג לא מוכר, או לאיזה חדר שייכת מיטה) — השאר sleeps=null או אל תשבץ, ושאל ב-message שאלה אחת ממוקדת.
- אם הטקסט מזכיר מתקנים בחדר (טלוויזיה, מזגן, מרפסת פרטית, כניסה פרטית) — כלול אותם ב-amenities של החדר הרלוונטי.
additional_bathrooms_count: מספר חדרי רחצה נוספים/משותפים (לא צמודים לחדר שינה). למשל "3 חדרי רחצה נוספים" = 3, "שירותי אורחים" = 1, "מקלחת בכניסה" = 1. אם לא הוזכר — החזר 0.
outdoor_area — המתחם החיצוני (חצר), כללים מחייבים:
- כל מה שהבעל מתאר כנמצא בחוץ / בחצר / בגינה / על הדשא / במרפסת חיצונית (בריכה, ג'קוזי חיצוני, מנגל, ערסל, דשא, פינת ישיבה, פרגולה, משחקי ילדים, מטבח חיצוני, מקלחת חוץ, פינת מדורה) נכנס ל-outdoor_area.items. מה שבתוך חדר נכנס ל-rooms_detail[].amenities.
- privacy של החצר: "private" אם נאמר חצר פרטית/צמודה/רק לאורחים, "shared" אם משותפת עם יחידות אחרות. privacy של מתקן רק אם שונה מהחצר (למשל "חצר פרטית אבל הבריכה משותפת"). אחרת null.
- heated/covered/size/hours רק אם נאמרו במפורש (למשל "בריכה מחוממת ומקורה 4x8", "הג'קוזי פעיל עד 23:00"). note = פרט נוסף שהבעל ציין על המתקן. אסור להמציא.
- size_sqm = גודל החצר במ"ר רק אם צוין. description = משפט קצר על החצר מתוך מה שנאמר בלבד.
- מתקנים שיכולים להיות גם בפנים וגם בחוץ (${AMBIGUOUS_PLACEMENT.join(', ')}) ולא ברור מהטקסט איפה הם — אל תנחש: אל תכניס אותם ל-outdoor_area ולא לחדר, הוסף את שמם ל-unclear_placement, ושאל ב-message "ה___ נמצא בפנים או בחצר?".
- כשהבעל עונה על שאלה כזו — מקם את המתקן בהתאם והסר אותו מ-unclear_placement.
- החזר תמיד את outdoor_area המלא (כולל פריטים קודמים מהנתונים שנאספו), לא רק את מה שהשתנה. אם לא הוזכר שום דבר חיצוני — outdoor_area=null.`;
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
