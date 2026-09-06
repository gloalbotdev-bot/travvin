# Security Audit — Travvin

> Audit בלבד — ללא שינוי קוד. תאריך: 2026-08-31  
> מבוסס על קריאת קוד ב-repo + [technical-architecture-map.md](./technical-architecture-map.md)

---

## Executive Summary

נמצאו **2 ממצאים CRITICAL** ו-**8 HIGH** המבוססים על הקוד:

1. **Authentication bypass** על `/api/entities/*` דרך headers `x-user-id` / `x-user-role` (ללא JWT).
2. **User entity ללא RLS** — enumeration / מחיקה / יצירת משתמשים (כולל `role: admin`) ללא אימות.

בנוסף: ~~**`POST /api/ai/invoke-llm` פתוח לחלוטין**~~ (SEC-005 fixed), ~~**`syncGoogleCalendar` bypass**~~ (SEC-006 fixed), ~~**entities ללא RLS** (`Promotion`, `OwnerRequest`)~~ (SEC-003/004 fixed).

---

## חלק א — Endpoint Security (סיכום)

| Endpoint group | Auth required? | Enforced? | Authz | Guest access | הערה |
|----------------|---------------|-----------|-------|--------------|------|
| `GET /api/health` | No | N/A | No | Yes | מכוון |
| `/api/auth/*` | Mixed | JWT / credentials | Partial | Mixed | `access_token` ב-URL redirect |
| `GET /api/app/public-settings` | Optional | Yes | No | Yes | מכוון |
| `POST /api/users/invite` | Yes (JWT) | Yes (`req.user`) | Admin role | No | OK |
| `/api/entities/*` | **No** | **Headers/JWT** | RLS per entity | **Yes** | **Bypass via headers** |
| `GET /api/bookings/busy` | No | N/A | No | Yes | מכוון (ללא PII) |
| `GET /api/events/entities/:entity` | Yes (JWT) | Yes | RLS on SSE | No | token ב-query |
| `/api/functions/*` | Mostly yes | Yes (`req.user`) | In lib | Partial | `_from_workflow` bypass |
| `POST /api/ai/invoke-llm` | **No** | **No** | **No** | **Yes** | **CRITICAL abuse** |
| `POST /api/upload` | Yes (JWT) | Yes | Any authed role | No | OK |
| `/api/connectors/google-calendar/*` | Mixed | JWT / signed state | Owner | Callback open | OAuth state signed |

---

## חלק ב — Generic Entity API (זרימה)

```
HTTP request
  → cors + express.json(2mb)
  → attachAuthUser (JWT → req.user + req.actor)     ← רק JWT
  → attachActor (אם אין req.actor: x-user-* headers) ← ⚠️ TRUST BOUNDARY
  → entities router
  → entity-store (validatePayload → assertCan → Prisma)
  → redactRecord (חלקי)
```

### יכולות תקיפה (מאומתות בקוד)

| Attack | אפשרי? | סיבה |
|--------|--------|------|
| בחירת entityType | כן (כל schema ידוע) | `GET /api/entities` מחזיר רשימה |
| קריאת entity של אחר | **תלוי entity** | User/Promotion: כן (ללא RLS). Booking: לא (RLS) |
| create עם owner_id מזויף | **כן** | BookingRequest, UnansweredQuestion — create בודק `authenticated` בלבד |
| update owner_id | **כן** | Zimmer merge — אין strip על `owner_id` ב-patch |
| שדות immutable | **חלקי** | AUTO_FIELDS בלבד; `approval_status`, `status` ניתנים ל-patch |
| delete של אחר | **כן** | User entity — ללא RLS |
| עקיפת RLS via filter | **לא ישירות** | `readScopeWhere` AND עם query |
| mass assignment | **כן** | Zod `.passthrough()` ב-schema-loader |
| entity ללא schema | לא | 404 מ-schema-loader |
| entity ללא RLS | **כן — exploit** | User, Promotion, OwnerRequest |

---

## חלק ג — AI Security (`POST /api/ai/invoke-llm`)

| בדיקה | ממצא |
|-------|------|
| חייב protected? | **כן** — מפתח Gemini + עלות |
| Anonymous LLM calls? | **כן** — `auth: false` ב-client וב-route |
| Unlimited calls? | **כן** — אין rate limit |
| Rate limiting? | **לא** |
| Body limit | `2mb` (express.json גלובלי) |
| Arbitrary model? | **כן** — `payload.model` → `resolveModel()` |
| Malicious JSON schema? | **Potential** — schema מומר ל-Gemini; fallback append to prompt |
| `add_context_from_internet` | **כן** — מפעיל Google Search grounding (עלות+) |
| Secrets ל-frontend? | **לא** — `GEMINI_API_KEY` server-only |
| Prompt injection → mutations? | **כן** — דרך frontend parser (ראה חלק ד) |
| Server validation לפני mutation? | **לא על invoke-llm** — stateless proxy |

---

## חלק ד — AI → Mutation (Trust Boundaries)

### CustomerChat

```
LLM JSON (action/booking/unanswered_question)
  → CustomerChat.jsx parser (frontend)
  → api.entities.BookingRequest.create / UnansweredQuestion.create
  → entity-store + RLS
  → DB
```

| שלב | Authorization |
|-----|---------------|
| LLM | None (public endpoint) |
| Parser | Frontend only |
| Mutation | Server RLS — **create מאפשר owner_id מזויף**; guest create נחסם (authenticated required) |

**Trust boundary בעייתית:** LLM + frontend orchestration; אין server-side action whitelist.

### OwnerInfoAssistant

```
LLM JSON (operation)
  → OwnerInfoAssistant.jsx
  → api.functions.executeOwnerAssistantOp (JWT)
  → owner-assistant-ops.js whitelist + ownership
  → DB
```

**Hardened path** — edit mode mutations דרך whitelist בשרת. Info mode: `operation=null` enforced ב-prompt בלבד (לא בשרת).

### AdminAssistantChat

```
LLM JSON (changes)
  → AdminAssistantChat.jsx → user confirms
  → api.entities.Zimmer.update (JWT)
  → RLS (owner of zimmer)
  → DB — **ללא field whitelist**
```

**Trust boundary בעייתית:** LLM יכול להציע `data_zones`, `approval_status`, `stay_settings` — כל שדה schema עובר ל-update.

### BookingCreatorChat

```
LLM JSON (booking)
  → BookingCreatorChat.jsx → owner confirms
  → api.entities.BookingRequest.create (JWT)
  → DB — **status אושרה/ממתינה מה-LLM, ללא transition guard**
```

**Trust boundary בעייתית:** bypass של `executeOwnerAssistantOp`; owner יכול ליצור הזמנות מאושרות ישירות (ייתכן מכוון ל-owner workflow).

### ZimmerCreatorChat

```
LLM JSON (zimmer_data)
  → onSave → api.entities.Zimmer.create
  → RLS (owner_id must match user.id on create)
  → DB
```

**Partially hardened** — create RLS; אין server field whitelist (שונה מ-executeOwnerAssistantOp).

---

## חלק ה — IDOR / BOLA (סיכום)

| Identifier | Forgeable on create? | Cross-user read? | Cross-user write? |
|------------|---------------------|------------------|-------------------|
| `userId` / User.id | N/A | **כן (User.list)** | **כן (User.delete)** |
| `owner_id` | **כן** (Booking, Question) | Via header spoof as admin | Via header spoof |
| `zimmer_id` | Schema required | Open read (Zimmer) | RLS owner/admin |
| `booking_id` | — | RLS | RLS (+ status bypass) |
| `customer_id` | Review create checks match | RLS | RLS |
| record UUID | — | GET + assertCan | PATCH + assertCan |

---

## חלק ו — Authentication (סיכום)

| נושא | ממצא |
|------|------|
| JWT creation | `signToken` — sub, email, role |
| JWT verification | `verifyToken` — HS256, `JWT_SECRET` |
| Default secret | **`dev-only-change-me`** if env missing |
| Expiration | `JWT_EXPIRES_IN` default 7d |
| Role in JWT | **Trusted for functions**; **entities use spoofable headers** |
| Token storage | localStorage |
| Query-string token | SSE `?token=`, OAuth `?access_token=` |
| Google OAuth | Role intent on signup; role_mismatch redirect |
| Logout | Clears token + `cc_state_v1` |
| OTP | 6-digit, 15min TTL; **logged to console** if no SMTP |
| Password reset | Token 1h; always-200 on request |
| Privilege escalation | **User entity create + header spoof admin** |

---

## חלק ז — Internal Endpoints

| Endpoint | HTTP | מוגן? |
|----------|------|-------|
| `pushInAppNotification` | 403 | ✅ |
| `finalizeReviewAutoPublish` | 403 | ✅ |
| `sendStayMessages` | 403 | ✅ |
| `sendScheduledSupplierMessages` | 403 | ✅ |
| `SERVICE_ACTOR` | Internal only | ✅ (not HTTP) |
| Crons | In-process | ✅ (no HTTP) |

**חריג:** `syncGoogleCalendar` עם `_from_workflow: true` — **לא internal** (ראה SEC-006).

---

## חלק ח — Input Validation

| Surface | Validation | פער |
|---------|------------|-----|
| Entity body | Zod per schema + `.passthrough()` | שדות לא מוגדרים עוברים |
| Entity partial update | merge into JSONB | owner_id, status, approval_status |
| Functions body | Per-function checks | `_from_workflow` unchecked |
| AI invoke body | prompt required only | model, schema, internet flag |
| Upload | MIME whitelist, 10MB | Any authed user |
| Headers | **x-user-* trusted** | **Critical** |

---

## חלק ט — Secrets

| Secret | Location | Frontend exposure |
|--------|----------|-------------------|
| `GEMINI_API_KEY` | server/.env | **No** |
| `JWT_SECRET` | server/.env | **No** (but weak default) |
| Google OAuth | server/.env | **No** |
| Calendar tokens | DB encrypted | **No** |
| `DATABASE_URL` | server/.env | **No** |
| WhatsApp token | AppSetting entity | Redacted on read (non-service) |
| OTP codes | Server console log | **Dev leak** |

---

## חלק י — Infrastructure / Abuse

| Control | Status |
|---------|--------|
| CORS | Restricted if `FRONTEND_URL` set; **else open (`cors({})`)** |
| Rate limiting | **None** |
| Body limit | 2mb JSON |
| Error responses | Message only (no stack in handler) |
| Security headers | **None** (no helmet) |
| Static uploads | Public read `/uploads/*` |
| Upload auth | JWT required |
| Webhook SSRF | `assertSafeHttpsUrl` on WhatsApp webhook |

---

# Findings (קוד בפועל)

---

### SEC-001

**Severity:** CRITICAL  
**Category:** Authentication Bypass  
**File:** `server/src/middleware/entity-authz.js`, `server/src/middleware/auth.js`  
**Function:** `attachActor`, `createAuthMiddleware`  
**Endpoint:** `ALL /api/entities/*`  
**Attack surface:** Internet — כל קריאה ל-entities ללא JWT  
**Current behavior:** אם אין Bearer JWT, `attachActor` מגדיר `req.actor` מ-headers `x-user-id`, `x-user-email`, `x-user-role`.  
**Why it is vulnerable:** Headers נשלטים ע"י התוקף; `requireAuth` לא בשימוש ב-entities router; RLS מסתמך על `req.actor`.  
**Concrete attack scenario:**

```http
POST /api/entities/BookingRequest/filter
x-user-role: admin
x-user-id: 00000000-0000-0000-0000-000000000001
Content-Type: application/json

{"query": {}}
```

→ קריאת כל ההזמנות (admin RLS branch).

**Current protection:** JWT מגדיר actor ראשון (headers ignored); functions routes דורשים `req.user` (JWT בלבד).  
**Recommended fix:** הסר `x-user-*` headers ב-production; entities דורשים JWT; actor רק מ-`req.user`.  
**Potential behavior change:** Contract tests שמשתמשים ב-headers יישברו.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability  
**Status:** **FIXED 2026-08-31** — `attachActor` מגדיר actor אנונימי בלבד ללא JWT; headers `x-user-*` הוסרו. בדיקות: `npm run test:entities-http` (SEC-001).

---

**Severity:** CRITICAL  
**Category:** Broken Access Control / IDOR  
**File:** `server/src/schemas/User.jsonc`, `server/src/lib/authz.js`, `server/src/lib/entity-store.js`  
**Function:** `can`, `list`, `delete`, `create`  
**Endpoint:** `/api/entities/User`, `/api/entities/User/:id`  
**Attack surface:** Anonymous + SEC-001  
**Current behavior:** `User.jsonc` **אין `rls` block** → `authz.can()` returns `true` for all actions (open default).  
**Why it is vulnerable:** `GET /api/entities/User` → `user-store.list()` → כל המשתמשים email/full_name/role. `DELETE` פותח. `POST` עם `role: admin` עובר schema enum.  
**Concrete attack scenario:** `GET /api/entities/User?limit=500` ללא auth → PII dump. `DELETE /api/entities/User/{victim-uuid}`.  
**Current protection:** `User.update` role change מוגבל ב-entity-store (לא self-escalate); `/api/users/invite` דורש admin JWT.  
**Recommended fix:** RLS על User: read self+admin; delete admin only; block entity User.create — auth routes בלבד.  
**Potential behavior change:** SuperAdmin `User.list()` יצטרך admin JWT + RLS admin branch.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability  
**Status:** **FIXED 2026-08-31** — RLS admin-only על User (read/update/delete); `User.create` חסום ב-entity API; strip של `passwordHash` ושדות identity ב-PATCH. יצירת/עדכון משתמשים נשאר דרך `/api/auth/*` ו-`/api/users/invite`.  
**מגבלה מכוונת:** `AdminPermission` UI gate לא מעניק גישת User entity — נדרש `role=admin` ב-JWT (כמו invite/SystemMessage).

---

**Severity:** HIGH  
**Category:** Broken Access Control  
**File:** `server/src/schemas/Promotion.jsonc`  
**Endpoint:** `/api/entities/Promotion/*`  
**Attack surface:** Anonymous  
**Current behavior:** **אין `rls`** — CRUD פתוח לכל caller.  
**Why it is vulnerable:** מתחרה/бот יכול למחוק/ליצור מבצעים, לשנות `status`/`discount_percent`.  
**Concrete attack scenario:** `DELETE /api/entities/Promotion/{id}` על כל מבצע פעיל.  
**Current protection:** None.  
**Recommended fix:** RLS: read public; create/update/delete owner+admin.  
**Potential behavior change:** Promotions page צריך auth לכתיבה.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability  
**Status:** **FIXED 2026-08-31** — RLS: read public; write owner+admin; `owner_id` forced on create; promo capture on booking in `booking-guards.js`.

---

### SEC-004

**Severity:** HIGH  
**Category:** Broken Access Control / PII  
**File:** `server/src/schemas/OwnerRequest.jsonc`  
**Endpoint:** `/api/entities/OwnerRequest/*`  
**Attack surface:** Anonymous  
**Current behavior:** **אין `rls`** — CRUD פתוח.  
**Why it is vulnerable:** בקשות join-as-owner (phone, email, business_name) קריאות/ניתנות לשינוי/מחיקה ע"י כל אחד.  
**Concrete attack scenario:** `GET /api/entities/OwnerRequest` → איסוף PII של מועמדי owners.  
**Current protection:** None.  
**Recommended fix:** RLS: create authenticated; read/update admin only.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability  
**Status:** **FIXED 2026-08-31** — RLS admin-only on all actions (`OwnerRequest.jsonc`).

---

### SEC-005

**Severity:** HIGH  
**Category:** API Abuse / Cost Exhaustion  
**File:** `server/src/routes/ai.js`, `src/api/own/integrations.js`  
**Function:** `createAiRouter`, `InvokeLLM`  
**Endpoint:** `POST /api/ai/invoke-llm`  
**Attack surface:** Internet anonymous  
**Current behavior:** ללא auth, ללא rate limit; כל caller מפעיל Gemini (`GEMINI_API_KEY`).  
**Why it is vulnerable:** עלות/מכסה; DoS על API key; `add_context_from_internet` מכפיל עלות.  
**Concrete attack scenario:** סקריפט שולח אלפי prompts 2MB → חשבון Gemini מנוצל.  
**Current protection:** None (מכוון ל-guest chat — Base44 parity).  
**Recommended fix:** Auth and/or rate limit per IP/user; quota per session; separate guest tier.  
**Potential behavior change:** Guest chat דורש token או captcha.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability (abuse); Architecture weakness (design)  
**Status:** **FIXED 2026-08-31** — Guest tier: rate limit per IP/user; prompt cap; anon blocked from `add_context_from_internet` and client `model`. Guest chat remains open. Tests: `test:ai-http`.

---

### SEC-006

**Severity:** HIGH  
**Category:** Authentication Bypass  
**File:** `server/src/routes/functions.js`  
**Function:** `POST /syncGoogleCalendar` handler  
**Endpoint:** `POST /api/functions/syncGoogleCalendar`  
**Attack surface:** Internet  
**Current behavior:** אם `body._from_workflow === true` → **דילוג על `req.user` check**; רק `owner_id` required.  
**Why it is vulnerable:** כל client יכול לטרigger sync + Google API calls לכל owner_id.  
**Concrete attack scenario:**

```json
POST /api/functions/syncGoogleCalendar
{"_from_workflow": true, "owner_id": "<victim-owner-uuid>"}
```

**Current protection:** None on this branch.  
**Recommended fix:** `_from_workflow` only from internal cron (shared secret / remove HTTP path).  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability  
**Status:** **FIXED 2026-08-31** — HTTP `_from_workflow` bypass removed; JWT required. Cron calls lib directly. Tests: `test:functions-http`.

---

### SEC-007

**Severity:** HIGH  
**Category:** IDOR / BOLA  
**File:** `server/src/schemas/BookingRequest.jsonc`  
**Endpoint:** `POST /api/entities/BookingRequest`  
**Attack surface:** Authenticated customer (JWT)  
**Current behavior:** `create` RLS: `authenticated OR admin` — **לא בודק `owner_id` ב-payload**.  
**Why it is vulnerable:** לקוח יכול ליצור הזמנות עם `owner_id` של victim → spam/notifications/hooks.  
**Concrete attack scenario:** Customer JWT + `{ owner_id: "<victim>", zimmer_id, guest_name, ... }` → `onNewBooking` notification לבעל.  
**Current protection:** `created_by_id` נקבע מ-actor (נכון); owner_id from client trusted.  
**Recommended fix:** On create: derive `owner_id` from Zimmer lookup; reject client-supplied owner_id mismatch.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability  
**Status:** **FIXED 2026-08-31** — `resolveOwnerFromZimmer()` in `booking-guards.js`; strip `owner_id` on PATCH (non-admin).

---

### SEC-008

**Severity:** HIGH  
**Category:** IDOR / BOLA  
**File:** `server/src/schemas/UnansweredQuestion.jsonc`  
**Endpoint:** `POST /api/entities/UnansweredQuestion`  
**Attack surface:** Authenticated user  
**Current behavior:** `create` — authenticated only; **לא validates `owner_id` vs zimmer**.  
**Concrete attack scenario:** שאלות spam לבעלים אקראיים עם `owner_id` מזויף.  
**Recommended fix:** Derive owner_id from `zimmer_id` server-side.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability  
**Status:** **FIXED 2026-08-31** — Same guard as SEC-007 (`resolveOwnerFromZimmer`).

---

### SEC-009

**Severity:** MEDIUM  
**Category:** Broken Access Control / Business Logic  
**File:** `server/src/lib/entity-store.js`  
**Endpoint:** `PATCH /api/entities/BookingRequest/:id`  
**Attack surface:** Customer who created booking (`created_by_id`)  
**Current behavior:** Update RLS allows creator; **אין status transition guard** (בניגוד ל-Review).  
**Why it is vulnerable:** Customer יכול `PATCH { status: "אושרה" }` על הזמנה משלו → bypass owner approval.  
**Concrete attack scenario:** Self-approve pending booking → calendar/overlap logic may treat as approved.  
**Current protection:** Owner approval UI flow (not enforced server-side).  
**Recommended fix:** Whitelist customer-writable fields; status transitions by role.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability  
**Status:** **FIXED 2026-08-31** — `booking-status.js` (customer patch whitelist + owner status transitions); `test:booking`.

---

### SEC-010

**Severity:** MEDIUM  
**Category:** Privilege Escalation / Mass Assignment  
**File:** `server/src/lib/entity-store.js`  
**Endpoint:** `PATCH /api/entities/Zimmer/:id`  
**Attack surface:** Owner (or SEC-001 spoofed owner)  
**Current behavior:** Update checks RLS on **existing** record; merge allows **`owner_id` in patch**.  
**Concrete attack scenario:** Owner A updates own zimmer with `{ owner_id: "<owner-B-id>" }` → transfer asset.  
**Recommended fix:** Strip `owner_id`, `approval_status` from client patches (server-set only).  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability  
**Status:** **FIXED 2026-08-31** — `stripImmutableOwnershipFields` strips `owner_id` + `approval_status` on Zimmer PATCH; `test:authz`.

---

### SEC-011

**Severity:** MEDIUM  
**Category:** Cryptographic Weakness  
**File:** `server/src/lib/jwt.js`  
**Function:** `signToken`, `verifyToken`  
**Endpoint:** All JWT-protected routes  
**Current behavior:** `JWT_SECRET || 'dev-only-change-me'`.  
**Why it is vulnerable:** Deploy without env → forgeable tokens.  
**Recommended fix:** Fail startup if secret missing/weak in production.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability (misconfiguration)  
**Status:** **FIXED 2026-08-31** — `env.js` `assertProductionEnv()` + `getJwtSecret()`; `test:env`.

---

### SEC-012

**Severity:** MEDIUM  
**Category:** Token Leakage  
**File:** `server/src/routes/auth.js`  
**Function:** `resolveRedirect`, Google callback  
**Endpoint:** `GET /api/auth/google/callback`  
**Current behavior:** Redirect to frontend with `?access_token=<JWT>`.  
**Why it is vulnerable:** Token in browser history, Referer, server/proxy logs, analytics.  
**Recommended fix:** Authorization code exchange on frontend or fragment (#) + short-lived code.  
**Confidence:** HIGH  
**Classification:** Architecture weakness (common OAuth pattern risk)  
**Status:** **FIXED 2026-08-31** — OAuth redirect uses one-time `auth_code`; `POST /api/auth/exchange-code`; frontend `AuthContext` exchanges on load; `test:auth-oauth`.

---

### SEC-013

**Severity:** MEDIUM  
**Category:** CORS Misconfiguration  
**File:** `server/src/index.js`  
**Endpoint:** All  
**Current behavior:** `cors(frontendUrl ? {...} : {})` — **empty config = reflect all origins**.  
**Why it is vulnerable:** Production without `FRONTEND_URL` → any origin can call API from browser (with user cookies/tokens if combined).  
**Recommended fix:** Require `FRONTEND_URL` in production; deny default.  
**Confidence:** HIGH  
**Classification:** Potential vulnerability (depends on env)  
**Status:** **FIXED 2026-08-31** — production requires `FRONTEND_URL`; CORS `origin: false` when unset; `test:env` + `test:cors`.

---

### SEC-014

**Severity:** MEDIUM  
**Category:** AI → Mutation Trust Boundary  
**File:** `src/components/admin/AdminAssistantChat.jsx`  
**Endpoint:** `PATCH /api/entities/Zimmer/:id`  
**Current behavior:** LLM `changes` object applied directly via `Zimmer.update` — **no server field whitelist**.  
**Why it is vulnerable:** Owner can be tricked (prompt injection in zimmer data) to apply malicious `data_zones` / `stay_settings.entry_code` changes.  
**Recommended fix:** Route through `executeOwnerAssistantOp`-style whitelist or server-side diff validation.  
**Confidence:** MEDIUM  
**Classification:** Architecture weakness

---

### SEC-015

**Severity:** MEDIUM  
**Category:** AI → Mutation Trust Boundary  
**File:** `src/components/owner/BookingCreatorChat.jsx`  
**Endpoint:** `POST /api/entities/BookingRequest`  
**Current behavior:** LLM sets `status` (incl. `אושרה`); saved via direct entity create, not `executeOwnerAssistantOp`.  
**Why it is vulnerable:** Bypass hardened assistant path; LLM prompt injection could set unexpected fields.  
**Note:** Owner workflow may intentionally allow approved status.  
**Confidence:** MEDIUM  
**Classification:** Architecture weakness

---

### SEC-016

**Severity:** MEDIUM  
**Category:** Information Disclosure  
**File:** `server/src/lib/otp.js`  
**Function:** `deliverOtp`, `deliverResetLink`  
**Endpoint:** `/api/auth/register`, `/api/auth/resend-otp`  
**Current behavior:** OTP + reset URLs **logged to server console** when SMTP not configured.  
**Concrete attack scenario:** Shared hosting logs expose OTP.  
**Recommended fix:** Never log OTP in production; require SMTP.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability (dev/staging)  
**Status:** **FIXED 2026-08-31** — OTP/reset links withheld from logs in production unless `ALLOW_CONSOLE_OTP=1`; register does not 503 without SMTP (Render-safe); `test:auth-oauth`.

---

### SEC-017

**Severity:** MEDIUM  
**Category:** Information Disclosure  
**File:** `server/src/schemas/Zimmer.jsonc`  
**Endpoint:** `GET /api/entities/Zimmer`  
**Current behavior:** `read: {}` — **open read** including `data_zones`, `description`; `stay_settings.entry_code` redacted for non-owner.  
**Why it is vulnerable:** `data_zones` may contain private owner notes; public marketplace read is broad.  
**Recommended fix:** Split public vs owner fields; redact `data_zones` for anonymous.  
**Confidence:** MEDIUM  
**Classification:** Architecture weakness (may be intentional)  
**Status:** **FIXED 2026-08-31** — `redactRecord` strips `data_zones` for non-owner/admin; chat uses `formatZimmerKnowledgeForPrompt` (`info_summary` fallback); `test:authz`.

---

### SEC-018

**Severity:** LOW  
**Category:** Denial of Service  
**File:** `server/src/index.js`  
**Endpoint:** All  
**Current behavior:** No rate limiting middleware.  
**Recommended fix:** express-rate-limit on auth, AI, entities write.  
**Confidence:** HIGH  
**Classification:** Best practice gap

---

### SEC-019

**Severity:** LOW  
**Category:** Missing Security Headers  
**File:** `server/src/index.js`  
**Current behavior:** No `helmet`, no CSP, no HSTS.  
**Confidence:** HIGH  
**Classification:** Best practice gap

---

### SEC-020

**Severity:** MEDIUM  
**Category:** Token Leakage  
**File:** `src/api/own/realtime.js`, `server/src/middleware/auth.js`  
**Endpoint:** `GET /api/events/entities/:entity?token=`  
**Current behavior:** JWT passed in query string for EventSource.  
**Why it is vulnerable:** Logs, Referer leakage.  
**Recommended fix:** Short-lived SSE ticket exchange.  
**Confidence:** HIGH  
**Classification:** Architecture weakness  
**Status:** **DEFERRED** — default transport is polling (`VITE_REALTIME_TRANSPORT` unset); SSE ticket not implemented.

**Severity:** MEDIUM  
**Category:** Privilege Escalation  
**File:** `server/src/schemas/User.jsonc`, `server/src/lib/user-store.js`  
**Endpoint:** `POST /api/entities/User`  
**Current behavior:** Schema allows `role: admin|owner`; combined with SEC-002 no RLS → create admin user row.  
**Concrete attack scenario:** Anonymous POST User with admin role + email (no password) + header spoof for further access.  
**Recommended fix:** Block User entity mutations from public API entirely.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability (with SEC-002)

---

### SEC-022

**Severity:** MEDIUM  
**Category:** AI Input Abuse  
**File:** `server/src/lib/llm/gemini.js`  
**Endpoint:** `POST /api/ai/invoke-llm`  
**Current behavior:** Client supplies `model`; server tries primary + fallbacks.  
**Why it is vulnerable:** Force expensive models; amplify cost attack with SEC-005.  
**Recommended fix:** Allowlist models server-side; ignore client model except mapped aliases.  
**Confidence:** HIGH  
**Classification:** Confirmed vulnerability (abuse)

---

### SEC-023

**Severity:** LOW  
**Category:** Mass Assignment  
**File:** `server/src/lib/schema-loader.js`  
**Function:** `buildValidator` → `.passthrough()`  
**Endpoint:** All entity writes  
**Current behavior:** Unknown JSON fields pass validation and merge into JSONB.  
**Recommended fix:** `.strict()` or strip unknown keys per entity.  
**Confidence:** HIGH  
**Classification:** Architecture weakness

---

### SEC-024

**Severity:** MEDIUM  
**Category:** UI Authorization Only  
**File:** `src/pages/SuperAdminPanel.jsx`, `src/App.jsx`  
**Endpoint:** `/superadmin` (UI), `/api/entities/*` (data)  
**Current behavior:** **No `RoleGate`** on `/superadmin`; panel checks `AdminPermission` client-side; data via open User.list.  
**Why it is vulnerable:** UI gate irrelevant when API open (SEC-001/002).  
**Confidence:** HIGH  
**Classification:** Architecture weakness

---

### SEC-025

**Severity:** MEDIUM  
**Category:** Schema / RLS Gap  
**File:** `server/src/lib/schema-loader.js`  
**Current behavior:** Declares `GuestMessage`, `SupplierAutomation`, `SupplierMessage`, `AppSetting` — **`.jsonc` files missing from repo** (14 files present).  
**Why it is vulnerable:** If missing at runtime server fails; if loaded elsewhere with open RLS — unknown. Code references `GuestMessage` writes.  
**Confidence:** LOW  
**Classification:** Potential vulnerability requiring verification  
**Status:** **FIXED 2026-08-31** — schemas present (18 entities); frontend `entities.js` parity for all four; `test:entities`.

**Severity:** LOW  
**Category:** Upload Abuse  
**File:** `server/src/routes/upload.js`  
**Endpoint:** `POST /api/upload`  
**Current behavior:** Any authenticated user can upload up to 10MB images; public static URLs.  
**Why it is vulnerable:** Storage fill; hosting illegal content (any authed account).  
**Recommended fix:** Rate limit; virus scan; owner/admin only if appropriate.  
**Confidence:** MEDIUM  
**Classification:** Potential vulnerability

---

### SEC-027

**Severity:** LOW  
**Category:** Guest Booking Gap  
**File:** `BookingRequest.jsonc` create RLS, `CustomerChat.jsx`  
**Current behavior:** Guest UI allows chat; `BookingRequest.create` requires `authenticated`.  
**Why it is vulnerable:** Not a bypass — guest booking **fails** server-side (product bug). If frontend ever sends spoof headers as authenticated guest, changes.  
**Confidence:** MEDIUM  
**Classification:** Architecture note (not exploitable without SEC-001)

---

## Internal Endpoints — Verified Secure

ה-endpoints הבאים מחזירים **403** ל-HTTP clients (נבדק ב-`server/src/routes/functions.js`):

- `POST /api/functions/pushInAppNotification`
- `POST /api/functions/finalizeReviewAutoPublish`
- `POST /api/functions/sendStayMessages`
- `POST /api/functions/sendScheduledSupplierMessages`

`SERVICE_ACTOR` (`server/src/lib/service-role.js`) משמש hooks/crons בלבד — לא exposed as HTTP impersonation vector.

---

# Priority Table

| Priority | Finding | Endpoint/File | Severity | Confirmed? | Behavior Risk |
|:--------:|---------|---------------|----------|:----------:|:-------------:|
| 1 | SEC-001 Header auth bypass | `/api/entities/*` | CRITICAL | Yes | Full data breach |
| 2 | SEC-002 User entity no RLS | `/api/entities/User` | CRITICAL | Yes | PII dump / account delete |
| 3 | SEC-005 Open LLM endpoint | `/api/ai/invoke-llm` | HIGH | Yes | Financial DoS |
| 4 | SEC-006 syncGoogleCalendar workflow bypass | `/api/functions/syncGoogleCalendar` | HIGH | Yes | Abuse Google API |
| 5 | SEC-003 Promotion no RLS | `/api/entities/Promotion` | HIGH | Yes | Data tampering |
| 6 | SEC-004 OwnerRequest no RLS | `/api/entities/OwnerRequest` | HIGH | Yes | PII leak |
| 7 | SEC-007 Booking forged owner_id | `POST .../BookingRequest` | HIGH | Yes | Owner spam/harassment |
| 8 | SEC-008 Question forged owner_id | `POST .../UnansweredQuestion` | HIGH | Yes | Owner spam |
| 9 | SEC-021 User create admin role | `POST .../User` | MEDIUM | Yes | Privilege escalation |
| 10 | SEC-009 Customer self-approve booking | `PATCH .../BookingRequest` | MEDIUM | Yes | Business logic bypass |
| 11 | SEC-010 Zimmer owner_id transfer | `PATCH .../Zimmer` | MEDIUM | Yes | Asset theft |
| 12 | SEC-011 Default JWT secret | `jwt.js` | MEDIUM | Yes (misconfig) | Token forgery |
| 13 | SEC-012 Token in OAuth URL | `/api/auth/google/callback` | MEDIUM | Yes | Token leak |
| 14 | SEC-013 Open CORS default | `index.js` | MEDIUM | If env missing | CSRF-like abuse |
| 15 | SEC-014 AdminAssistant direct update | `AdminAssistantChat.jsx` | MEDIUM | Partial | Over-privileged writes |
| 16 | SEC-016 OTP in console | `otp.js` | MEDIUM | Yes (dev) | Account takeover |
| 17 | SEC-020 SSE token in query | `/api/events/*` | MEDIUM | Yes | Token leak |
| 18 | SEC-022 Arbitrary LLM model | `gemini.js` | MEDIUM | Yes | Cost amplification |
| 19 | SEC-017 Open Zimmer read / data_zones | `GET .../Zimmer` | MEDIUM | Partial | Info disclosure |
| 20 | SEC-014/015 AI mutation trust | Multiple chat components | MEDIUM | Yes | Prompt injection → writes |
| 21 | SEC-025 Missing entity schemas | `schema-loader.js` | MEDIUM | Unverified | Unknown RLS |
| 22 | SEC-018 No rate limiting | Global | LOW | Yes | DoS |
| 23 | SEC-019 No security headers | `index.js` | LOW | Yes | Browser attacks |
| 24 | SEC-023 Zod passthrough | `schema-loader.js` | LOW | Yes | Mass assignment |
| 25 | SEC-026 Upload abuse | `/api/upload` | LOW | Partial | Storage abuse |

---

## Classification Summary

| Type | Count |
|------|-------|
| Confirmed vulnerability | 15 |
| Potential vulnerability (verify env/deployment) | 4 |
| Architecture weakness | 8 |
| Best practice only | 2 |

---

## What Is Working (Positive Findings)

- **`/api/functions/*`** (except SEC-006) — `requireAuth` on `req.user` (JWT), not spoofable headers.
- **Internal function endpoints** — HTTP 403 enforced.
- **`executeOwnerAssistantOp`** — whitelist + ownership checks (OwnerInfoAssistant edit path).
- **Review status transitions** — server-side whitelist (`review-status.js`).
- **Booking status transitions** — customer patch whitelist + owner transitions (`booking-status.js`).
- **Booking overlap** — advisory lock + 409 on double-booking.
- **`total_price`** — computed server-side on create/update.
- **DirectChat, ChatSession, CustomerProfile, Contact** — RLS present and scoped.
- **WhatsApp webhook** — HTTPS + SSRF private IP block.
- **Upload** — MIME allowlist + size cap.
- **`/api/bookings/busy`** — intentional public availability without PII.
- **Gemini API key** — not exposed to frontend.

---

## Related Docs

- [technical-architecture-map.md](./technical-architecture-map.md)
- [ai-architecture-map.md](./ai-architecture-map.md)
- [migration/authz-baseline.md](./migration/authz-baseline.md) — **partially outdated**; CRITICAL/HIGH + non-AI MEDIUM fixes through SEC-017/025 applied 2026-08-31
- [migration/deferred-fixes.md](./migration/deferred-fixes.md)

---

*End of audit — no code changes performed.*
