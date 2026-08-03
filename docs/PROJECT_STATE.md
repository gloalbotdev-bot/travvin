---
title: תמונת מצב הפרויקט — zimmer-chat-smart (TRAVVIN)
date: 2026-08-03
based_on: docs/project-audit.md (גרסה מעודכנת 2026-08-03)
note: מסמך זה הוא צילום מצב תמציתי של הפרויקט כפי שהוא היום — לא תוכנית פעולה ולא ביקורת מלאה.
---

# תמונת מצב הפרויקט — TRAVVIN (`zimmer-chat-smart`)

**תאריך:** 2026-08-03  
**סוג:** SPA בלבד על Base44 (BaaS). אין שרת עצמאי בריפו.  
**היקף קוד:** 145 קבצים ב-`src/`, ~17,759 שורות.  
**מצב תשתית מקומי:** אין `.git`, אין `node_modules/`, אין `.env.local`, אין `server/`, אין `appId`.

---

## 1. שירותים חיצוניים

| שירות | תפקיד | נדרש? | סטטוס בפועל |
|---|---|---|---|
| **Base44 Platform** | DB, auth, LLM, storage, functions, workflows, agent runtime, scheduler, hosting, CDN | קריטי | פעיל — כל האפליקציה תלויה בו |
| **Google OAuth** (דרך Base44) | התחברות משתמשים | כן | פעיל דרך `auth.loginWithProvider('google')` |
| **Google Calendar API** | סנכרון הזמנות דו־כיווני + webhook | אופציונלי (try/catch) | פעיל — connector + 2 workflows + 2 functions |
| **Nominatim / OpenStreetMap** | Geocoding (כתובת → lat/lng) | לא | פעיל מ-`geocodeAddresses` |
| **OpenStreetMap Tiles** | רקע מפה ב-`SearchMap` | לא | פעיל |
| **ספק LLM (דרך Base44)** | 13 קריאות `InvokeLLM` + סוכן `zimmer_manager` | קריטי לליבה | פעיל; מפתח API לא בקוד |
| **Base44 File Storage** | העלאת תמונות צימרים (`UploadFile`) | כן | פעיל |
| **media.base44.com / static.wixstatic.com** | אופטימיזציית תמונות | לא | בשימוש ב-`image.jsx` |
| **Google Fonts** | פונט Heebo | לא | בשימוש ב-`index.css` |
| **Google Search Console** | אימות דומיין | לא | `public/google633ce416ac8a1de6.html` |
| **Stripe** | — | לא | מותקן ב-`package.json`, **אפס שימוש בקוד** |

**אין בפרויקט:** Redis, S3 ישיר, Twilio/SendGrid, Firebase/Supabase/Clerk, vector DB, Sentry/Datadog, ספק אימייל עצמאי.

---

## 2. כל התלויות ב-Base44

### 2.1 חבילות npm
| חבילה | גרסה |
|---|---|
| `@base44/sdk` | `^0.8.41` |
| `@base44/vite-plugin` | `^1.0.30` |

### 2.2 נקודת כניסה יחידה
`src/api/base44Client.js` — מיובא ב-**62 קבצים**, ובנוסף `DateSearchWidget.jsx` מקבל `base44` כפרמטר → **63 צרכנים**.

### 2.3 משטחי SDK בשימוש (6)

| משטח | היקף | הערות |
|---|---|---|
| `base44.entities.*` | 14 ישויות, ~178 קריאות ב-45 קבצים | CRUD + `.subscribe()` (7 מנויים) |
| `base44.auth.*` | 12 מתודות, ~46 קריאות | `me`, `loginWithProvider`, `logout`, `updateMe`, OTP, reset… |
| `base44.integrations.Core` | `InvokeLLM` ×13, `UploadFile` ×3 | AI + קבצים (כולל ReviewForm) |
| `base44.functions.invoke` | 9 אתרים בקוד | add/geocode/sync + **pushInAppNotification×5** מהדפדפן |
| `base44.users.inviteUser` | 4 אתרים | תפקידים `'owner'` ו-`'user'` |
| `base44.agents.*` | 5 מתודות ב-`OwnerAgentChat.jsx` | runtime סוכן מלא |

### 2.4 תיקיית `base44/` (דקלרטיבי)
| רכיב | כמות |
|---|---|
| Entities | **14** (כולל `SyncState`) |
| Functions (Deno) | **5** (+`finalizeReviewAutoPublish`) |
| Workflows | **11** (8 entity + 1 scheduled + 1 connector + 1 Review wait) |
| Agents | 1 — `zimmer_manager` (**פעיל בממשק**) |
| Connectors | 1 — `googlecalendar` |

### 2.5 תלויות סמויות קריטיות
1. `@base44/vite-plugin` — proxy `/api`, analytics, visual-edit agent  
2. `@base44/sdk/dist/utils/axios-client` — import פנימי ב-`AuthContext.jsx`  
3. endpoint `public-settings` — גייטינג האימות של כל האפליקציה  
4. פרמטרי URL: `app_id`, `access_token`, `from_url`, `functions_version`, `app_base_url`  
5. `media.base44.com`  
6. Favicon מ-`base44.com`  
7. `base44/.app.jsonc` — מוחרג מ-git, **חסר בייצוא**  
8. RLS דקלרטיבי — רק על 2/14 ישויות  
9. מנוע workflows (DSL + jq + `old_data` + **`wait`**)  
10. connector OAuth (טוקנים ב-vault של הפלטפורמה)  
11. runtime הסוכן (זיכרון, tool-calling, streaming)  
12. `functionsVersion`  
13. **Scheduler** — cron `*/30 * * * *`  
14. **Connector webhook** — רישום push channel מול Google לא בקוד  
15. מבנה `_provider_meta` בגוף webhook  
16. **Delayed jobs** — wait PT12H/PT48H לביקורות 

### 2.6 משתני סביבה של Base44
| משתנה | נדרש? |
|---|---|
| `VITE_BASE44_APP_ID` | **כן — חוסם הרצה** (חסר) |
| `VITE_BASE44_APP_BASE_URL` | כן לפיתוח frontend-only |
| `VITE_BASE44_FUNCTIONS_VERSION` | אופציונלי |
| `BASE44_LEGACY_SDK_IMPORTS` | אופציונלי, מיותר כיום |

---

## 3. מודלי AI

### 3.1 מסלול A — `InvokeLLM` (13 קריאות ב-11 קבצים)

| # | קובץ | תפקיד | מודל | Structured Output | אינטרנט |
|---|---|---|---|---|---|
| 1 | `CustomerChat.jsx:369` | דירוג top-5 צימרים | ברירת מחדל (לא ידוע) | כן | לא |
| 2 | `CustomerChat.jsx:559` | תזמור שיחה ראשית | ברירת מחדל | כן | לא |
| 3 | `SearchChat.jsx:124` | top-5 דסקטופ | ברירת מחדל | כן | לא |
| 4 | `SearchChat.jsx:188` | שיחה חופשית דסקטופ | ברירת מחדל | כן | לא |
| 5 | `VacationAgentChat.jsx:109` | סוכן נופש | **`gemini_3_flash`** | לא (טקסט) | **כן** |
| 6 | `BookingCreatorChat.jsx:47` | חילוץ הזמנה מטקסט | ברירת מחדל | כן | לא |
| 7 | `OwnerInfoAssistant.jsx:257` | סוכן פעולות DB (עם preview) | ברירת מחדל | כן | לא |
| 8 | `OwnerDashboard.jsx:96` | המלצות עסקיות | ברירת מחדל | לא | לא |
| 9 | `ZimmerDatabase.jsx:44` | סיכום ידע | ברירת מחדל | לא | לא |
| 10 | `AdminAssistantChat.jsx:113` | עוזר עריכת צימר | ברירת מחדל | כן | לא |
| 11 | `ZimmerCreatorChat.jsx:111` | אשף יצירת צימר | ברירת מחדל | כן | לא |
| 12 | `InfoSummaryEditor.jsx:43` | סיכום מידע ללקוחות | ברירת מחדל | לא | לא |
| 13 | `ChatHistoryPanel.jsx:22` | סיכום שיחת לקוח | ברירת מחדל | לא | לא |

**פיצול:** 8 עם JSON schema, 5 טקסט חופשי.  
**אין:** הפרדת system/user, streaming, temperature, max_tokens, SDK ישיר של ספק.

### 3.2 מסלול B — סוכן `zimmer_manager` (פעיל)

| מאפיין | ערך |
|---|---|
| שם | `zimmer_manager` |
| מודל | `"automatic"` (נבחר ע"י הפלטפורמה) |
| UI | טאב `assistant` ב-`/owner` (`OwnerAgentChat.jsx`) |
| SDK | `agents.listConversations` / `createConversation` / `getConversation` / `subscribeToConversation` / `addMessage` |
| זיכרון | `enabled: true`, `scope: "both"` |
| מצבים | מידע (קריאה) / עריכה (כתיבה) — מועברים כתחילית `[מצב: …]` ב-prompt |
| ישויות עם tools | 9 (כולל `delete` על 5) |
| פונקציות שרת | `addBookingToCalendar`, `syncGoogleCalendar`, `pushInAppNotification` |
| ערוץ טלגרם | `telegram_greeting` מאוכלס |
| אישור אנושי | **אין** במצב עריכה — "פעולות מתבצעות מיד" |

### 3.3 מערכת ביקורות (לא AI — לוגיקת מוצר)

מכונת מצבים ב-`Review` + workflow `wait` + `finalizeReviewAutoPublish`. UI: `CustomerReviewsTab`, `ReviewsPanel`, `SuperAdminReviewsPanel`, `src/components/reviews/*`. התראות דרך `pushInAppNotification` מהדפדפן.

---

## 4. בסיס נתונים

| שאלה | תשובה |
|---|---|
| איזה DB? | **לא ידוע מהקוד** — מנוהל ב-Base44 |
| היכן? | מרחוק בתשתית Base44; אין connection string / ORM / dump |
| סכמות בריפו? | כן — 14 קבצי JSON Schema ב-`base44/entities/` |
| Migrations? | **אין** |
| RLS מוצהר? | רק על `DirectChat` (מלא) ו-`SystemMessage` (read פתוח) — **2/14** |

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
| Review | zimmer_id, owner_id, rating | ❌ | **מכונת מצבים** + settlement_offer; אין min/max |
| Contact | name, owner_id | ❌ | |
| CustomerProfile | user_id | ❌ | |
| OwnerRequest | user_id, user_email | ❌ | נכתבת, לא נקראת |
| AdminPermission | email | ❌ | **ישות הרשאות ללא RLS** |
| User | — | ❌ | רק שדה `role` בסכמה |
| **SyncState** | — | ❌ | **סינגלטון גלובלי** לסנכרון יומן |

**שדות מטא סמויים (לא בסכמות):** `id`, `created_date`, `updated_date`, `created_by_id`, `created_by`.

**Enums:** רובם בעברית (`ממתינה`, `אושרה`, `נדחתה`, `אושר`, `פעיל`…).

**כיוון מיגרציה מתוכנן:** PostgreSQL + Prisma + מחסן JSONB גנרי (לפי `docs/migration-plan.md`).

---

## 5. Authentication

| רכיב | פירוט |
|---|---|
| ספק ראשי | Google OAuth דרך `base44.auth.loginWithProvider` (12 קריאות ב-6 קבצים) |
| מסלול משני | Email+Password+OTP — קיים ב-`Login`/`Register`/`ForgotPassword`/`ResetPassword` אך **ללא routes ב-`App.jsx`** (קוד מת) |
| טוקן | `access_token` מ-URL → `localStorage` תחת `base44_access_token` |
| Bootstrap | `AuthContext` → GET `public-settings` → `auth.me()` |
| נתיבים ציבוריים | `/`, `/welcome`, `/admin-login` |
| תפקידים | `admin` / `owner` (לקוח = ברירת מחדל משתמע) |
| הרשאות superadmin | `AdminPermission.filter({email})` **בצד לקוח בלבד** |
| `requiresAuth` ב-SDK | `false` |
| ProtectedRoute | קיים בקוד, **לא בשימוש** |

**סיכוני auth מרכזיים:** הסלמת הרשאות דרך `AdminPermission` ללא RLS; `updateMe({role:'owner'})`; `EditOwnerModal` יכול לשלוח `role:'admin'`; טוקן ב-localStorage (XSS).

---

## 6. Storage

| רכיב | פירוט |
|---|---|
| העלאת קבצים | `base44.integrations.Core.UploadFile` — `ZimmerEditor`, `ZimmerCreatorChat`, **`ReviewForm`** |
| אחסון | Base44 managed storage (URLs מוחלטים) |
| אופטימיזציית תמונות | `media.base44.com` / `static.wixstatic.com` ב-`image.jsx` |
| שדות תמונה | `Zimmer.images[]`, `Review.images[]` |
| אחסון מקומי בדפדפן | `localStorage`: טוקן, `lastSeen`, **zb_read_sysmsgs_owner**; `sessionStorage`: המשך שיחה |
| קואורדינטות | **לא נשמרות ב-DB** — רק `useState` ב-`DesktopSearch` |

**מיגרציה מתוכננת:** ממשק אחסון מופשט עם דיסק מקומי כברירת מחדל (מילסטון 11).

---

## 7. Variables (משתני סביבה)

### קיימים / מוכרים (4)
| משתנה | מקור | סטטוס |
|---|---|---|
| `VITE_BASE44_APP_ID` | env / URL `app_id` | **חסר — חוסם** |
| `VITE_BASE44_APP_BASE_URL` | env / URL | חסר |
| `VITE_BASE44_FUNCTIONS_VERSION` | env / URL | אופציונלי |
| `BASE44_LEGACY_SDK_IMPORTS` | env build | מיותר |

אין `.env`, `.env.local`, או `.env.example` בריפו.

### יידרשו אחרי מיגרציה
`DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY` / `GEMINI_API_KEY`, `S3_*` (או מקבילה), `SMTP_*`, `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `GOOGLE_CALENDAR_WEBHOOK_TOKEN`, דגלי מעבר `VITE_BACKEND_*` (לפי תוכנית המיגרציה).

---

## 8. APIs

### Frontend → Backend (דרך SDK)
אין קובץ routes בריפו. כל התקשורת דרך SDK ל-`/api/...` (רלטיבי).

| סוג | דוגמאות |
|---|---|
| Entities CRUD | `list` / `filter` / `get` / `create` / `update` / `delete` / `subscribe` |
| Auth | `me`, `loginWithProvider`, `logout`, `updateMe`, OTP, reset… |
| Users | `inviteUser(email, role)` |
| Integrations | `InvokeLLM`, `UploadFile` |
| Functions | `invoke('addBookingToCalendar'|'geocodeAddresses'|'syncGoogleCalendar'|'pushInAppNotification')` |
| Agents | `listConversations`, `createConversation`, `getConversation`, `subscribeToConversation`, `addMessage` |
| חריג ישיר | `GET /api/apps/public/prod/public-settings/by-id/{appId}` |

### פונקציות שרת (Deno)
| פונקציה | SDK pin | Auth | asServiceRole | הערה |
|---|---|---|---|---|
| `addBookingToCalendar` | 0.8.38 | כן (`me`) | כן | ללא בדיקת בעלות; יומן primary יחיד |
| `geocodeAddresses` | 0.8.40 | כן | לא | Nominatim ללא throttling |
| `pushInAppNotification` | 0.8.40 | **לא** | כן | נקרא גם מהדפדפן (ביקורות) |
| `syncGoogleCalendar` | 0.8.40 | מותנה | כן | webhook/workflow עוקפים auth |
| `finalizeReviewAutoPublish` | 0.8.40 | **לא** | כן | פרסום אחרי wait |

### Workflows (11)
| סוג | כמות | פירוט |
|---|---|---|
| `entity` | 8 | התראות על BookingRequest / UnansweredQuestion / DirectChat |
| `scheduled` | 1 | cron `*/30 * * * *` → sync יומן |
| `connector` | 1 | Google Calendar push → sync |
| `entity` + `wait` | 1 | Review Auto Publish → finalize |

### נתיבי Frontend (11 + redirects)
`/`, `/welcome`, `/admin-login`, `/chat`, `/promotions`, `/owner`, `/superadmin`, `/join`, `/account-settings`, `/customer-portal`, `/desktop-search`  
+ redirects: `/CustomerChat`, `/customer-chat`, `/CustomerPortal`, `/DesktopSearch`

---

## 9. Deployment

| רכיב | מצב |
|---|---|
| Hosting | Base44 managed (`trav-vin.com`) |
| Build | Vite 6 → `./dist` (`base44/config.jsonc`) |
| Vite plugin | analytics + visual-edit + HMR/nav notifiers **ב-bundle** |
| CI/CD בריפו | **אין** |
| Dockerfile / vercel.json / netlify.toml | **אין** |
| Git | **אין** (לא repository) |
| Publish | `base44 dashboard open` → publish (לפי README) |
| SEO | `noindex, nofollow` גלובלי; רק Landing עוקף; `/promotions` לא מאונדקס |
| manifest.json | מקושר מ-`index.html` אך **הקובץ חסר** (404) |
| Favicon | `https://base44.com/logo_v2.svg` |
| Monitoring / Sentry | **אין** |
| ErrorBoundary / StrictMode | **אין** |

**הרצה מקומית מתועדת:**
```bash
base44 dev          # backend מקומי + frontend
npm run dev         # frontend בלבד מול hosted backend
```

---

## 10. רשימת סיכונים

### קריטיים (פתוחים עכשיו בפרודקשן)
| # | סיכון | מקור |
|---|---|---|
| R1 | הסלמת הרשאות דרך `AdminPermission` ללא RLS + יצירה מהדפדפן | 12.2 |
| R2 | `SystemMessage.read: {}` דולף תוכן צ'אט; owner יכול לשדר לכולם | 12.4 |
| R3 | `pushInAppNotification` ללא אימות + `asServiceRole` + קריאות מהדפדפן | 12.5 |
| R4 | סוכן `zimmer_manager` במצב עריכה — `delete` על 5 ישויות **ללא אישור אנושי**; בקרה כמחרוזת prompt | A.3 / N1 |
| R5 | `syncGoogleCalendar` — webhook/workflow עוקפים auth + כתיבה חוצת-דיירים ליומן יחיד | 12.10 / N2 |
| R6 | אין `appId` / אין git / אין גיבוי — אין רשת ביטחון | חלק 10 |
| R6ב | `finalizeReviewAutoPublish` ללא auth | 12.12 |

### גבוהים
| # | סיכון |
|---|---|
| R7 | `addBookingToCalendar` ללא בדיקת בעלות; יומן primary יחיד לכל הבעלים |
| R8 | Prompt injection + stored injection דרך `data_zones`; פלט LLM → DB |
| R9 | `EditOwnerModal` יכול לשלוח `role: 'admin'` מהדפדפן |
| R10 | `SyncState` סינגלטון גלובלי ללא RLS — כל owner מדליק/מכבה sync לכל המערכת |
| R11 | `User.delete` מהדפדפן ללא RLS |
| R12 | `Zimmer.approval_status` default=`אושר` — אין שער אישור אמיתי |
| R13 | חשיפת PII חלקית עדיין: `UnansweredQuestion.list(100)`, `BookingRequest.list(500)` בסופר-אדמין ועוד |
| R14 | תנאי-מרוץ בהזמנות (check-then-create ללא אילוץ) |
| R15 | `total_price` מחושב בצד לקוח ב-6 מקומות |
| R16 | באג timezone אפשרי בתעריף סוף-שבוע (`getUTCDay`) |
| R16ב | מכונת ביקורות ללא RLS / אכיפת מעברי סטטוס |

### בינוניים
| # | סיכון |
|---|---|
| R17 | פקיעת מבצעים רק בצד לקוח (פסאודו-cron) |
| R18 | Nominatim ללא throttling — חסימת IP |
| R19 | קואורדינטות לא נשמרות — geocoding מחדש בכל session |
| R20 | RLS ברירת-מחדל ל-12 ישויות **לא ידועה** |
| R21 | אירוע יומן כפול באישור חוזר (אין idempotency) |
| R22 | ולידציה חסרה בסכמות (rating, dates, email, discount) |
| R23 | טוקן ב-localStorage (XSS) |
| R24 | Runtime הסוכן / push channel / scheduler — לא מתועדים בייצוא |

### נמוכים / חוב טכני
| # | סיכון |
|---|---|
| R25 | 11 חבילות לא בשימוש (כולל `three` ~600KB) |
| R26 | `leaflet` מיובא ולא מוצהר |
| R27 | אפס בדיקות אוטומטיות |
| R28 | `jsconfig`/`eslint` מחריגים את הקוד הקריטי |
| R29 | אין ErrorBoundary — מסך לבן בשגיאה |
| R30 | bundle מנופח, אין code-splitting |
| R31 | analytics/visual-edit ב-bundle פרודקשן ללא שליטה |

---

## 11. מדדים מספריים (נכון ל-2026-08-03)

| מדד | ערך |
|---|---|
| שורות ב-`src/` | ~17,759 |
| קבצי קוד ב-`src/` | 145 |
| מייבאי `base44Client` | 62 (+1 פרמטר = 63 צרכנים) |
| ישויות | 14 |
| קריאות entities | ~178 ב-45 קבצים |
| פונקציות שרת | 5 |
| Workflows | 11 |
| אתרי `.subscribe()` | 7 ב-5 קבצים |
| קריאות `InvokeLLM` | 13 ב-11 קבצים |
| `UploadFile` | 3 |
| `functions.invoke` (אתרים) | 9 |
| `loginWithProvider` | 12 ב-6 קבצים |
| `inviteUser` | 4 |
| משטחי SDK | 6 |
| חבילות לא בשימוש | 11 |
| נתיבי UI | 11 (+4 redirects) |
| טאבים ב-`/owner` | 11 |

---

## 12. מה חסר כדי להריץ / להתחיל מיגרציה

1. `git init` + tag `pre-migration`  
2. `VITE_BASE44_APP_ID` + `.env.local`  
3. `npm ci` + `npm install leaflet`  
4. Base44 CLI  
5. שני חשבונות בדיקה (admin + owner)  
6. הכרעה: האם משחזרים את הסוכן במיגרציה  
7. הכרעה: איך מיישבים webhook ציבורי עם "אין endpoint ציבורי"  
8. הכרעה: האם משחזרים wait-jobs לביקורות  

**מסמכים מפורטים:**
- ביקורת מלאה: [`docs/project-audit.md`](./project-audit.md)
- תוכנית מיגרציה: [`docs/migration-plan.md`](./migration-plan.md)
- מסמך מאסטר: [`docs/PROJECT_MASTER_DOCUMENT.md`](./PROJECT_MASTER_DOCUMENT.md)
