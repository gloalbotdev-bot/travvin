# Demo seed (milestone 4)

Date: 2026-08-05

## Commands

```bash
cd server
npm run seed          # upsert demo (idempotent)
npm run seed:fresh    # delete demo-tagged records, then seed
```

## What gets seeded

| Type | Count | Notes |
|---|---|---|
| User (owner) | upsert | `SEED_OWNER_EMAIL` default `gw38452@gmail.com`, role **admin** |
| User (customer) | upsert | `customer.demo@travvin.local` |
| AdminPermission | 1 | owner email whitelist |
| Zimmer | 2 | `approval_status: אושר` |
| BookingRequest | 2 | pending + approved |
| Promotion | 1 | active |
| SystemMessage | 2 | customer + owner |
| Review | 1 | published |
| UnansweredQuestion | 1 | pending |
| ChatSession, DirectChat, Contact, CustomerProfile, SyncState | 1 each | |

All demo records tagged `data._seed = 'demo'` for safe `--fresh` cleanup.

## Flip frontend to own entities

In `.env.local`:

```
VITE_BACKEND_AUTH=own
VITE_BACKEND_ENTITIES=own
VITE_OWN_API_URL=http://localhost:3001
```

Restart `npm run dev` + `npm run dev:server`. Log in with Google as `gw38452@gmail.com`.

## Verify

- `/owner` — 2 demo zimmers
- `/superadmin` — dashboard stats > 0
- `/promotions` — active promo
- `/chat` — zimmers load (LLM still Base44 until M10)
