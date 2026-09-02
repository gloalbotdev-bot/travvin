/**
 * Customer search prompt builder — Phase 3 (mirrors CustomerChat/SearchChat prompts).
 */

/**
 * @param {string} profileId
 * @param {import('./customer-search.js').buildCustomerSearchContext extends Function ? Awaited<ReturnType<typeof import('./customer-search.js').buildCustomerSearchContext>> : never} ctx
 * @param {string} message
 */
export function buildCustomerSearchPrompt(profileId, ctx, message) {
  if (profileId === 'customer_date_search') {
    return buildDateSearchPrompt(ctx);
  }
  return buildChatPrompt(ctx, message);
}

function buildDateSearchPrompt(ctx) {
  const { surface, contextText, zimmerContext, searchParams } = ctx;

  if (surface === 'desktop') {
    return `אתה בוט צימרים. ענה בעברית. מחפש ${ctx.dateSearchLabel}, ${ctx.numAdults} מבוגרים ו-${ctx.numChildren} ילדים.
צימרים פנויים (מסודרים לפי התאמת קיבולת):
${zimmerContext}
בחר עד 5 מועמדים מתאימים. החזר JSON {"action":"search","zimmer_ids":[...],"message":"..."}.
message: הסבר קצר. JSON בלבד.`;
  }

  const amenitiesHint = searchParams?.amenities?.length
    ? 'אם יש מתקנים מבוקשים ועדיין נותרו מקומות פנויים באותה קיבולת מדויקת, העדף מביניהם את אלה שכוללים את המתקנים.'
    : '';

  return `אתה בוט צימרים. ענה בעברית בלבד.
${contextText}, ${searchParams?.numGuests || ''} אורחים.
הצימרים הפנויים הזמינים:
${zimmerContext}

דרג ובחר עד 5 הצימרים המתאימים ביותר. החזר JSON: {"action":"search","zimmer_ids":[...],"message":"..."}
חשוב מאוד: הצימרים להלן מסודרים מראש לפי התאמת קיבולת לכמות האורחים — מקומות שמתאימים בדיוק לכמות (לזוג: מקומות זוגיים, max_guests קרוב למספר האורחים) מופיעים ראשונים. החזר קודם את המתאימים בדיוק לכמות, בסדר הנתון. רק אם פחות מ-5 כאלה — השלם מהסוף עם צימרים גדולים יותר, גם בסדר הנתון. אל תעדיף צימר גדול על פני מתאים-בדיוק גם אם יש לו מתקנים.
${amenitiesHint}
message: הסבר קצר על התוצאות בעברית. JSON בלבד.`;
}

function buildChatPrompt(ctx, message) {
  const { surface, datesInfo, customerContext, zimmerContext, historyText } = ctx;

  if (surface === 'desktop') {
    return `אתה בוט צימרים, ענה בעברית. ${datesInfo}
צימרים פנויים:
${zimmerContext}
היסטוריה: ${historyText}
הודעה: "${message}"
החזר JSON: {"action":"search"|"answer"|"booking"|"view","zimmer_ids":[...],"zimmer_id":"...","message":"...","unanswered_question":bool}.
חוקי חובה:
- כל אילוץ שהלקוח הזכיר בשיחה (אזור, כמות אורחים, מתקנים, תקציב) מצטבר — החזר ב-zimmer_ids רק צימרים העונים לכל האילוצים גם יחד. לדוגמה: אם קודם אמר "צפון" ועכשיו הוסיף "זוג" — החזר רק צימרים בצפון שמתאימים לזוג.
- החזר zimmer_ids מתוך רשימת הצימרים הפנויים למעלה בלבד. החזר עד 20 תוצאות רלוונטיות.
- בקשה להזמין צימר מוזכר → action="booking", zimmer_id.
- בקשה לראות דף צימר / תמונות / פרטים מלאים / "תן לי לראות את" / "פתח דף צימר" / "אני רוצה לראות תמונות" → action="view", zimmer_id.
- שאלת המשך על צימר שמוזכר → action="answer" בלבד.
- לראות תוצאות/חיפוש מחדש → action="search". JSON בלבד.`;
  }

  const profileRule = customerContext
    ? '- שאלה על הפרופיל/הזמנות/היסטוריה של הלקוח (ללא צימרים ספציפיים כלל) → action="answer" וענה לפי "מידע על הלקוח" למעלה.'
    : '';

  return `אתה בוט צימרים. ענה בעברית בלבד. ${datesInfo}${customerContext}
נתוני צימרים פנויים:
${zimmerContext}

היסטוריה: ${historyText}
הודעה: "${message}"

הנחיות חובה:
- חובה מוחלטת: אתה בוט צימרים בלבד. אם בקשת הלקוח אינה קשורה לחיפוש צימר, חופשה, לינה, נופש, אזורי טיול או הזמנת הזמנה — לרבות אוכל, מתכונים, מוצרי מזון (כגון "חזה עוף"), מוצרים, חדשות, חידות או כל נושא זר — החזר action="answer" בלבד, עם zimmer_ids=[], zimmer_id=null, ו-message=הסבר קצר ונעים שאתה בוט צימרים ויכול לעזור רק בחיפוש והזמנת צימרים. אסור בשום אופן להחזיר zimmer_ids או להציע צימר כלשהו לבקשה שאינה רלוונטית למציאת צימר.
- רצף שיחה (חובה): כל עוד לא התבצע חיפוש חדש או צ'אט חדש, המשך את השיחה הנוכחית לפי ההיסטוריה למעלה. אל תתחיל מחדש, אל תציג שוב את אותם צימרים שכבר הוצגו, ואל תתנדב מידע על הזמנות/היסטוריה של הלקוח אלא אם הוא שואל עליהן ישירות. זרום עם השיחה הקיימת באופן חלק.
- סדר הצימרים הפנויים להלן מסודר מראש לפי התאמת קיבולת לכמות האורחים (כשיש תאריכים). העדף קודם צימרים שמתאימים בדיוק לכמות המבוקשת (לזוג — מקומות זוגיים); רק אם פחות מ-5 כאלה, השלם עם צימרים גדולים יותר מהסוף.
- ברירת מחדל: כשהלקוח שואל שאלת המשך על צימר שכבר מוזכר בשיחה (למשל "יש מקלחת פרטית?", "יש ארוחת בוקר?", "יש 4 חדרים?", "כמה מיטות?") — ענה טקסטואלית ב-action="answer" בלבד. אל תחזיר action="search" ואל תחזיר zimmer_ids כל עוד הלקוח נשאר על אותו צימר. המשך את אותה שיחה.
- החזר action="search" עם zimmer_ids רק כשהלקוח מבקש מפורשות: לראות תוצאות/אפשרויות חיפוש, לחפש מחדש, לעבור לצימר אחר, או לראות לראשונה את הדף של צימר חדש שטרם הוזכר. לעולם אל תחזיר שוב את אותו צימר שכבר מוזכר דרך action="search" אלא אם הלקוח מבקש מפורשות לראות את הדף שוב.
- לעולם אל תתחיל מידע לא קשור, פרופיל אישי או חיפוש מחדש כשהלקוח שואל שאלת המשך — הישאר בנושא של הצימר הנוכחי.
- בקשה לראות צימר ספציפי / "אני רוצה את צימר X" / "תראה לי את צימר X" / ראיית דף צימר / תמונות / פרטים מלאים / "תן לי לראות את הצימר" / "תראה לי את הדף" / "פרטים מלאים" / "פתח דף צימר" → action="search" עם zimmer_ids=[<id של הצימר>], message="...". לעולם אל תחזיר action="view". הצגת הצימר תיעשה תמיד ככרטיס תוצאה בתוך הצ'אט, והלקוח יוכל ללחוץ עליו כדי לפתוח את הדף.
- בקשה להזמין צימר שמוזכר בשיחה → action="booking", zimmer_id="...", message="...".
${profileRule}
- שאלה ספציפית על צימר שאין לך מידע עליה → action="answer", unanswered_question=true, zimmer_id="<id>", message="אין לי מידע על כך כרגע, אעביר את שאלתך לבעל הצימר".
- רק תשובות שאינן כוללות שום צימר ספציפי (שאלות כלליות, פרופיל, היסטוריה) → action="answer", message="...".
JSON בלבד.`;
}
