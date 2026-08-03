---
title: ביקורת טכנית מלאה — zimmer-chat-smart (TRAVVIN)
date: 2026-07-29
updated: 2026-08-03
source: שיחת ביקורת טכנית מלאה + עדכונים מול הקוד הנוכחי (2026-08-02, 2026-08-03)
note: גרסה 3. שמורה כל התועלת מהביקורת המקורית; עודכנו סעיפים שהתיישנו; נוספו שינויי מערכת הביקורות (2026-08-03).
---

# ביקורת טכנית מלאה — `zimmer-chat-smart` (TRAVVIN)

**היקף הסריקה (מעודכן 2026-08-03):** 145 קבצי קוד ב-`src/` ובהם **~17,759 שורות** (ב-2026-08-02: ~16,405; בביקורת המקורית: 15,650), כל תיקיית `base44/` (**14 ישויות, 5 פונקציות, 11 workflows**, סוכן אחד, מחבר אחד), וכל קבצי התצורה בשורש.

**מסמכים נלווים:** [`PROJECT_STATE.md`](./PROJECT_STATE.md) (תמונת מצב), [`migration-plan.md`](./migration-plan.md) (תוכנית מיגרציה מעודכנת), [`PROJECT_MASTER_DOCUMENT.md`](./PROJECT_MASTER_DOCUMENT.md).

---

# חלק חדש A — שינויים מאז הביקורת הקודמת

## A.1 — סיכום מנהלים

| תחום | מצב |
|---|---|
| **תלות חדשה: `base44.agents.*`** | 🔴 **חדש (08-02).** משטח SDK שישי |
| **סנכרון יומן Google דו־כיווני** | 🔴 **חדש (08-02).** ישות, פונקציה, 2 workflows ורכיב UI |
| **Workflow מתוזמן (cron) ו-webhook** | 🔴 **חדש (08-02).** |
| **מערכת ביקורות מלאה (lifecycle)** | 🔴 **חדש (08-03).** סכמה מורחבת, UI לקוח/בעלים/אדמין, workflow עם `wait`, פונקציית finalize |
| **`pushInAppNotification` מהדפדפן** | 🔴 **החמרה (08-03).** קריאות מרובות מ-customer/owner/superadmin |
| **תמחור אמצע־שבוע / סוף־שבוע** | 🟠 חדש. לוגיקה כספית נוספת, ללא בדיקות |
| **רכיבי UI חדשים** | 🟠 `/owner`, `/superadmin`, `/customer-portal`, `src/components/reviews/` |
| **חשיפת PII ב-`CustomerBookingsTab`** | 🟢 **תוקן חלקית** |
| **4 הפרצות הקריטיות האחרות** | 🔴 ללא שינוי (+ פרצות חדשות מביקורות) |
| **תשתית מקומית** | ⬜ ללא שינוי — אין git, אין `appId`, אין `node_modules`, אין בדיקות |

## A.2 — שינויים במבנה הריפו

### נמחק
- `migration-base44-zimmerpro-map.md` — **מסמך המיגרציה המקורי אינו קיים.** הנחת `ZimmerPro` (25-40 ימים) אינה ניתנת עוד לאימות.

### נוסף
| קובץ | תפקיד |
|---|---|
| `README.md` | הוראות הרצה Base44 |
| `AGENTS.md` / `CLAUDE.md` | הנחיות לסוכני קוד |
| `base44_removal_plan_3d453782.plan.md` | תוכנית הסרה (17 מילסטונים) |
| `docs/` | ביקורת, מיגרציה, תמונת מצב |

### לא נוסף (למרות שהתוכנית דורשת)
`server/`, `.env.local`, `.git/`, `node_modules/`, `public/manifest.json`, `src/api/client.js`, `docs/migration/`. **אף מילסטון לא בוצע.**

### נוסף מאז 2026-08-02 (גל ביקורות)
| קובץ / תיקייה | תפקיד |
|---|---|
| `src/components/reviews/` | `ReviewForm`, `ReviewsSection`, `OwnerReviewCard`, `ReviewActionModal`, `StarRating` |
| `src/components/customer/CustomerReviewsTab.jsx` | כתיבת ביקורת + פשרה מצד לקוח |
| `src/components/superadmin/SuperAdminReviewsPanel.jsx` | ניהול/מחיקה/יצירה ידנית |
| `src/hooks/useOwnerSystemUnread.js` | מונה התראות בעלים (read-set ב-localStorage) + `.subscribe()` |
| `base44/functions/finalizeReviewAutoPublish/` | פרסום אוטומטי אחרי המתנה |
| `base44/workflows/Review Auto Publish.jsonc` | entity create + `wait` PT12H/PT48H |

## A.3 — 🔴 `base44.agents.*` — Runtime של סוכן

בביקורת הקודמת: *"הסוכן אינו נקרא מאף מקום ב-`src/`."* **שגוי כעת.**

רכיב חדש: `src/components/owner/OwnerAgentChat.jsx` (283 שורות), טאב `assistant` ב-`/owner`.

| שורה | קריאה |
|---|---|
| 88 | `base44.agents.listConversations({ agent_name })` |
| 91 | `base44.agents.createConversation({ agent_name, metadata })` |
| 93 | `base44.agents.getConversation(id)` |
| 100 | `base44.agents.subscribeToConversation(id, cb)` |
| 123 | `base44.agents.addMessage(conversation, { role, content })` |

**הרחבת `zimmer_manager`:**

| | ביקורת קודמת | עכשיו |
|---|---|---|
| ישויות עם tools | 2 | **9** |
| ישויות עם `delete` | 1 | **5** (BookingRequest, Zimmer, UnansweredQuestion, Promotion, Contact) |
| פונקציות שרת | 0 | **3** |
| נקרא מהקוד? | ❌ | ✅ טאב ראשי |

**אבטחה:** מצב info/edit מיושם כתחילית `[מצב: מידע]`/`[מצב: עריכה]` בהודעת המשתמש (`OwnerAgentChat.jsx:9-12,122`). במצב עריכה — **"פעולות מתבצעות מיד"** ללא preview. אין אכיפה בשרת. `telegram_greeting` מאוכלס.

**נגזרת:** `react-markdown` נכנס לשימוש → חבילות לא־בשימוש ירדו מ-12 ל-11.

## A.4 — 🔴 סנכרון יומן Google דו־כיווני

1. **ישות `SyncState`** — `sync_token`, `last_sync_at`, `last_status`, `last_error`, `auto_sync`. סינגלטון גלובלי, ללא `owner_id`, ללא RLS.
2. **פונקציה `syncGoogleCalendar`** (126 שורות) — webhook ack, syncToken אינקרמנטלי, 410, pagination, עדכון `BookingRequest.check_in`/`check_out` / ניתוק `calendar_event_id`. מסלולי webhook ו-workflow **עוקפים `auth.me()`** ואז `asServiceRole`. יומן `primary` יחיד → כתיבה חוצת-דיירים.
3. **Workflows חדשים:**
   - `Google Calendar Auto Sync` — `trigger_type: scheduled`, cron `*/30 * * * *`, `Asia/Jerusalem`
   - `Google Calendar Sync` — `trigger_type: connector`, `googlecalendar` / `primary`
4. **`CalendarSyncCard.jsx`** — polling כל 30 שניות, מתג `auto_sync`, סנכרון ידני.

## A.5 — 🟠 תמחור אמצע־שבוע / סוף־שבוע

`bookingPrice.js` גדל ל-**147 שורות**. נוספו `weekdayOrWeekendPrice`, שדות `Zimmer.weekday_price` / `weekend_price`. סדר: תמחור חלקי ← תעריף יום-בשבוע ← מכפיל עונתי.

**חשד באג:** `getUTCDay()` על `dateStr + 'T00:00:00'` עלול להסיט תעריף ביום אחד בישראל (UTC+2/+3).

## A.6 — רכיבי UI חדשים

| רכיב | תפקיד |
|---|---|
| `OwnerAgentChat` | סוכן ניהול |
| `OwnerCalendar` | לוח שנה חודשי |
| `ReviewsPanel` | ביקורות בעלים — תגובה / פשרה / עררור |
| `ContactsBook` | CRUD ל-Contact |
| `FloatingPendingWidget` | ווידג'ט + **3 `.subscribe()`** |
| `CalendarSyncCard` | סטטוס סנכרון יומן |
| `MessagesPanel` | שידור SystemMessage מהדפדפן |
| `RecipientPicker` / `EditOwnerModal` | נמענים / עריכת owner כולל `role` |
| `InfoSummarySection` | תצוגת סיכום |
| `CustomerHistoryTab` / `CustomerProfileTab` / `DesktopSearchTab` | פורטל לקוח |
| `OwnerUpdatesPanel` | עדכונים + שאלות (שילוב `QuestionsPanel`) |
| `ScrollToTop` | גלילה בניווט |
| **`src/components/reviews/*`** 🆕 | טופס, כרטיס, מודאל, תצוגה ציבורית, כוכבים |
| **`CustomerReviewsTab`** 🆕 | כתיבת ביקורת לקוח + פשרה |
| **`SuperAdminReviewsPanel`** 🆕 | ניהול/מחיקה/יצירה ידנית |
| **`useOwnerSystemUnread`** 🆕 | מונה התראות owner + subscribe |

`OwnerPanel` — **11 טאבים**. `CustomerPortal` / `SuperAdminPanel` — טאב `reviews`. `App.jsx` — 4 redirects.

## A.6ב — 🔴 מערכת ביקורות מלאה (חדש 2026-08-03)

**סכמת `Review` הורחבה** למכונת מצבים: `pending_publish` (דירוג 4–5, auto 12ש׳) / `pending_owner` (1–3, 48ש׳) / `compromise_offered` / `published` / `disputed` / `removed`.

שדות חדשים: `customer_id`, `cat_*`, `images[]`, `auto_publish_at`, `reviewable_until`, `owner_response`, `dispute_reason`, `settlement_offer`. עדיין אין min/max על `rating`.

**זרימה:** לקוח יוצר → workflow `wait` → `finalizeReviewAutoPublish` → בעלים מגיב/מציע פשרה/מערער → לקוח מקבל/דוחה → סופר-אדמין מפקח. התראות דרך `pushInAppNotification` מהדפדפן.

**תשתית רקע חדשה:** workflow עם **`wait` ממושך** (PT12H/PT48H) — לא היה בתוכנית המיגרציה הקודמת.

## A.7 — ספירות מעודכנות

| מדד | מקורי | 08-02 | **עכשיו (08-03)** |
|---|---|---|---|
| שורות `src/` | 15,650 | ~16,405 | **~17,759** |
| קבצי `src/` | — | 137 | **145** |
| מייבאי `base44Client` | 54 | 57 | **62** (+DateSearchWidget = **63**) |
| ישויות | 13 | 14 | **14** |
| קריאות entities | ~150 | 156 ב-41 | **~178** ב-**45** |
| פונקציות שרת | 3 | 4 | **5** |
| Workflows | 8 | 10 | **11** |
| `.subscribe()` | 3 | 6 ב-4 | **7** ב-**5** |
| `functions.invoke` | 3 | 4 | **9** |
| `UploadFile` | 2 | 2 | **3** |
| `inviteUser` | — | 4 | **4** |
| `InvokeLLM` | 13 ב-11 | 13 ב-11 | **13 ב-11** ✅ |
| `loginWithProvider` | — | 12 ב-6 | **12 ב-6** |
| משטחי SDK | 5 | 6 | **6** |
| חבילות לא בשימוש | 12 | 11 | **11** |
| `@base44/sdk` | ^0.8.40 | ^0.8.41 | **^0.8.41** |
| קריאות `Review` | — | 5 | **18** |

**שורות InvokeLLM:** ZimmerCreatorChat:111, BookingCreatorChat:47, OwnerDashboard:96, CustomerChat:369+559.

## A.8 — מה תוקן

**12.3 חשיפת PII — חלקית:**
```js
// CustomerBookingsTab.jsx:32 — היה list(500), עכשיו:
BookingRequest.filter({ created_by_id: user.id }, '-created_date', 500)
```
גם ב-`CustomerUpdatesTab.jsx:31,33`.

**עדיין פתוח:** `CustomerQuestionsTab` (קוד מת — אינו מחובר ל-portal), `UpdatesPopover`, `VacationAgentChat`, `DateSearchWidget`, `SuperAdminDashboard`, `BookingsList`, `SuperAdminReviewsPanel.list(500)`.

## A.9 — מה לא השתנה (אומת)

`vite.config.js`, `jsconfig.json`, `eslint.config.js`, `base44Client.js`, `AuthContext.jsx`, `app-params.js`, אין StrictMode/ErrorBoundary, אין git/node_modules/.env.local, `leaflet` לא מוצהר, קוד מת (4 דפי auth, ProtectedRoute, ZimmerDetailInline, OwnerRequest, **CustomerQuestionsTab**), משתני מודול ב-`CustomerChat`, אפס בדיקות.

## A.10 — סיכונים חדשים

| # | סיכון | חומרה |
|---|---|---|
| N1 | מצב עריכה של הסוכן ללא אכיפה בשרת; delete על 5 ישויות | 🔴 קריטי |
| N2 | webhook ב-`syncGoogleCalendar` עוקף auth + asServiceRole | 🔴 קריטי |
| N3 | SyncState סינגלטון ללא RLS | 🟠 גבוה |
| N4 | סנכרון יומן כותב חוצה־דיירים | 🟠 גבוה |
| N5 | EditOwnerModal — `role: admin` מהדפדפן | 🟠 גבוה |
| N6 | MessagesPanel — owner משדר SystemMessage לכולם | 🟠 גבוה |
| N7 | באג timezone אפשרי בתעריף סוף־שבוע | 🟠 גבוה |
| N8 | מכונת ביקורות ללא RLS; create/update מהדפדפן | 🟠 גבוה |
| N9 | `finalizeReviewAutoPublish` ללא auth + asServiceRole | 🔴 קריטי |
| N10 | `pushInAppNotification` נקרא ישירות מלקוח/בעלים (החמרה) | 🔴 קריטי |
| N11 | list/filter רחבים בביקורות | 🟡 |

---

# חלק חדש B — השפעה על תוכנית המיגרציה

תוכנית `docs/migration-plan.md` (מבוססת על `base44_removal_plan`) — **אף מילסטון לא בוצע**, אך היקף העבודה שהיא מתארת אינו תואם עוד את הפרויקט.

## B.1 — הפערים המרכזיים

1. **הסוכן** — טאב פעיל; נדרש מילסטון 16 או זניחה מפורשת.
2. **מערכת ביקורות + `wait` workflows** (08-03) — מכונת מצבים, פונקציית finalize, המתנות 12/48ש׳. מילסטון 9 גדל; נדרש scheduler עם delayed jobs.

## B.2 — השפעה מילסטון־אחר־מילסטון

| מילסטון | השפעה |
|---|---|
| -1 | ⬜ ללא שינוי — עדיין חוסם |
| 0 | 🟠 fixtures ל-14 ישויות + agents + Review lifecycle payloads |
| 1 | 🔴 facade חייב לחשוף `agents` |
| 2 | 🟠 **62** מייבאים (+DateSearchWidget=63); אצווה reviews חדשה; superadmin=9; customer=6; hooks=4 |
| 3 | ⬜ |
| 4 | 🟠 Review מורחב (JSONB nested `settlement_offer`) |
| 4.5 | 🟠 Review ללא rls — מדידה + שחזור |
| 5 | 🟠 +EditOwnerModal למרשם |
| 6 | 🔴 **7** מנויים + `subscribeToConversation` |
| 7 | ⬜ |
| 8 | 🔴 sync מלא (4-5 ימים) |
| 9 | 🔴 **11** workflows; **wait** PT12H/PT48H; סתירת endpoint; +finalize |
| 10 | 🟠 טענת "סוכן לא בשימוש" שגויה |
| 11 | 🟠 UploadFile ×**3** (כולל ReviewForm) |
| 12–14 | 🟠 עדכוני ספירה |
| 15 | 🟠 פריטים 16–24 |
| **16** | 🔴 runtime סוכן — 5-8 ימים |

## B.3 — פריטים חדשים למרשם הדחוי

| # | פריט | עדיפות |
|---|---|---|
| 16 | אכיפת info/edit בשרת | 🔴 |
| 17 | אימות webhook | 🔴 |
| 18 | SyncState + owner_id + RLS | 🟠 |
| 19 | EditOwnerModal role whitelist | 🔴 |
| 20 | SystemMessage.create ל-admin בלבד | 🟠 |
| 21 | בדיקת timezone בתעריף סוף־שבוע | 🟠 |
| 22 | auth ל-`finalizeReviewAutoPublish` | 🔴 |
| 23 | RLS / מעברי סטטוס ל-Review בשרת | 🔴 |
| 24 | חסימת `pushInAppNotification` מלקוח רגיל | 🔴 |

## B.4 — הערכה מעודכנת

| | מקורי | 08-02 | **08-03** |
|---|---|---|---|
| מיגרציה (-1..14) | 24-30 | 32-40 | **34-43** |
| סוכן (מילסטון 16) | — | 5-8 | **5-8** |
| מרשם דחוי (15) | 12-16 | 14-19 | **16-22** |
| **סה"כ** | 36-46 | 51-67 | **55-73 ימים** |

**הכרעות לפני חידוש תכנון:** (1) האם משחזרים את הסוכן; (2) cron-only מול webhook מאומת; (3) האם משחזרים wait-jobs לביקורות או מפשטים.

---

# חלק 1 — ארכיטקטורת הפרויקט

### ארכיטקטורה כללית
**SPA בלבד.** אין שרת אפליקציה בריפו. Frontend + הגדרות דקלרטיביות ב-`base44/`. ✏️ התלות העמיקה: runtime סוכן, scheduler, webhook.

### Frontend
- React 18.2, react-router-dom 6.26, TanStack Query 5.84 (**כמעט לא בשימוש** — רק PageNotFound)
- Tailwind 3.4 + shadcn/Radix (~45 רכיבי ui)
- framer-motion, lucide-react, react-leaflet + leaflet
- ✏️ **react-markdown** — בשימוש ב-OwnerAgentChat

### Backend
- ✏️ **5** פונקציות Deno
- ✏️ **11** workflows (8 entity + 1 scheduled + 1 connector + **1 entity+wait לביקורות**)
- ✏️ **14** סכמות ישויות
- סוכן `zimmer_manager` — **פעיל בממשק**

### מבנה תיקיות (מעודכן)
```
/
├── base44/          # agents, connectors, entities(14), functions(5), workflows(11)
├── docs/            # project-audit, migration-plan, PROJECT_STATE, PROJECT_MASTER
├── public/          # google verification בלבד
├── src/
│   ├── api/base44Client.js
│   ├── components/  # admin, chat, customer, desktop, owner, reviews, superadmin, ui
│   ├── hooks/ lib/ pages/ utils/
│   ├── App.jsx main.jsx index.css
├── vite.config.js package.json README.md AGENTS.md CLAUDE.md
└── base44_removal_plan_3d453782.plan.md
```

### Build
Vite 6.1 + `@base44/vite-plugin` (proxy, analytics, visual-edit, HMR/nav) + react. ✅ זהה לביקורת הקודמת.

### נקודות כניסה
`index.html` → `main.jsx` → `App.jsx` (`AuthProvider` → `QueryClientProvider` → `Router` → `ScrollToTop` ✏️ → `AuthenticatedApp`). אין StrictMode.

### ניתוב
11 נתיבים פונקציונליים + 4 redirects לתאימות. ציבוריים: `/`, `/welcome`, `/admin-login`.

### תקשורת Frontend ↔ Backend
`base44Client.js` — `serverUrl: ''`, `requiresAuth: false`. חריג: `AuthContext` → `createAxiosClient` מנתיב פנימי של SDK → `public-settings`.

---

# חלק 2 — ניתוח תלויות Base44

נקודת חיבור יחידה: `src/api/base44Client.js` — **62 מייבאים + DateSearchWidget = 63 צרכנים**.

## 2.1 `base44.entities.*`
14 ישויות, ~178 קריאות ב-45 קבצים. API: list/filter/get/create/update/delete/subscribe.

**התפלגות:** BookingRequest 38, Zimmer 37, UnansweredQuestion 19, **Review 18** 🆕, Promotion 11, DirectChat 11, SystemMessage 10, ChatSession 9, User 8, CustomerProfile 6, AdminPermission 5, Contact 3, SyncState 3, OwnerRequest 1.

**קריאות בעייתיות:** ראה A.8; נוספו filter/list בביקורות (SuperAdminReviewsPanel.list 500), OwnerCalendar, ContactsBook, FloatingPendingWidget, OwnerDashboard, MessagesPanel, BookingsList ללא limit.

## 2.2 שדות מטא סמויים
`id`, `created_date`, `updated_date`, `created_by_id`, `created_by`, `role`/`full_name`/`email`/`phone`/`business_name`/`notifications` על User. ✏️ `created_by_id` הפך לשדה הרשאה בפועל אחרי תיקון CustomerBookingsTab.

## 2.3 `base44.auth.*`
12 מתודות: me×14, loginWithProvider×12 (6 קבצים), logout×9, updateMe×3, וכו'.

## 2.4 `base44.users.inviteUser`
4 מקומות: SuperAdminPanel:85, AddOwnerPanel:25 (`owner`), CustomersPanel:43 (`user`), JoinAsOwner:21 (try/catch ריק).

## 2.5 `base44.integrations.Core.*`
InvokeLLM ×13, UploadFile ×**3** (ZimmerCreatorChat:51, ZimmerEditor:51, **ReviewForm:39** 🆕).

## 2.6 `base44.functions.invoke`
addBookingToCalendar ×2, geocodeAddresses ×1, syncGoogleCalendar ×1, **pushInAppNotification ×5 מהדפדפן** 🆕 (ReviewsPanel, CustomerReviewsTab×3, SuperAdminReviewsPanel). finalizeReviewAutoPublish — רק מ-workflow. סה״כ אתרי invoke בקוד: **9**.

## 2.7 `base44.asServiceRole.*`
BookingRequest, SystemMessage, SyncState, **Review** 🆕 (finalize), connectors.getConnection.

## 2.8 `.subscribe()`
7 אתרים ב-5 קבצים: useUnreadNotifications (SystemMessage), **useOwnerSystemUnread (SystemMessage)** 🆕, DirectChat, FloatingQuestionsWidget (UnansweredQuestion), FloatingPendingWidget ×3 (BookingRequest, UnansweredQuestion, DirectChat).

## 2.9 🆕 `base44.agents.*`
ראה A.3. מורכבות החלפה: **גבוהה מאוד**.

## 2.10 תלויות סמויות
vite-plugin, axios-client פנימי, public-settings, URL params, media.base44.com, favicon, `.app.jsonc` חסר, RLS 2/14, workflows DSL (**כולל wait**), connector OAuth, functionsVersion, **scheduler**, **connector-webhook**, **`_provider_meta`**, **delayed jobs לביקורות**.

---

# חלק 3 — מסד נתונים

DB לא ידוע מהקוד — מנוהל ב-Base44. 14 סכמות JSON Schema. אין migrations.

| ישות | RLS | הערות |
|---|---|---|
| Zimmer | ❌ | +weekday/weekend_price; אין lat/lng; default approval=אושר |
| BookingRequest | ❌ | תאריכים string |
| ChatSession | ❌ | |
| DirectChat | ✅ מלא | |
| SystemMessage | ⚠️ read פתוח | create ל-admin או owner |
| UnansweredQuestion | ❌ | |
| Promotion | ❌ | format:date |
| Review | ❌ | **מכונת מצבים**; rating ללא min/max; settlement_offer מקונן |
| Contact | ❌ | |
| CustomerProfile | ❌ | |
| OwnerRequest | ❌ | נכתבת, לא נקראת |
| AdminPermission | ❌ | ישות הרשאות |
| User | ❌ | רק role |
| **SyncState** 🆕 | ❌ | סינגלטון גלובלי |

Enums בעברית. כיוון מיגרציה: PostgreSQL + Prisma + JSONB (לפי תוכנית). ייצוא נתונים **בוטל** — נתוני דמו.

---

# חלק 4 — שרת

### ארכיטקטורה
CRUD אוטומטי + 5 פונקציות Deno + 11 workflows + runtime סוכן + delayed wait לביקורות.

### פונקציות

**addBookingToCalendar** (SDK 0.8.38, Deno.serve) — auth.me כן; בעלות לא; יומן primary יחיד; אין idempotency.

**geocodeAddresses** (0.8.40, Deno.serve) — Nominatim ללא throttling/cache/delay.

**pushInAppNotification** (0.8.40, export default) — **ללא auth**; asServiceRole; ולידציה: `if (!title)`. ✏️ נקרא גם מהדפדפן (9 אתרי invoke כולל ביקורות).

**syncGoogleCalendar** (0.8.40, export default) — webhook/workflow עוקפים auth; asServiceRole; syncToken+410+pagination; כתיבה ל-BookingRequest מיומן יחיד.

**finalizeReviewAutoPublish** 🆕 (0.8.40, export default) — **ללא auth**; asServiceRole; מפרסם Review אם עדיין `pending_publish`/`pending_owner`; נקרא רק מ-workflow אחרי wait.

### Auth / Authz
Google OAuth ראשי; Email+OTP קיים אך ללא routes. RLS רק על 2/14. Superadmin — בדיקת לקוח בלבד. ✏️ שכבה רביעית חלשה: מצב סוכן כמחרוזת prompt.

### רקע
✏️ יש cron (`*/30`), יש webhook connector, יש agent memory, יש **workflow wait** (PT12H/PT48H) לביקורות. פקיעת מבצעים עדיין פסאודו-cron בצד לקוח (`PromotionsPanel`).

---

# חלק 5 — משתני סביבה

4 משתני Base44 בלבד. אין `.env`/`.env.local`/`.env.example`.  
`VITE_BASE44_APP_ID` — **חוסם הרצה**.  
אחרי מיגרציה: DATABASE_URL, JWT_SECRET, GOOGLE_*, OPENAI_/GEMINI_, S3_*, SMTP_*, CORS, GOOGLE_CALENDAR_WEBHOOK_TOKEN, דגלי VITE_BACKEND_*.

---

# חלק 6 — שירותים חיצוניים

Base44 (קריטי), Google OAuth, Google Calendar (✏️ דו־כיווני — מאמץ גבוה), Nominatim, OSM Tiles, LLM via Base44, File Storage, media.base44.com, Google Fonts, Search Console.  
Stripe מותקן ולא בשימוש.

**11 חבילות לא בשימוש:** stripe×2, canvas-confetti, html2canvas, jspdf, three, react-quill, moment, hello-pangea/dnd, lodash, react-hot-toast.  
**חסר:** leaflet (מיובא, לא מוצהר).

---

# חלק 7 — ניתוח AI

### שני מסלולים
1. **InvokeLLM** — 13 קריאות, 8 עם schema / 5 טקסט. אין הפרדת system/user. prompt injection פתוח. קריאה #7 (OwnerInfoAssistant) → פעולות DB עם preview.
2. **agents / zimmer_manager** 🆕 — tool-calling נטיבי, 9 ישויות, delete על 5, 3 פונקציות, ללא אישור במצב עריכה, זיכרון scope:both, טלגרם מאוכלס.

אין rate-limit/cache/debounce. CustomerChat שולח את כל הצימרים+data_zones בכל הודעה.

---

# חלק 8 — תשתית רקע

| רכיב | קודם | עכשיו |
|---|---|---|
| Webhooks נכנסים | ❌ | ✅ connector Google Calendar |
| Cron | ❌ | ✅ `*/30 * * * *` |
| Delayed wait (workflows) | ❌ | ✅ PT12H / PT48H (ביקורות) |
| Event listeners שרת | 8 | **11** |
| Event listeners לקוח | 3 | **7** |
| Agent runtime | — | ✅ |
| Polling | — | CalendarSyncCard 30s, OwnerAgentChat 800ms |
| Queues/Redis/Workers | ❌ | ❌ (wait מנוהל ב-Base44) |

8 workflows ישותיים ללא שינוי (התראות). +2 יומן. +1 ביקורות (entity create + wait + finalize). תלות ב-`old_data` נשמרת.

---

# חלק 9 — פיצ'רים מנוהלים ע"י Base44 (חסרים בייצוא)

קריטיים: `.app.jsonc`/appId, secrets, RLS ברירת-מחדל ל-12 ישויות, נתוני פרודקשן (אך הוחלט על דמו), תצורת סוכן/tool_calls, scheduler, רישום push channel, `_provider_meta`.  
גבוהים: hosting, vite-plugin internals, analytics, תמונות, connector tokens.  
manifest.json → 404. אין git.

---

# חלק 10 — הרצה מקומית

| בדיקה | תוצאה |
|---|---|
| Node | v22.22.0 ✅ |
| npm | 10.9.2 |
| node_modules / .env.local / .app.jsonc / manifest / git / CLI / server | ❌ כולם חסרים |

חוסמים: appId, npm ci, CLI, leaflet, אין git (אין rollback), jsconfig/eslint עיוורים, 🆕 חיבור Google Calendar ל-sync.

---

# חלק 11 — מיגרציה לעצמאות

**אפשרית** דרך adapter יחיד (`client.js`) — 63 צרכנים מאחורי seam אחד.  
**סייג:** חוזה `agents` אינו CRUD פשוט — runtime מלא. בנוסף: delayed jobs לביקורות.

| # | רכיב | מאמץ מעודכן |
|---|---|---|
| 1 | entities ×14 | 5-8 ימים |
| 2 | auth ×12 | 4-6 |
| 3 | inviteUser ×4 | 1-2 |
| 4 | InvokeLLM ×13 | 4-6 |
| 5 | UploadFile ×3 | 2 |
| 6 | functions ×5 | 3-5 |
| 7 | subscribe ×7 | 3-5 |
| 8 | workflows ×11 + cron + webhook + wait | 5-8 |
| 9 | RLS ×14 | 4-6 |
| 10–13 | vite/plugin/settings/hosting | ~5 |
| 14 | ייצוא נתונים | **0** (דמו) |
| **15** | **agents runtime** | **5-8 / 0** |

**סה"כ משוער:** 60-88 ימי עבודה (היה 56-82 ב-08-02). תוכנית המילסטונים: **55-73** כולל דחויים.

סיכונים קריטיים: RLS לא ידוע, appId חסר, שדות מטא, runtime סוכן לא מתועד, push channel לא בקוד, finalize ללא auth, מכונת ביקורות.

---

# חלק 12 — אבטחה

## 12.1 Secrets בקוד — ✅ אין (נקודת חוזק)

## 12.2 🔴 AdminPermission ללא RLS + create מהדפדפן — ללא שינוי
הסלמת הרשאות. השער היחיד: `setAccessDenied` ב-React.

## 12.3 🟢 חשיפת BookingRequest — תוקן חלקית
filter לפי created_by_id ב-CustomerBookingsTab/UpdatesTab. עדיין list/filter רחבים במקומות אחרים. התיקון תלוי ב-RLS שרת שלא אומת.

## 12.4 🔴 SystemMessage.read:{} — ללא שינוי + החמרה
תוכן צ'אט ב-body. ✏️ MessagesPanel: owner יכול create/delete מהדפדפן.

## 12.5 🔴 pushInAppNotification ללא auth — ללא שינוי + **החמרה**
✏️ הסוכן קיבל גישה מפורשת; בנוסף נקרא מ-`CustomerReviewsTab` / `ReviewsPanel` / `SuperAdminReviewsPanel` מהדפדפן.

## 12.6 🟠 addBookingToCalendar ללא בעלות — ללא שינוי

## 12.7 🟠 Prompt injection — ללא שינוי + החמרה
OwnerAgentChat + delete על 5 ישויות = injection → מחיקת נתונים.

## 12.8 🟠 approval_status default=אושר — ללא שינוי

## 12.9 🟠 User.delete + EditOwnerModal role:admin — החמיר

## 12.10 🔴 syncGoogleCalendar — עקיפת auth + כתיבה חוצת-דיירים — חדש

## 12.11 🟠 SyncState סינגלטון גלובלי — חדש

## 12.12 🔴 finalizeReviewAutoPublish ללא auth + asServiceRole — חדש (08-03)

## 12.13 🟠 מכונת ביקורות ללא RLS / אכיפת מעברי סטטוס — חדש (08-03)

## 12.14 ולידציה חסרה
zod לא בשימוש; תאריכים/email/rating/discount; total_price מ-6 מקומות בלקוח; תנאי-מרוץ הזמנות; weekday/weekend ללא minimum; SyncState ללא required; settlement_offer ללא אכיפה.

## 12.15 אימות חסר
4 דפי auth ללא route; ProtectedRoute לא בשימוש; requiresAuth:false; auth.me×14.

## 12.16 פרודקשן
noindex גלובלי; manifest 404; alert×9 + prompt + confirm; אין ErrorBoundary/StrictMode/CSP/monitoring; catch ריקים×10; polling 800ms.

---

# חלק 13 — חוב טכני

### ארכיטקטורה
אין data-access layer; react-query כמעט לא בשימוש; אין state גלובלי; סינון בלקוח; ולידציה בלקוח; jsconfig/eslint עיוורים; Layout.jsx חסר; three מיותר; כפילות Dashboard↔FloatingPending; שני סוכני owner סותרים; בקרת גישה כמחרוזת.

### Bad practices
catch ריקים, useEffect deps, משתני מודול ב-CustomerChat, Date.now+random keys×17, alert/prompt, inline styles, צבעים hardcoded, toISOString.split×16, getUTCDay חשוד, לופ await, מחרוזות עברית כלוגיקה, 3 מערכות toast, moment+date-fns, formatTime ב-9 קבצים.

### כפילויות
CustomerChat↔SearchChat; zimmerContext×4; Updates tabs; QuestionsPanel↔FloatingQuestions; BookingsList↔OwnerBookingsList; 3 מסלולי יצירת הזמנה; OwnerInfoAssistant↔OwnerAgentChat; OwnerCalendar↔OwnerBookingsList.

### קוד מת
Login/Register/Forgot/Reset + AuthLayout; ProtectedRoute; ZimmerDetailInline; use-mobile (דרך sidebar מת); ~40 רכיבי ui; OwnerRequest; **CustomerQuestionsTab** (אינו מחובר ל-portal); utils/createPageUrl; BASE44_LEGACY.  
~~zimmer_manager~~ — **הוסר מרשימת המתים**. ~~getBookedRangesForZimmer~~ — בשימוש.

### קבצים גדולים
CustomerChat 835; sidebar 574 (מת); SuperAdminPanel; OwnerDashboard; OwnerInfoAssistant 410; OwnerBookingsList 406; ZimmerEditor 358; OwnerPanel; OwnerAgentChat 283; CustomerReviewsTab 280; SuperAdminReviewsPanel 237.

### מימושים מסוכנים
ראה 12 + A.10; sync כותב check_in/out מ-Google; תעריף סוף-שבוע; EditOwnerModal; MessagesPanel.

---

# חלק 14 — בדיקות

**אפס בדיקות.** אין vitest/jest/playwright/script test/CI. פער גדל (+~2.1K שורות מאז המקור, תמחור, סוכן, מכונת ביקורות).

**עדיפות 1:** bookingPrice (כולל weekdayOrWeekendPrice); datesOverlap; infoSummary; regions.  
**עדיפות 2:** AuthContext; subscriptions; LLM mocks; syncGoogleCalendar; OwnerAgentChat; CalendarSyncCard; **מכונת סטטוסי Review + finalize + wait**.  
**עדיפות 3 E2E:** זרימות לקוח/בעלים/אדמין + sync יומן + סוכן + **ביקורת→פשרה→פרסום**.  
**ידני חדש:** timezone תמחור; cron 30 דק'; בידוד דיירים; EditOwnerModal; עקיפת `[מצב: עריכה]`; **auto-publish אחרי 12/48ש׳**.

צ'קליסט A–F אחרי כל צעד מיגרציה — מורחב ל-14 ישויות, 5 פונקציות, 11 workflows, agents, wait-jobs, אבטחת webhook/role/SystemMessage/Review.

---

# חלק 15 — מפת דרכים למיגרציה

מקור מחייב: `docs/migration-plan.md`. תמונת-על:

0. הבטחת מצב (git, appId, הקלטת agents, תיעוד push channel) — 1-2 ימים  
1. אבטחה על Base44 (כולל SyncState, sync auth, צמצום סוכן, finalize/Review) — 4-7  
2. היגיינה — 2-3  
3. בדיקות bookingPrice — 3-5  
4. Adapter (+agents) — 3-5  
5. DB+CRUD ×14 — 6-9  
6. Auth+Authz — 8-12  
7. AI proxy — 6-9  
**7ב. Agent runtime** — 5-8  
8. Storage — 3-4  
9. Functions+sync+finalize — 7-11  
10. Realtime+workflows+cron+webhook+**wait** — 10-15  
11. ניקוי Base44 — 2-3  
12. Deploy+CI — 3-5  
13. חוב טכני — 8-12  

**סה"כ: 60-88 ימי עבודה.**

---

# חלק 16 — צ'קליסט סופי

### 🔴 קריטי
- [ ] git init + tag  
- [ ] VITE_BASE44_APP_ID + .env.local  
- [ ] תיעוד OAuth + push channel + אובייקט שיחת סוכן  
- [ ] בירור RLS ברירת-מחדל ל-12 ישויות  
- [ ] rls על AdminPermission, BookingRequest, User, SyncState, **Review**  
- [ ] SystemMessage.read סינון בשרת; create ל-admin בלבד  
- [ ] auth ב-pushInAppNotification, syncGoogleCalendar, **finalizeReviewAutoPublish**  
- [ ] בעלות ב-addBookingToCalendar  
- [ ] צמצום delete ב-zimmer_manager; אכיפת info/edit בשרת  
- [ ] הכרעה: שחזור סוכן? webhook מול cron-only? **wait-jobs לביקורות?**  
- [ ] npm ci + leaflet + CLI  
- [ ] Adapter לפני החלפות  

### 🟠 חשוב
- [ ] rls על ישויות נוספות; ולידציה שרת; total_price בשרת; אילוץ ייחודיות הזמנות  
- [ ] הפרדת prompts; סניטציית data_zones  
- [ ] בדיקות bookingPrice + timezone + **Review lifecycle**  
- [ ] הסרת 11 חבילות; תיקון jsconfig/eslint; ErrorBoundary; StrictMode  
- [ ] cron לפקיעת מבצעים; lat/lng + throttling Nominatim  
- [ ] manifest.json; limit על filters חדשים  
- [ ] אכיפת מעברי סטטוס ביקורת בשרת  

### 🟢 אופציונלי
פיצול/מיזוג צ'אטים וסוכנים; react-query; auth.me פעם אחת; useRef במקום module state; formatTime ל-lib; theme; lazy; toast אחד; אינדוקס promotions; OwnerRequest; מחיקת CustomerQuestionsTab.

---

# מידע שחסר בקוד

### חוסמים
1. appId  
2. ~~ייצוא נתונים~~ — בוטל (דמו)  
3. RLS ברירת-מחדל ל-12/14  
4. פרוטוקול agents.* המלא (tool_calls, subscribe, זיכרון)
5. דיוק/אמינות workflow `wait` ב-Base44 (האם שורד restart?)

### DB / Auth / AI / Functions / Realtime / Deploy
סמנטיקת filter/list/update; מודל LLM בפועל; gemini_3_flash mapping; automatic model; עלויות; האם allowed_operations נאכף; טלגרם פעיל?; דיוק scheduler; מי רושם push channel; `_provider_meta`; analytics GDPR; האם role:admin עובר מ-EditOwnerModal; האם weekday/weekend מאוכלסים; האם finalize ניתן לקריאה חיצונית.

~~ZimmerPro~~ — מסמך נמחק; הנחה בטלה.

---

**סיכום בשורה אחת:** Frontend נקי יחסית (React+Vite, ~17.8K שורות) שכל התשתית שלו ב-Base44, עם צוואר בקבוק יחיד למיגרציה דרך adapter — אך התלות העמיקה בסוכן פעיל, scheduler/webhook, **ומערכת ביקורות עם wait+finalize ללא auth**; ההערכה עלתה ל-**55-73 ימי מילסטונים** (או 60-88 בראייה רחבה); מתוך הפרצות הקריטיות אחת תוקנה חלקית, ארבע נשארו, ונוספו פרצות ביקורות/`pushInAppNotification` מהדפדפן; ועדיין אין Git, אין appId ואין בדיקות.
