# API contract to restore (from current Base44 usage)

Source of truth: app code + `base44/entities/*.jsonc`. Demo data only — no production export.

## Entities (14)

Methods in use: `list`, `filter`, `get`, `create`, `update`, `delete`, `subscribe`.  
Not used: `bulkCreate`, `schema`.

### filter / list

- `filter(query, sort?, limit?)` — flat equality object only (no operators / `$or` in client calls)
- `sort` — single string, e.g. `'-created_date'`, `'-updated_date'`
- `limit` — number when provided; default platform ceiling **unknown** (must measure)

### Auto fields relied on by UI / workflows

`id`, `created_date`, `updated_date`, `created_by_id`, `created_by`

### Special cases

| Entity | Notes |
|---|---|
| User | Platform user extension; `list`/`update`/`delete` hit real users |
| SyncState | Global singleton for calendar sync; no RLS declared |
| Review | Status machine + nested `settlement_offer` |
| DirectChat | Full RLS in jsonc |
| SystemMessage | `read: {}` open; create/update/delete admin\|owner |

## Auth

- `me`, `loginWithProvider('google', redirect)`, `logout`, `updateMe`, OTP/reset methods exist (some pages unrouted)
- Bootstrap: `GET public-settings` then `auth.me()`
- Token: `?access_token=` → `localStorage` key `base44_access_token`

## Functions (5)

| Name | Auth in code | Notes |
|---|---|---|
| addBookingToCalendar | me() + ownership | `booking.owner_id` or admin (M15 #5) |
| geocodeAddresses | me() | Nominatim sequential |
| pushInAppNotification | **internal only** | HTTP 403; entity hooks (M15 #4 #24) |
| syncGoogleCalendar | conditional | webhook/workflow skip me |
| finalizeReviewAutoPublish | **internal only** | HTTP 403; delayed jobs (M15 #22) |

## Integrations

- `InvokeLLM` ×13 (8 schema / 5 text; one uses `gemini_3_flash` + internet)
- `UploadFile` ×3 → `{ file_url }`

## Agents (deferred — see m16-restore-guide.md)

`listConversations`, `createConversation`, `getConversation`, `subscribeToConversation`, `addMessage` — used by `OwnerAgentChat`; **not in own backend yet**. Product decision: evaluate current `OwnerInfoAssistant` first; restore guide: [m16-restore-guide.md](./m16-restore-guide.md).

## Realtime

7 entity `.subscribe()` call sites in 5 files.
