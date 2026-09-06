# Readiness gate — prep complete

Date: 2026-08-03 (updated after user filled appId + accounts)

| Item | Status |
|---|---|
| git + tag `pre-migration` | DONE |
| `.env.local` with real `VITE_BASE44_APP_ID` | DONE (user-filled; gitignored) |
| `VITE_BASE44_APP_BASE_URL` | DONE — `https://trav-vin.com` |
| `node_modules` + leaflet | DONE |
| Local `npm run build` / `npm run dev` | DONE |
| Base44 CLI | **BLOCKED by NetFree** (jsr.io E418) — workaround: hosted backend via Vite plugin |
| Test account emails recorded | DONE — see [decisions.md](./decisions.md) |
| Admin UI login verified | **PENDING user** — `gw38452@gmail.com` |
| Owner UI login verified | **BLOCKED** — email known (`s053410331@gmail.com`) but no login access for migrator |
| 3 business decisions | DONE — [decisions.md](./decisions.md) |
| `docs/migration/` + jsconfig/eslint fixed | DONE |
| Milestone 1 facade | DONE — `src/api/client.js` |

## Remaining user actions

1. Optional: fill remaining 11-route checklist cells in decisions.md (guest+owner already verified 2026-08-04)
2. When NetFree allows: `npm i -g base44@latest` for `base44 dev` (optional while hosted works)
3. For milestone 3: Docker Desktop available for local Postgres

## Next engineering step

Milestone 3 — Express + Prisma + Postgres skeleton (`server/`, docker-compose, `/api/health`).
