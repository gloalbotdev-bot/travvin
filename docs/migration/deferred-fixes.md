# Deferred fixes registry (milestone 15)

Copied from migration-plan for tracking. Do **not** fix during core migration (faithful restore first).

**Status: CLOSED 2026-08-10** — see [MIGRATION-COMPLETE.md](./MIGRATION-COMPLETE.md).

## Security (high)

1. AdminPermission without server authz + client-only gate — **DONE 2026-08-09** (RLS + SuperAdmin catch)  
2. Broad PII lists — **DONE 2026-08-10** (RLS on BookingRequest / UnansweredQuestion / Contact / CustomerProfile / Review; `/api/bookings/busy` without PII; ChatSession earlier)   
3. SystemMessage open read + sensitive bodies — **DONE 2026-08-10** (auth + target scoping)  
4. pushInAppNotification without auth (+ browser calls) — **DONE 2026-08-09** (HTTP 403; hooks only; browser invokes removed)  
5. addBookingToCalendar without ownership — **DONE 2026-08-09** (owner_id or admin; verified `test:calendar`)  
11. updateMe({ role }) self-escalation — **DONE 2026-08-09**  
16. Agent info/edit not server-enforced — **DEFERRED → M16** ([decisions.md](./decisions.md) §1)  
17. Google Calendar webhook auth — **N/A** (cron-only)  
18. SyncState RLS — **DONE** (M8 per-owner RLS)  
19. EditOwnerModal role:admin from browser — **DONE 2026-08-10** (User.update blocks role=admin; modal whitelist owner/user)  
20. SystemMessage.create restrict to admin — **DONE 2026-08-10** (with #3)  
22. finalizeReviewAutoPublish without auth — **DONE 2026-08-09** (HTTP 403; delayed jobs only)  
23. Review status transitions server-side — **DONE 2026-08-09** (`review-status.js` whitelist by role)  
24. Block pushInAppNotification from normal clients — **DONE 2026-08-09** (with #4)  
25. SEC-001 header actor bypass on `/api/entities/*` — **DONE 2026-08-31** (`entity-authz.js`; `test:entities-http`)  
26. SEC-002 User entity open CRUD — **DONE 2026-08-31** (`User.jsonc` RLS admin-only; entity-store guards; `test:authz` + `test:entities-http`). **Note:** User entity API requires `role=admin` JWT; `AdminPermission` whitelist alone does not grant User CRUD (UI-only delegation unchanged).  
27. SEC-003 Promotion no RLS — **DONE 2026-08-31** (`Promotion.jsonc` RLS; server promo capture on booking).  
28. SEC-004 OwnerRequest no RLS — **DONE 2026-08-31** (admin-only RLS).  
29. SEC-005 open `/api/ai/invoke-llm` — **DONE 2026-08-31** (rate limit + guest caps; `test:ai-http`).  
30. SEC-006 syncGoogleCalendar `_from_workflow` bypass — **DONE 2026-08-31** (`test:functions-http`).  
31. SEC-007/008 forged `owner_id` on BookingRequest / UnansweredQuestion — **DONE 2026-08-31** (`resolveOwnerFromZimmer`).  
32. SEC-009 customer self-approve booking — **DONE 2026-08-31** (`booking-status.js`; `test:booking`).  
33. SEC-010 Zimmer `approval_status` self-approve / mass assignment — **DONE 2026-08-31** (`stripImmutableOwnershipFields`; `test:authz`).  
34. SEC-011/013 production JWT + CORS guards — **DONE 2026-08-31** (`env.js`; `test:env`, `test:cors`).  
35. SEC-012 OAuth JWT in URL — **DONE 2026-08-31** (`auth_code` exchange; frontend `AuthContext`; `test:auth-oauth`).  
36. SEC-016 OTP in console — **DONE 2026-08-31** (withhold in prod; `ALLOW_CONSOLE_OTP` for Render dev register).  
37. SEC-017 Zimmer `data_zones` open read — **DONE 2026-08-31** (server redact + chat `info_summary` fallback).  
38. SEC-025 frontend entity parity — **DONE 2026-08-31** (`entities.js` + `test:entities`).  
39. SEC-020 SSE token in query — **DEFERRED** (polling default; ticket exchange not implemented).

## Data / logic

6. Single shared primary calendar — **N/A (intentional)** per [decisions.md](./decisions.md) § M8 per-owner `calendar_id`  
7. No calendar event idempotency — **DONE 2026-08-10** (skip Google POST when `booking.calendar_event_id` set; `test:calendar`)  
8. Prompt injection / stored injection via data_zones — **DONE 2026-08-10** (`sanitizePromptData.js` in CustomerChat + SearchChat + OwnerInfoAssistant user input)  
9. Booking race (check-then-create) — **DONE 2026-08-10** (advisory lock + 409 on overlap with `אושרה`)  
10. total_price computed in browser — **DONE 2026-08-10** (server overwrites from Zimmer + active promo)  
12. Nominatim no throttle/cache — **DONE 2026-08-10** (~1.1s throttle, LRU cache 24h/500; `test:geocode`)  
21. weekday/weekend timezone (getUTCDay) — **DONE 2026-08-10** (`Asia/Jerusalem` day-of-week)  

## Hygiene / validation

13. Schema gaps (rating min/max, dates, email, …) — **DONE 2026-08-10** (schema `minimum`/`maximum`/`format`; `assertCheckOutAfterCheckIn`; `test:validation`)  
8ב. LLM→DB without hard enforcement (OwnerInfoAssistant) — **DONE 2026-08-10** (`executeOwnerAssistantOp` server whitelist + ownership)  
14. Other validation gaps — **DONE 2026-08-10** (Zimmer prices ≥0; Review cat_* 1–5; settlement_offer 0–100; Promotion discount 0–100; SyncState `owner_id` required in schema)  
15. Tech debt — **DONE 2026-08-10** (removed dead auth pages + ProtectedRoute + ZimmerDetailInline + createPageUrl; `CustomerQuestionsTab` wired to portal). npm package audit left for post-release.
