/**
 * One-shot prompt builders — Phase 7.
 */

export function buildOwnerTipsPrompt(ctx) {
  return `אתה יועץ עסקי לבעל צימרים בישראל. בעל המתחם מנהל את הצימרים: ${ctx.zimmerNames}.
נתונים: ${ctx.checkinsToday} צ'קאין היום, ${ctx.checkoutsToday} צ'קאאוט היום, ${ctx.currentlyStaying} אורחים כרגע, ${ctx.monthBookingsCount} הזמנות החודש, הכנסה חזויה ₪${ctx.monthRevenue.toLocaleString('he-IL')}, ${ctx.pendingCount} בקשות ממתינות.
תן 3-4 המלצות קצרות ומעשיות לשיפור העסק. כל המלצה בשורה נפרדת עם ✨ בהתחלה. בעברית בלבד.`;
}

export function buildAdminSessionSummaryPrompt(ctx) {
  return `סכם בעברית בקצרה (3-5 שורות) את השיחה הבאה עם לקוח בצ'אט של מערכת הזמנות צימרים. ציין: מה הלקוח חיפש, אילו צימרים הוצגו${ctx.zimmerCount ? ` (${ctx.zimmerCount} צימרים)` : ''}, ואם נוצרה הזמנה${ctx.bookingCreated ? ' (כן)' : ''}.

שיחה:
${ctx.msgText}`;
}

export function buildInfoSummaryPrompt(ctx) {
  return `אתה עוזר של בעל צימר. להלן מידע שנאסף על הצימר ממספר מקורות (שיחות, שאלות, טקסט חופשי). כתוב סיכום מידע אחד בעברית שיוצג ללקוחות בדף הצימר.

כללים:
- פסקה אחת או רשימה קצרה, ברורה ומזמינה.
- הדגש פרטים שימושיים: מתקנים, מדיניות, שעות כניסה/יציאה, אבזור, אזורים מיוחדים.
- אל תמציא מידע שלא מופיע למטה. אם חסר, פשוט דלג.
- טקסט רציף, בלי כותרות ובלי מרכאות.

המידע:
${ctx.raw}`;
}

export function buildVacationAgentPrompt(ctx, message) {
  const historyBlock = ctx.historyText
    ? `\n\nהיסטוריית שיחה:\n${ctx.historyText}`
    : '';

  return `אתה סוכן נופש אישי. ענה בעברית חמה ומועילה.
${ctx.contextText}${historyBlock}

בקשת הלקוח: "${message}"

המלץ בצורה מפורטת: מסעדות, אטרקציות, נקודות עניין ופעילויות באזור החופשה ובדרך אליו.
- התאם את ההמלצות להרכב הנוסעים (מבוגרים/ילדים) שמופיע למעלה. אם יש ילדים, תעדף מקומות מתאימים למשפחות.
- השתמש במידע עדכני מהרשת (כתובות, שעות פתיחה, דירוגים) כשאפשר.
- פרק את התשובה לפסקאות עם כותרות ורשימות להבהרה.`;
}
