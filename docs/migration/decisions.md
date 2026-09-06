# הכרעות מיגרציה

תאריך: 2026-08-03 (עודכן 2026-09-06 — §6: דחיית כניסת לקוח + נעילת תפקיד בסבב UI 12593c2)  
סטטוס: **הכרעות מאושרות** למיגרציה; ניתן לעדכן לפני שחזור M16.

## 1. סוכן `zimmer_manager` (מילסטון 16)

**הכרעה (מעודכן 2026-08-09):** **נדחה** — לא משחזרים עכשיו; בודקים קודם את המצב עם `OwnerInfoAssistant` + המסכים.  
**לא מבוטל לצמיתות.** מדריך חזרה מדויק: [m16-restore-guide.md](./m16-restore-guide.md) (כולל **§6 — עדכוני Base44 a9dba46**).

**נימוק לדחייה:** חוסך 5–8 ימי עבודה במיגרציה ומוריד משטח סיכון (כלי DB + מחיקות בלי אכיפה שרתית מספקת).  
טאב `assistant` ב־`/owner` **נשאר** עם `OwnerInfoAssistant` (InvokeLLM; יצירת/עדכון צימר + יצירת הזמנה).  
`OwnerAgentChat` הוסר מהקוד ב־M13; הקונפיג נמחק עם `base44/` ב־M14 — שניהם זמינים ב־git **וב־vendor `base44/main`**.

**עדכון Base44 (2026-09-02):** בין `121d851` ל־`a9dba46` Base44 הרחיבה `OwnerAgentChat` (היסטוריה, קול, split, `OwnerConversation`). בסבב port-base44 המתוכנן **לא** משחזרים את הסוכן — רק שיפורי UI ל־`OwnerInfoAssistant`. פירוט מלא: [m16-restore-guide.md §6](./m16-restore-guide.md#6-עדכוני-base44-מאז-הסבב-הראשון-121d851--a9dba46).

**כשחוזרים:** לעדכן סעיף זה ל־«מאושר לשחזור» ולבחור 1:1 מול הרחבה הדרגתית של `OwnerInfoAssistant` (מומלץ קודם — ראה המדריך §5–§6).

## 2. Google Calendar webhook (מילסטון 8/9)

**הכרעה:** **cron-only** כל 30 דקות (`*/30 * * * *`).

**נימוק:** עקבי עם מדיניות "אין endpoint HTTP ציבורי" ל-`pushInAppNotification`, מפשט אבטחה. מחיר: עיכוב סנכרון עד ~30 דק׳ במקום push מיידי.  
אם בעתיד יידרש realtime — ניתן להוסיף endpoint מאומת-טוקן כשדרוג.

## 3. ביקורות auto-publish wait (מילסטון 8.5/9)

**הכרעה:** **שחזור wait** PT12H (דירוג 4–5) / PT48H (דירוג 1–3) → `finalizeReviewAutoPublish`.

**נימוק:** שחזור נאמן של התנהגות המוצר הקיימת. מחייב מנגנון delayed jobs ב-backend החדש.

## 4. Calendar tenancy (מילסטון 8)

**הכרעה:** יומן **per-owner** (לא primary משותף לכל האפליקציה).

**מודל:**
- טבלת `CalendarConnection` עם Prisma enums: `CalendarProvider` (v1=`google`), `CalendarConnectionStatus` (`active`/`revoked`/`error`)
- `UNIQUE (owner_id, provider)`
- `calendar_id` = מזהה יומן אמיתי מ-calendarList בזמן החיבור (לא alias `"primary"`)
- `refresh_token_enc` מוצפן AES-256-GCM; מפתח `CALENDAR_TOKEN_ENCRYPTION_KEY`
- `SyncState` פר-owner (+ `provider`, `last_sync_attempt`); הרשאות לפי `owner_id` (סוגר #18 ליומן)
- Cron-only `*/30` Asia/Jerusalem: לולאה על owners עם `auto_sync`; retry אחד ל-timeout/5xx; כשל ב-owner אחד לא עוצר את השאר
- `addBookingToCalendar` / sync משתמשים ב-connection של `booking.owner_id` (תיקון #5 בהקשר יומן)

**נימוק:** בידוד multi-tenant; בסיס לעובדים בעתיד. חריגה מכוונת מפריטי deferred-fixes **#6** וצמצום **#5/#18** בהקשר יומן בלבד. Webhook נשאר מחוץ להיקף (§2).

**תאריך אישור:** 2026-08-05

## 5. ספק LLM (מילסטון 10)

**הכרעה:** **Gemini בלבד** — מפתח API אחד (`GEMINI_API_KEY`) לכל 13 קריאות `InvokeLLM` (טקסט, JSON schema, ועיגון אינטרנט).

**נימוק:** פישוט תפעול וחיוב; אותו ספק גם ל-Google Search grounding ב-`VacationAgentChat`. OpenAI לא בשימוש.

**תאריך אישור:** 2026-08-05

## 6. נדחה זמנית — כניסת לקוח + נעילת תפקיד (סבב UI 12593c2)

**הכרעה (2026-09-06):** בסבב port UI מ־Base44 `12593c2` **לא** מכריעים ולא מחליפים:

1. **כניסת לקוח** — נשארים עם Travvin: `Landing` ב־`/`, צ׳אט אורח ב־`/chat`. לא מחברים `CustomerHome` ל־`/` ולא מפנים `/chat` → `/`. רכיבי לקוח חדשים (hamburger, browse, promotions popup וכו׳) הועברו כ־**additive** בלבד.
2. **נעילת תפקיד** — `lockUserRole`, `role_locked`, `RoleChangeRequest`, `RoleBlockScreen` / `UsersRolesPanel` נשארים מחוץ להיקף עד הכרעת מוצר (ובדיקת RLS ליצירה פתוחה ב־Base44).

**נימוק:** היקף מאושר היה Owner UI + רכיבי לקוח בלי שינוי routing/auth; הכרעות מוצר נדחו במפורש.

**סבב קשור:** ענף `port/base44-ui-20260906` / [base44-sync-state.md](./base44-sync-state.md).

---

## חשבונות בדיקה

| תפקיד | אימייל | אומת ב-UI? | הערות |
|---|---|---|---|
| admin **וגם** owner | `gw38452@gmail.com` | ✅ | אומת 2026-08-04 — התחברות אורח + בעל צימר מקומית |
| owner נוסף (אופציונלי) | `s053410331@gmail.com` | — | אין גישת התחברות למגרציה; לא חובה |

**אופן התחברות:** Google OAuth דרך האפליקציה. אין לשמור סיסמאות ב-git.

### איך למלא את הצ׳קליסט (חשבון כפול-תפקיד)

מספיק **חשבון אחד** (`gw38452@gmail.com`) + מצב אורח (לא מחובר):

1. **עמודה "אורח"** — פתחי את האתר **בלי** להתחבר (חלון פרטי / התנתקות). סמני ✓ בכל תא שאינו `—` בעמודת אורח.
2. **עמודות "owner" ו-"admin"** — התחברי פעם אחת עם `gw38452@gmail.com`.  
   - לכל מסלול עם ⬜ תחת **owner** — היכנסי לנתיב ובדקי שהמסך/הנתונים של בעלים עובדים → ✓  
   - לכל מסלול עם ⬜ תחת **admin** — בדקי גישת מנהל (`/superadmin` וכו׳) → ✓  
   - תאים עם `—` = לא רלוונטי לתפקיד; לא ממלאים.
3. אם אותו מסלול יש לו ⬜ גם ב-owner וגם ב-admin — סמני **שתי** העמודות אחרי ביקור אחד באותו URL (כל עוד שני התפקידים באמת פעילים בחשבון).

סימון ✓ = העמוד נטען בלי שגיאה קריטית וההרשאה הצפויה עובדת. אם נכשל — כתבי ✗ והערה קצרה מתחת לטבלה.

### צ'קליסט ידני — 11 מסלולים

סמן אחרי: (א) ביקור כאורח, (ב) התחברות כ-`gw38452@gmail.com` לעמודות owner+admin.

| מסלול | אורח | owner | admin |
|---|---|---|---|
| `/` Landing | ⬜ | ⬜ | ⬜ |
| `/welcome` | ⬜ | ⬜ | ⬜ |
| `/admin-login` | ⬜ | — | ⬜ |
| `/chat` | — | ⬜ | ⬜ |
| `/promotions` | ⬜ | ⬜ | ⬜ |
| `/owner` | — | ⬜ | — |
| `/superadmin` | — | — | ⬜ |
| `/join` | ⬜ | ⬜ | — |
| `/account-settings` | — | ⬜ | ⬜ |
| `/customer-portal` | — | ⬜ | ⬜ |
| `/desktop-search` | — | ⬜ | ⬜ |
