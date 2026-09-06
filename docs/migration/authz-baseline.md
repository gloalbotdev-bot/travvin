# Authorization baseline (milestone 4.5)

Date: 2026-08-04  
Status: **provisional for undeclared entities** — declared RLS copied exactly from schemas.

## Measurement constraints

| Item | Status |
|---|---|
| Dual-role account `gw38452@gmail.com` | Available (admin + owner) |
| Second independent account for cross-user A↔B | **Not available** (`s053410331@gmail.com` — no login for migration) |
| Live Base44 API cross-tenant experiment | **Not run** — cannot complete step 1 fully |

Therefore undeclared-entity policy is derived from: (1) absence of `rls` in 12/14 schemas, (2) UI call patterns that assume wide access, (3) faithful-restore decision. Re-run live A↔B probes when a second account exists and update this file.

## Declared RLS (source of truth = jsonc)

### DirectChat (`base44/entities/DirectChat.jsonc`)

Each of read / create / update / delete:

`$or`: `data.customer_id == user.id` **OR** `data.owner_id == user.id` **OR** `user.role == 'admin'`

- Stranger (authenticated, neither party, not admin) → **deny**
- Unauthenticated → **deny** (no `user.id` / role match)
- Admin → **allow** all

### SystemMessage (`base44/entities/SystemMessage.jsonc`)

| Action | Rule | Restore |
|---|---|---|
| read | `{}` | **Open** (anyone, including unauthenticated) — deferred-fix **#3** |
| create / update / delete | `$or` role `admin` **OR** `owner` | Allow only those roles — deferred-fix **#20** still wants admin-only later |

## Undeclared entities (12) — provisional default

Entities: `AdminPermission`, `BookingRequest`, `ChatSession`, `Contact`, `CustomerProfile`, `OwnerRequest`, `Promotion`, `Review`, `SyncState`, `UnansweredQuestion`, `User`, `Zimmer`.

| Action | Provisional restore | Evidence |
|---|---|---|
| read (list/filter/get) | **Allow** any caller | Public `Zimmer` / `Promotion` usage; SuperAdmin broad `.list()`; client-side ownership filters imply server returns wide sets |
| create / update / delete | **Allow** any caller | No `rls` block; UI writes from customer/owner/admin without server gate beyond auth (auth arrives in M5) |

Intentionally permissive. Code comments must cite deferred-fixes:

| Entity / concern | Deferred # |
|---|---|
| `AdminPermission` server gate | **#1** (client-only check stays) |
| Broad PII lists | **#2** |
| `SyncState` global singleton | **#18** |
| `Review` status transitions | **#23** |

### SyncState (explicit note)

No `rls`. Treated like other undeclared entities (**open**). Tighten in milestone 15 item **#18**.

## Admin panel gate (unchanged)

`SuperAdminPanel.jsx` still gates via `AdminPermission.filter({ email })` in the browser only. **No server admin check added in 4.5** (faithful restore; deferred-fix **#1**).

## Actor until milestone 5

JWT not ready. Requests may identify the actor via headers (tests + future middleware):

- `x-user-id` → `user.id`
- `x-user-email` → `user.email`
- `x-user-role` → `user.role` (`admin` \| `owner` \| …)

Missing headers ⇒ unauthenticated actor.

## Re-measure checklist (when second account exists)

For `Contact` or `CustomerProfile`, as user B against a record owned/created by user A:

1. read (get + filter)  
2. create  
3. update  
4. delete  

Record HTTP status per cell; if Base44 denies, tighten this baseline and `authz.js` before flipping `VITE_BACKEND_ENTITIES=own` in production.
