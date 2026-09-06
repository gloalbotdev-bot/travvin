# Milestone 4 status

Date: 2026-08-04

## Done

- Prisma `Record` model (`records` table) — generic JSONB store for 14 entities
- SQL: `server/prisma/sql/001_records.sql` (GIN on `data` + `calendar_event_id` expression index)
- Apply helper: `npm run db:apply-records` (pooler-safe alternative to migrate/db push)
- `schema-loader.js` — loads `base44/entities/*.jsonc` including **`rls` blocks**
- `entity-store.js` — list / filter / get / create / update / delete
- Routes: `/api/entities/:entity` (+ `/filter`, `/:id`)
- Frontend: `src/api/own/entities.js` + `VITE_BACKEND_ENTITIES` flag in `client.js` (**default `base44`** — frontend unchanged)
- Contract smoke: `npm run test:contract` (from `server/`)

## Notes

- **User** entity uses the generic store for now; M5 remaps to real users table
- **Authz** intentionally open until milestone 4.5
- `created_by_*` set from `x-user-id` / `x-user-email` headers until M5 JWT
- Date format: ISO-8601 with `Z` (`toISOString()`)
- Defaults applied from schema only (e.g. `approval_status: 'אושר'`) — no extra validation (deferred-fixes 13–15)
- `subscribe` on own client uses polling/SSE when `VITE_BACKEND_REALTIME=own` (M6)

## Verify

```bash
cd server
npm install
npx prisma generate
npm run db:apply-records
npm run test:contract
# with server running:
curl http://localhost:3001/api/entities
curl -X POST http://localhost:3001/api/entities/Zimmer -H "Content-Type: application/json" -d "{\"name\":\"בדיקה\"}"
```

Frontend stays on Base44 until `.env.local` has `VITE_BACKEND_ENTITIES=own` (+ seed data).

## Next

**Milestone 4.5** — DONE (see [m45-status.md](./m45-status.md)). Next: **M5 auth**.
