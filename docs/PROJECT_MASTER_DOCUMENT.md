---
title: מסמך מאסטר — zimmer-chat-smart (TRAVVIN)
date: 2026-08-03
updated: 2026-08-03
sources:
  - docs/PROJECT_STATE.md
  - docs/project-audit.md (updated 2026-08-03)
  - docs/migration-plan.md (updated 2026-08-03)
  - base44_removal_plan_3d453782.plan.md
  - README.md / AGENTS.md
  - סריקת ריפו מול קוד נוכחי (entities, functions, workflows, App.jsx, package.json, reviews)
note: מסמך ריכוז ידע יחיד. לתמונת מצב תמציתית ראו PROJECT_STATE; לביקורת מלאה — project-audit; לתוכנית ביצוע — migration-plan. סונכרן מול הקוד ב-2026-08-03 (מערכת ביקורות).
---

# PROJECT MASTER DOCUMENT — TRAVVIN (`zimmer-chat-smart`)

**תאריך עדכון:** 2026-08-03  
**סוג:** SPA על Base44 (BaaS). אין שרת עצמאי בריפו.  
**דומיין:** `trav-vin.com` (Hosting מנוהל של Base44)  
**היקף:** ~145 קבצים ב-`src/`, ~17,759 שורות.

**מצב תשתית מקומי (נכון ל-2026-08-03):** אין `.git`, אין `node_modules/`, אין `.env.local`, אין `server/`, אין `appId` מוגדר.

---

## 1. תקציר ארכיטקטורה

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React 18 + Vite 6 SPA)                            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Pages/UI    │→│ base44Client │→│ @base44/sdk         │ │
│  │ 11 routes   │  │ (נקודת כניסה)│  │ entities/auth/…    │ │
│  └─────────────┘  └──────────────┘  └─────────┬──────────┘ │
│         ↑ Vite plugin: /api proxy, analytics, visual-edit   │
└─────────┼───────────────────────────────────────────────────┘
          │ HTTPS /api/...
┌─────────▼───────────────────────────────────────────────────┐
│  Base44 Platform                                            │
│  • DB (entities ×14)  • Auth (Google OAuth + email/OTP)     │
│  • LLM (InvokeLLM)    • Agent runtime (zimmer_manager)      │
│  • File storage       • Deno functions ×5                   │
│  • Workflows ×11      • Scheduler + wait-jobs + Calendar    │
│  • Hosting / CDN                                            │
└─────────────────────────────────────────────────────────────┘
          │
    External: Google OAuth, Google Calendar API, Nominatim/OSM,
              media.base44.com, Google Fonts
```

**עקרונות מרכזיים:**
- אין backend עצמאי — כל הלוגיקה העסקית בצד לקוח + Base44 functions/workflows/agents.
- נקודת SDK יחידה: `src/api/base44Client.js` → **62 מייבאים + DateSearchWidget = 63 צרכנים**.
- 6 משטחי SDK: `entities`, `auth`, `integrations.Core`, `functions`, `users`, `agents`.
- מיגרציה מתוכננת: facade → Express + Prisma + Postgres בתוך `server/`, **שחזור נאמן**, נתוני דמו בלבד.
- **מערכת ביקורות מלאה** (lifecycle + auto-publish wait) פעילה ב-UI.

---

## 2. כל התלויות ב-Base44

### 2.1 חבילות npm

| חבילה | גרסה |
|---|---|
| `@base44/sdk` | `^0.8.41` |
| `@base44/vite-plugin` | `^1.0.30` |

### 2.2 נקודת כניסה

```js
// src/api/base44Client.js
export const base44 = createClient({
  appId, token, functionsVersion,
  serverUrl: '', requiresAuth: false, appBaseUrl
});
```

פרמטרים מ-`src/lib/app-params` (env / URL): `app_id`, `access_token`, `functions_version`, `app_base_url`.

### 2.3 משטחי SDK בשימוש

| משטח | היקף | הערות |
|---|---|---|
| `base44.entities.*` | 14 ישויות, ~178 קריאות ב-45 קבצים | CRUD + `.subscribe()` (**7** מנויים ב-5 קבצים) |
| `base44.auth.*` | 12 מתודות, ~46 קריאות | `me`, `loginWithProvider`×12, `logout`, `updateMe`, OTP, reset |
| `base44.integrations.Core` | `InvokeLLM`×13, `UploadFile`×**3** | AI + קבצים (כולל ReviewForm) |
| `base44.functions.invoke` | **9** אתרים בקוד | addBookingToCalendar, geocodeAddresses, syncGoogleCalendar, **pushInAppNotification×5** |
| `base44.users.inviteUser` | 4 אתרים | תפקידים `'owner'` / `'user'` |
| `base44.agents.*` | 5 מתודות | `OwnerAgentChat.jsx` — סוכן פעיל ב-UI |

### 2.4 תיקיית `base44/` (דקלרטיבי)

| רכיב | כמות | פירוט |
|---|---|---|
| Entities | **14** | ראו סעיף 5 |
| Functions (Deno) | **5** | +`finalizeReviewAutoPublish` |
| Workflows | **11** | 8 entity + 1 scheduled + 1 connector + **1 Review wait** |
| Agents | **1** | `zimmer_manager` (פעיל) |
| Connectors | **1** | `googlecalendar` |

### 2.5 תלויות סמויות קריטיות

1. `@base44/vite-plugin` — proxy `/api`, analytics, visual-edit agent (ב-bundle)
2. `@base44/sdk/dist/utils/axios-client` — import פנימי ב-`AuthContext.jsx`
3. Endpoint `public-settings` — גייטינג אימות לכל האפליקציה
4. פרמטרי URL: `app_id`, `access_token`, `from_url`, `functions_version`, `app_base_url`
5. `media.base44.com` / `static.wixstatic.com` ב-`image.jsx`
6. Favicon מ-`base44.com`
7. `base44/.app.jsonc` — מוחרג מ-git, חסר בייצוא
8. RLS דקלרטיבי — רק 2/14 ישויות
9. מנוע workflows (DSL + jq + `old_data` + **`wait`**)
10. Connector OAuth (טוקנים ב-vault של הפלטפורמה)
11. Runtime הסוכן (זיכרון, tool-calling, streaming)
12. `functionsVersion`
13. Scheduler — cron `*/30 * * * *` (Asia/Jerusalem)
14. Connector webhook — רישום push channel מול Google לא בקוד
15. מבנה `_provider_meta` בגוף webhook
16. **Delayed jobs** — wait PT12H/PT48H לפרסום ביקורות

### 2.6 פונקציות שרת (Deno)

| פונקציה | Auth | asServiceRole | הערה |
|---|---|---|---|
| `addBookingToCalendar` | כן (`me`) | כן | יומן `primary` יחיד; אין בדיקת בעלות |
| `geocodeAddresses` | כן | לא | Nominatim ללא throttling |
| `pushInAppNotification` | **אין** | כן | נקרא גם מהדפדפן (ביקורות) |
| `syncGoogleCalendar` | חלקי | כן | webhook/workflow עוקפים auth |
| `finalizeReviewAutoPublish` | **אין** | כן | מפרסם Review אחרי wait |

### 2.7 Workflows (11)

| סוג | שם / תפקיד |
|---|---|
| entity ×8 | New/Cancel Booking → owner; Approved/Rejected → customer; New Question / Question Answered; Direct Chat replies |
| scheduled ×1 | `Google Calendar Auto Sync` — cron `*/30 * * * *` |
| connector ×1 | `Google Calendar Sync` — push מ-`googlecalendar` / `primary` |
| entity+wait ×1 | `Review Auto Publish` — PT12H (דירוג גבוה) / PT48H (נמוך) → finalize |

---

## 3. שירותים חיצוניים

| שירות | תפקיד | נדרש? | סטטוס |
|---|---|---|---|
| **Base44 Platform** | DB, auth, LLM, storage, functions, workflows, agents, scheduler, hosting, CDN | קריטי | פעיל — כל האפליקציה תלויה בו |
| **Google OAuth** (דרך Base44) | התחברות | כן | `auth.loginWithProvider('google')` |
| **Google Calendar API** | סנכרון הזמנות דו־כיווני + webhook | אופציונלי (try/catch) | connector + 2 workflows + 2 functions |
| **Nominatim / OpenStreetMap** | Geocoding (כתובת → lat/lng) | לא | מ-`geocodeAddresses` |
| **OpenStreetMap Tiles** | רקע מפה ב-`SearchMap` | לא | פעיל (`react-leaflet`; `leaflet` עצמו חסר בהתקנה) |
| **ספק LLM (דרך Base44)** | 13×`InvokeLLM` + סוכן | קריטי לליבה | מפתח API לא בקוד |
| **Base44 File Storage** | העלאת תמונות צימרים | כן | `UploadFile` |
| **media.base44.com / static.wixstatic.com** | אופטימיזציית תמונות | לא | `image.jsx` |
| **Google Fonts** | Heebo | לא | `index.css` |
| **Google Search Console** | אימות דומיין | לא | `public/google633ce416ac8a1de6.html` |
| **Stripe** | — | לא | מותקן ב-`package.json`, **אפס שימוש בקוד** |

**אין בפרויקט:** Redis, S3 ישיר, Twilio/SendGrid, Firebase/Supabase/Clerk, vector DB, Sentry/Datadog, ספק אימייל עצמאי, CI/CD, Dockerfile.

---

## 4. מודלי AI והיכן משתמשים בהם

### 4.1 מסלול A — `InvokeLLM` (13 קריאות ב-11 קבצים)

| # | קובץ | תפקיד | מודל | Structured Output | אינטרנט |
|---|---|---|---|---|---|
| 1 | `CustomerChat.jsx` | דירוג top-5 צימרים | ברירת מחדל (לא ידוע) | כן | לא |
| 2 | `CustomerChat.jsx` | תזמור שיחה ראשית | ברירת מחדל | כן | לא |
| 3 | `SearchChat.jsx` | top-5 דסקטופ | ברירת מחדל | כן | לא |
| 4 | `SearchChat.jsx` | שיחה חופשית דסקטופ | ברירת מחדל | כן | לא |
| 5 | `VacationAgentChat.jsx` | סוכן נופש | **`gemini_3_flash`** | לא (טקסט) | **כן** |
| 6 | `BookingCreatorChat.jsx` | חילוץ הזמנה מטקסט | ברירת מחדל | כן | לא |
| 7 | `OwnerInfoAssistant.jsx` | סוכן פעולות DB (עם preview) | ברירת מחדל | כן | לא |
| 8 | `OwnerDashboard.jsx` | המלצות עסקיות | ברירת מחדל | לא | לא |
| 9 | `ZimmerDatabase.jsx` | סיכום ידע | ברירת מחדל | לא | לא |
| 10 | `AdminAssistantChat.jsx` | עוזר עריכת צימר | ברירת מחדל | כן | לא |
| 11 | `ZimmerCreatorChat.jsx` | אשף יצירת צימר | ברירת מחדל | כן | לא |
| 12 | `InfoSummaryEditor.jsx` | סיכום מידע ללקוחות | ברירת מחדל | לא | לא |
| 13 | `ChatHistoryPanel.jsx` | סיכום שיחת לקוח | ברירת מחדל | לא | לא |

**פיצול:** 8 עם JSON schema, 5 טקסט חופשי.  
**חסר:** הפרדת system/user, streaming, temperature, max_tokens, SDK ישיר של ספק.

### 4.2 מסלול B — סוכן `zimmer_manager` (פעיל)

| מאפיין | ערך |
|---|---|
| שם | `zimmer_manager` |
| מודל | `"automatic"` (נבחר ע״י הפלטפורמה) |
| UI | טאב `assistant` ב-`/owner` (`OwnerAgentChat.jsx`) |
| SDK | `listConversations` / `createConversation` / `getConversation` / `subscribeToConversation` / `addMessage` |
| זיכרון | `enabled: true`, `scope: "both"` |
| מצבים | מידע (קריאה) / עריכה (כתיבה) — תחילית `[מצב: …]` ב-prompt בלבד |
| ישויות עם tools | 9 (כולל `delete` על 5) |
| פונקציות שרת | `addBookingToCalendar`, `syncGoogleCalendar`, `pushInAppNotification` |
| ערוץ טלגרם | `telegram_greeting` מאוכלס |
| אישור אנושי | **אין** במצב עריכה — פעולות מיידיות |

### 4.2ב — מערכת ביקורות (לוגיקת מוצר, לא LLM)

מכונת מצבים ב-`Review` + workflow `Review Auto Publish` (`wait` 12/48ש׳) + `finalizeReviewAutoPublish`. ממשקים: לקוח / בעלים / סופר-אדמין + תצוגה ציבורית ב-`ReviewsSection`.

### 4.3 כיוון מיגרציה ל-AI

- OpenAI Structured Outputs כברירת מחדל (החלפת רוב `InvokeLLM`)
- Gemini לקריאה שצריכה עיגון באינטרנט (`VacationAgentChat`)
- Runtime סוכן = מילסטון 16 נפרד, או הכרעה מפורשת לזנוח

---

## 5. בסיס הנתונים

| שאלה | תשובה |
|---|---|
| איזה DB? | **לא ידוע מהקוד** — מנוהל ב-Base44 |
| היכן? | מרחוק בתשתית Base44; אין connection string / ORM / dump |
| סכמות בריפו | 14 קבצי JSON Schema ב-`base44/entities/` |
| Migrations | **אין** |
| RLS מוצהר | רק `DirectChat` (מלא) ו-`SystemMessage` (read פתוח) — **2/14** |

### 14 הישויות

| ישות | Required עיקרי | RLS | הערה |
|---|---|---|---|
| Zimmer | `name` | ❌ | +`weekday_price`/`weekend_price`; אין lat/lng; default approval=`אושר` |
| BookingRequest | zimmer_id, guest_name, guest_phone, check_in, check_out | ❌ | תאריכים כ-string |
| ChatSession | user_id | ❌ | |
| DirectChat | zimmer_id, customer_id, owner_id | ✅ מלא | |
| SystemMessage | audience, title, body | ⚠️ read פתוח | create ל-admin **או owner** |
| UnansweredQuestion | zimmer_id, owner_id, question | ❌ | |
| Promotion | zimmer_id, owner_id, check_in, check_out, discount_percent | ❌ | |
| Review | zimmer_id, owner_id, rating | ❌ | **מכונת מצבים** + settlement_offer; אין min/max על rating |
| Contact | name, owner_id | ❌ | |
| CustomerProfile | user_id | ❌ | |
| OwnerRequest | user_id, user_email | ❌ | נכתבת, לא נקראת ממסך |
| AdminPermission | email | ❌ | **ישות הרשאות ללא RLS** |
| User | — | ❌ | רק שדה `role` בסכמה |
| **SyncState** | — | ❌ | **סינגלטון גלובלי** לסנכרון יומן |

**שדות מטא סמויים:** `id`, `created_date`, `updated_date`, `created_by_id`, `created_by`.  
**Enums:** רובם בעברית (`ממתינה`, `אושרה`, `נדחתה`, `אושר`, `פעיל`…).

**חוזה entities בפועל:**
- `.filter(query, sort?, limit?)` — query שטוח של שוויון בלבד
- `sort` — מחרוזת כמו `'-created_date'`
- מתודות: `list`, `get`, `create`, `update`, `delete`, `subscribe`

**כיוון מיגרציה:** PostgreSQL + Prisma + מחסן JSONB גנרי ל-14 ישויות (כולל אינדקס `calendar_event_id`).

### אחסון קבצים

- העלאה: `UploadFile` מ-`ZimmerEditor.jsx`, `ZimmerCreatorChat.jsx`, **`ReviewForm.jsx`**
- URLs מוחלטים ב-`Zimmer.images[]` וב-`Review.images[]`
- אופטימיזציה: `media.base44.com`
- מקומי: `localStorage` (טוקן, lastSeen, **zb_read_sysmsgs_owner**), `sessionStorage` (חיפוש); שיחות ללא persistence ב-DB ב-`DesktopSearch`

---

## 6. משתני סביבה

### נוכחיים / נדרשים להרצה על Base44

| משתנה | מקור | חובה? |
|---|---|---|
| `VITE_BASE44_APP_ID` | env / URL `app_id` | **כן — חוסם הרצה** (חסר) |
| `VITE_BASE44_APP_BASE_URL` | env / URL | כן לפיתוח frontend-only |
| `VITE_BASE44_FUNCTIONS_VERSION` | env / URL | אופציונלי |
| `BASE44_LEGACY_SDK_IMPORTS` | env build | מיותר כיום |

**אין בריפו:** `.env`, `.env.local`, או `.env.example`.

ב-`base44 dev` ה-CLI מזריק ערכים מקומיים; `.env.local` נדרש בעיקר ל-frontend מול hosted backend.

### מתוכננים למיגרציה (עתידי)

`DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY` / `GEMINI_API_KEY`, `S3_*` (או חלופה), `SMTP_*`, `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `GOOGLE_CALENDAR_WEBHOOK_TOKEN`, ודגלים מסוג `VITE_BACKEND_*`.

---

## 7. נקודות כניסה

### 7.1 הרצה מקומית

| פקודה | תפקיד |
|---|---|
| `base44 dev` | backend מקומי של Base44 + frontend (כשמוגדר `serveCommand`) |
| `npm run dev` | frontend בלבד מול hosted backend |
| `base44 dashboard open` | פרסום דרך הדשבורד |

### 7.2 כניסת קוד / SDK

| נקודה | קובץ |
|---|---|
| React root | `src/main.jsx` → `App.jsx` |
| Auth bootstrap | `AuthContext` → `GET public-settings` → `auth.me()` |
| SDK client | `src/api/base44Client.js` |
| Vite + Base44 plugin | `vite.config.js` |

### 7.3 נתיבי Frontend (11 + 4 redirects)

| נתיב | מסך | הערה |
|---|---|---|
| `/` | Landing | ציבורי |
| `/welcome` | Welcome | ציבורי |
| `/admin-login` | AdminLogin | ציבורי |
| `/chat` | CustomerChat | שיחת לקוח |
| `/promotions` | Promotions | |
| `/owner` | OwnerPanel | 11 טאבים כולל assistant + reviews |
| `/superadmin` | SuperAdminPanel | כולל טאב reviews; הרשאות דרך `AdminPermission` בצד לקוח |
| `/join` | JoinAsOwner | |
| `/account-settings` | AccountSettings | |
| `/customer-portal` | CustomerPortal | כולל טאב reviews |
| `/desktop-search` | DesktopSearch | |
| redirects | `/CustomerChat`, `/customer-chat`, `/CustomerPortal`, `/DesktopSearch` | → נתיבים הקנוניים |
| `*` | PageNotFound | |

**קוד מת (ללא routes):** `Login` / `Register` / `ForgotPassword` / `ResetPassword`.  
**קוד מת נוסף:** `CustomerQuestionsTab` (אינו מחובר ל-portal).  
**ProtectedRoute:** קיים בקוד, **לא בשימוש**.  
`requiresAuth` ב-SDK = `false`.

### 7.4 תפקידים

- `admin` / `owner` / לקוח (ברירת מחדל משתמע)
- Superadmin: `AdminPermission.filter({email})` **בצד לקוח בלבד**

---

## 8. רשימת סיכונים

### קריטיים (חשיפה מיידית בפרודקשן)

| # | סיכון | מקור |
|---|---|---|
| R1 | הסלמת הרשאות דרך `AdminPermission` ללא RLS + סינון צד-לקוח | audit 12.2 |
| R2 | `SystemMessage.read: {}` פתוח לכולם; owner יכול ליצור הודעות | 12.4 |
| R3 | `pushInAppNotification` ללא אימות + `asServiceRole` + **קריאות מהדפדפן** | 12.5 |
| R4 | סוכן `zimmer_manager` במצב עריכה — `delete` על 5 ישויות **ללא אישור אנושי**; אכיפה רק ב-prompt | A.3 |
| R5 | `syncGoogleCalendar` — webhook/workflow עוקפים auth + כתיבה חוצת-דיירים ליומן יחיד | 12.10 |
| R6 | אין `appId` / אין git / אין גיבוי — אין נקודת שחזור | מצב תשתית |
| R6ב | `finalizeReviewAutoPublish` ללא auth + asServiceRole | 12.12 |

### גבוהים

| # | סיכון |
|---|---|
| R7 | `addBookingToCalendar` ללא בדיקת בעלות; יומן primary יחיד לכל המערכת |
| R8 | Prompt injection + stored injection דרך `data_zones`; מסלול LLM → DB |
| R9 | `EditOwnerModal` יכול לשלוח `role: 'admin'` מצד-לקוח |
| R10 | `SyncState` סינגלטון גלובלי ללא RLS — כל owner יכול לקרוא/לשנות sync |
| R11 | `User.delete` מצד-לקוח ללא RLS |
| R12 | `Zimmer.approval_status` default=`אושר` — אין סף אישור מובנה |
| R13 | דליפת PII ברשימות גלובליות: `UnansweredQuestion.list(100)`, `BookingRequest.list(500)` |
| R14 | תנאי-מירוץ בהזמנות (check-then-create ללא טרנזקציה) |
| R15 | `total_price` מחושב בדפדפן ב-6 מקומות |
| R16 | באג timezone אפשרי בתמחור weekday/weekend (`getUTCDay`) |
| R16ב | מכונת ביקורות ללא RLS / אכיפת מעברי סטטוס |

### בינוניים

| # | סיכון |
|---|---|
| R17 | התראות כפולות רק בדפדפן (לא בשרת/cron) |
| R18 | Nominatim ללא throttling — חסימת IP |
| R19 | שיחות לא נשמרות — geocoding חוזר בכל session |
| R20 | RLS ברירת-מחדל על 12 ישויות **לא ידועה** |
| R21 | מנוע יומן פתוח לכפילויות (אין idempotency) |
| R22 | ולידציה חלשה בסכמות (rating, dates, email, discount) |
| R23 | טוקן ב-localStorage (XSS) |
| R24 | Runtime סוכן / push channel / scheduler — לא מתועדים בריפו |

### תפעוליים / חוב טכני

| # | סיכון |
|---|---|
| R25 | 11 חבילות ללא שימוש (כולל `three` ~600KB); Stripe מותקן ולא בשימוש |
| R26 | `leaflet` נדרש ל-`react-leaflet` ואינו מותקן |
| R27 | מחסור בבדיקות אוטומטיות |
| R28 | `jsconfig`/`eslint` עיוורים לקבצים שהמיגרציה תשנה |
| R29 | אין ErrorBoundary / StrictMode |
| R30 | bundle מונוליתי, אין code-splitting |
| R31 | analytics/visual-edit ב-bundle פרודקשן ללא הסרה |
| R32 | `manifest.json` מקושר מ-`index.html` אך הקובץ חסר (404) |
| R33 | SEO: `noindex, nofollow` גלובלי |

---

## 9. מצב המיגרציה

### סטטוס כללי

| פריט | מצב |
|---|---|
| מילסטונים שבוצעו | **אף אחד** (כולם `pending`) |
| תוכנית פעילה | `docs/migration-plan.md` (**19** מילסטוני מיגרציה כולל 8.5 + מרשם דחויים) |
| תוכנית ישנה | `base44_removal_plan_3d453782.plan.md` (ספירות מיושנות חלקית) |
| `server/` | לא קיים |
| Facade `src/api/client.js` | לא קיים |
| מסמך ZimmerPro | נמחק — הנחה בטלה |

### הכרעות שנקבעו

- Backend חדש בתוך הריפו (`server/`)
- PostgreSQL + Prisma
- **אין** מיגרציית נתונים — נתוני דמו, התחלה נקייה
- LLM: OpenAI Structured Outputs + Gemini לאינטרנט
- אחסון קבצים: ממשק מופשט + דיסק מקומי כברירת מחדל (החלטה סופית נדחית)
- **שחזור נאמן** של כל ההתנהגות הקיימת (כולל פרצות) במהלך המיגרציה; תיקון במרשם דחויים (מילסטון 15)

### הכרעות חוסמות (טרם הוכרעו)

1. **האם משחזרים את הסוכן `zimmer_manager`?** אם לא — חיסכון 5–8 ימים. אם כן — מילסטון 16 חוסם.
2. **Webhook של Google Calendar** מול "אין endpoint HTTP ציבורי": cron-only או endpoint ציבורי מאומת-טוקן.
3. **האם משחזרים wait-jobs לביקורות (12/48ש׳)?** נדרש delayed-jobs ב-backend או שינוי התנהגות.

### הערכת מאמץ (מעודכן אחרי סקירת אסטרטגיה 2026-08-03)

| שלב | ימי עבודה |
|---|---|
| מיגרציה ליבה (-1…14 + 8.5, ללא סוכן) | **35–44** |
| מילסטון 16 (סוכן) | **5–8** (או 0.5 בזניחה) |
| מילסטון 15 (דחויים, 24 פריטים) | **16–22** |
| **סה״כ עם סוכן** | **56–74** |
| **סה״כ בזניחת סוכן** | **51–66** |

### מילסטונים (סטטוס: כולם pending)

| ID | תוכן קצר |
|---|---|
| **-1** | תנאים מקדימים: git + tag, appId, `.env.local`, `npm ci`, CLI, leaflet, חשבונות בדיקה |
| **0** | קו בסיס: jsconfig/eslint, צ'קליסט 11 מסלולים, golden fixtures ל-14 ישויות + agents/webhook + Review |
| **1** | `src/api/client.js` facade שקוף (entities/auth/functions/integrations/users/agents) |
| **2** | העברת 63 צרכנים ל-facade (אצוות כולל reviews; owner=15) |
| **3** | שלד backend: Express + Prisma + Postgres + docker-compose + `/api/health` |
| **4** | שכבת נתונים JSONB ל-14 ישויות כולל SyncState + Review מורחב |
| **4.5** | מדידת RLS בפועל ל-12/14 + תרגום DirectChat/SystemMessage/SyncState/Review |
| **5** | Auth עצמאי: Google, JWT, OTP, inviteUser×4, public-settings |
| **6** | החלפת 7 מנויי entity subscribe (+ תכנון agents subscribe) |
| **7** | `geocodeAddresses` + Nominatim policy |
| **8** | Calendar: add + sync + SyncState + push + OAuth |
| **8.5** | pushInAppNotification + finalizeReviewAutoPublish |
| **9** | 11 workflows — entity hooks + cron + webhook + Review wait |
| **10** | שכבת LLM — 13 InvokeLLM |
| **16** | Runtime סוכן / או זניחה מאושרת |
| **11** | העלאת קבצים ×3 + ניקוי media.base44.com |
| **12** | הסרת `@base44/vite-plugin` |
| **13** | **נקודת אל-חזור:** מחיקת SDK + base44Client + VITE_BASE44 |
| **14** | ניקוי סופי: מחיקת `base44/`, favicon, README/AGENTS |
| **15** | מרשם תיקונים דחויים (24 פריטים) |

**מסלול קריטי:** -1 → 0 → **1 (facade — יישום ראשון)** → 2 → 3 → 4 → 4.5 → 5 → (7∥10∥11) → 8 → 8.5 → 9; מילסטון 16 רק אם אושר (P3).  
**מסוכנים ביותר:** 5 (auth), 4 (נתונים), 16 (סוכן), 8 (יומן), 9 (wait).

---

## 10. Checklist עדכני

### א. תנאים מקדימים (מילסטון -1) — לפני כל קוד מיגרציה

- [ ] `git init` + commit ראשוני + tag `pre-migration`
- [ ] השגת `VITE_BASE44_APP_ID` ויצירת `.env.local` (+ `VITE_BASE44_APP_BASE_URL`)
- [ ] `npm ci` / `npm install`
- [ ] `npm install leaflet` (חסר ל-`react-leaflet`)
- [ ] התקנת Base44 CLI (`npm i -g base44@latest`)
- [ ] אימות `base44 dev` / `npm run dev` עובדים
- [ ] שני חשבונות בדיקה: admin + owner
- [ ] תיקון `jsconfig.json` / `eslint.config.js` (עיוורים לקבצי יעד)

### ב. הכרעות עסקיות חוסמות

- [ ] הכרעה: שחזור סוכן `zimmer_manager` **או** זניחה מאושרת בכתב
- [ ] הכרעה: webhook יומן ציבורי מאומת **או** cron-only (שינוי התנהגות מודע)
- [ ] הכרעה: שחזור wait-jobs לביקורות **או** פישוט מאושר

### ג. קו בסיס (מילסטון 0)

- [ ] צ'קליסט ידני ל-11 מסלולי UI (Landing → DesktopSearch + Owner + Superadmin)
- [ ] Golden fixtures / הקלטות ל-14 ישויות
- [ ] הקלטת תשובות agents + webhook calendar
- [ ] תיעוד מדידת RLS בפועל (קלט למילסטון 4.5)

### ד. התקדמות מיגרציה (סמן עם השלמה)

- [ ] M1 — facade `src/api/client.js`
- [ ] M2 — כל הצרכנים על facade
- [ ] M3 — שלד `server/` + health
- [ ] M4 — entities JSONB
- [ ] M4.5 — authz / RLS נמדד ומשוחזר
- [ ] M5 — auth עצמאי
- [ ] M6 — realtime
- [ ] M7 — geocode
- [ ] M8 — Google Calendar מלא
- [ ] M8.5 — pushInAppNotification + finalizeReviewAutoPublish
- [ ] M9 — workflows + wait
- [ ] M16 — agent runtime / זניחה
- [ ] M11 — uploads
- [ ] M12 — הסרת vite-plugin
- [ ] M13 — הסרת SDK (אל-חזור)
- [ ] M14 — ניקוי סופי + אפס הפניות ל-Base44
- [ ] M15 — מרשם 24 תיקונים דחויים

### ה. אימות יציאה מ-Base44

- [ ] אפס התאמות ל-`@base44` / `base44Client` / `VITE_BASE44` / `media.base44.com` / favicon base44
- [ ] תיקיית `base44/` נמחקה או הוחלפה
- [ ] בדיקות חוזה מול fixtures עוברות
- [ ] 11 מסלולי UI עובדים מול backend החדש (כולל ביקורות)
- [ ] אין secrets ב-git

### ו. תיקונים דחויים בעדיפות גבוהה (אחרי יציבות — M15)

- [ ] R1/R9 — אכיפת הרשאות admin בשרת
- [ ] R3/R24 — אימות ל-`pushInAppNotification` + חסימת לקוח
- [ ] R4 — אכיפת mode + whitelist כלים בשרת
- [ ] R5 — אימות webhook + הרשאות SyncState
- [ ] R6ב/R16ב — auth ל-finalize + מעברי Review בשרת
- [ ] R2/R20 — צמצום SystemMessage.create
- [ ] R16 — timezone לתמחור weekday/weekend
- [ ] R15 — `total_price` בשרת
- [ ] R7 — יומן per-owner / בדיקת בעלות
- [ ] ניקוי חבילות לא בשימוש + ErrorBoundary + code-splitting

---

## 11. מדדים מהירים (Snapshot 2026-08-03)

| מדד | ערך |
|---|---|
| שורות ב-`src/` | ~17,759 |
| קבצי קוד ב-`src/` | 145 |
| מייבאי `base44Client` | 62 (+1 פרמטר = 63 צרכנים) |
| ישויות | 14 |
| קריאות entities | ~178 ב-45 קבצים |
| פונקציות שרת | 5 |
| Workflows | 11 |
| מנויי `.subscribe()` | 7 ב-5 קבצים |
| קריאות `InvokeLLM` | 13 ב-11 קבצים |
| `UploadFile` | 3 |
| `functions.invoke` (אתרים) | 9 |
| `loginWithProvider` | 12 ב-6 קבצים |
| `inviteUser` | 4 |
| משטחי SDK | 6 |
| חבילות ללא שימוש | 11 |
| נתיבי UI | 11 (+4 redirects) |
| טאבים ב-`/owner` | 11 |

---

## 12. מפת מסמכים

| מסמך | תפקיד |
|---|---|
| **`docs/PROJECT_MASTER_DOCUMENT.md`** | **ריכוז ידע יחיד (מסמך זה)** |
| `docs/PROJECT_STATE.md` | תמונת מצב תמציתית |
| `docs/project-audit.md` | ביקורת טכנית מלאה + פרצות מפורטות |
| `docs/migration-plan.md` | תוכנית מיגרציה מעודכנת (מקור האמת לביצוע) |
| `base44_removal_plan_3d453782.plan.md` | טיוטת תוכנית מקורית (ספירות חלקיות מיושנות) |
| `README.md` | הרצה מקומית / publish |
| `AGENTS.md` | הנחיות לסוכני קוד |

---

*עודכן 2026-08-03 מריכוז המסמכים הקיימים + סנכרון מול הקוד הנוכחי (מערכת ביקורות, 5 פונקציות, 11 workflows). לעדכן מסמך זה בכל שינוי מהותי בארכיטקטורה, בתלויות Base44, או בהתקדמות מילסטון.*
