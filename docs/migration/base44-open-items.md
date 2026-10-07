# Base44 → Travvin — נקודות פתוחות לחזרה

רשימת סעיפים מסבבי `port-base44` שלא הועברו או שנשארו פתוחים, כדי שלא ילכו לאיבוד אחרי קידום `last_seen_sha`.
כל סעיף כולל: מה יש ב-Base44, מה אצלנו, למה נדחה, ומה צריך כדי לסגור.

מצב הסנכרון: [base44-sync-state.md](./base44-sync-state.md). הכרעות מוצר קודמות: [decisions.md](./decisions.md).

---

## סבב 2026-10-07 (`12593c2` → `264ec58`)

### א7 · קישור "הצטרף כבעל מתחם" בתפריט הלקוח + הפניה מ-`/JoinAsOwner`

- **Base44 (`adcab40`):** נתיב `/JoinAsOwner` מפנה ל-`/join`, ופריט "הצטרף כבעל מתחם" (אייקון `Building`) בקבוצה "עוד" ב-`CustomerHamburger`.
- **אצלנו:** `/join` קיים. `/JoinAsOwner` מגיע ל-404. אין קישור בתפריט.
- **למה נדחה:** החלטת מוצר פתוחה. ב-Base44 הקישור נשען על תהליך בקשת שינוי תפקיד (`lockUserRole` + `RoleChangeRequest` + `RoleBlockScreen`). אצלנו לקוח מחובר שנכנס ל-`/join` נחסם, ובסגירת ההודעה **מתנתק** (`api.auth.logout('/welcome')`). קישור בתפריט לכל הלקוחות יוביל למבוי סתום.
- **אפשרויות לסגירה:**
  1. רק ההפניה `/JoinAsOwner` → `/join` (שורה אחת ב-`src/App.jsx`, בלי סיכון).
  2. הפניה + קישור בתפריט לאורחים לא מחוברים בלבד (דורש עיצוב ב-Figma).
  3. הפניה + קישור לכולם, אחרי מימוש תהליך בקשת שינוי תפקיד (ראו א8).
- **קבצים:** `src/App.jsx`, `src/components/customer/CustomerHamburger.jsx`.

### א8 · שדה הערה בבקשה לשינוי תפקיד

- **Base44 (`adcab40`):** שדה `note` בטופס `RoleChangeRequest` במסך `RoleBlockScreen`.
- **אצלנו:** אין `RoleChangeRequest` ואין נעילת תפקיד.
- **למה נדחה:** תלוי בהכרעה על נעילת תפקיד ([decisions.md §6](./decisions.md)).
- **לסגירה:** להכריע על נעילת תפקיד. אם כן — סכמה + RLS (רק יצירה ע"י המשתמש עצמו, ניהול ע"י אדמין), מסך חסימה, ופאנל אישור למנהל.
- **קבצים:** `src/components/auth/RoleBlockScreen.jsx` (Base44).

### א9 · מיני-יומן בצ'אט: 6 ימים במקום 6 שבועות

- **Base44 (`8b48bfb`):** 6 ימים רצופים מהיום עם שם היום.
- **אצלנו:** רשת של 6 שבועות.
- **למה נדחה:** החלטת עיצוב — לפי Figma.
- **לסגירה:** לבדוק ב-Figma מה מוגדר.
- **קבצים:** `src/components/chat/MiniAvailabilityCalendar.jsx`.

### א10 · רכיב בחירה למובייל (`mobile-select`)

- **Base44 (`61bf276`):** רכיב חדש במקום `<select>` בטפסי חסימה, מחיר, הזמנה ידנית ואוטומציית ספק.
- **אצלנו:** `<select>` רגיל.
- **למה נדחה:** עיצוב / UX — לפי Figma.
- **קבצים:** `src/components/ui/mobile-select.jsx` (Base44).

---

## ממתין לעיצוב Figma (לוגיקה הועברה, עיצוב זמני בסגנון הקיים)

| סעיף | מה | קובץ |
|---|---|---|
| א4 | שדה חיפוש צימרים + הודעת "לא נמצאו" | `src/pages/OwnerPanel.jsx` |
| א5 | מסך "לא הצלחנו לטעון את הפאנל" | `src/pages/OwnerPanel.jsx` |
| א6 | מסך "בעיית חיבור" | `src/App.jsx` |
| א2+א3 | רשימת "משתנים זמינים" והערת שעה לא מוגדרת בטופס הודעות לקוח | `src/components/owner/OwnerCustomerMessages.jsx` |

---

## חוב טכני שהתגלה בסבב (לא חלק מ-Base44)

1. **`RoleGate` מפנה ל-`/welcome` בשגיאת רשת.** כשאין אינטרנט, `api.auth.me()` נכשל והמשתמש נשלח לדף הפתיחה כאילו לא מחובר (הטוקן לא נמחק). א6 תיקן את זה רק ב-`AuthContext`. קובץ: `src/components/auth/RoleGate.jsx`.
2. **`/join` מנתק לקוח מחובר.** ראו א7.
3. **26 שגיאות lint** מסוג "ייבוא שלא בשימוש" (`npm run lint`) בקבצים שלא נגעו בסבב. כולן ניתנות לתיקון אוטומטי (`npm run lint:fix`) — לבדוק לפני.
4. **בדיקה לא יציבה:** `Review pending_publish → delayed job enqueued` ב-`test:workflows` נכשלה פעם אחת כשרץ `dev:all` במקביל ועברה בהרצה חוזרת.
5. **תבניות הודעות שהייה כפולות** בשרת (`server/src/lib/stay-message-templates.js`) ובלקוח (`src/lib/stayMessageTemplates.js`). שינוי באחד מחייב עדכון בשני.

---

## נדחה מסבבים קודמים

- **כניסת לקוח (`CustomerHome` ב-`/`) ונעילת תפקיד** — [decisions.md §6](./decisions.md) (סבב `12593c2`).
