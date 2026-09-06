# Milestone 3 status

Date: 2026-08-04 (updated)

## Done

- `server/` Express + Prisma + `GET /api/health`
- Supabase Postgres (cloud) via **pooler `:6543`**
- Table `health_probe` created via Supabase SQL Editor
- Live verify: `http://localhost:3001/api/health` → `{"ok":true,"db":true}`
- NetFree: Direct `:5432` still blocked; pooler works

## Notes

- Do **not** set `$env:DATABASE_URL` in PowerShell to placeholder URLs — it overrides `.env`
- `server/src/index.js` loads `server/.env` with `override: true`
- Prisma `db push` / `migrate` may still be flaky via pooler; schema changes can use SQL Editor until Direct opens

## Next

Milestone 4 — DONE (see [m4-status.md](./m4-status.md)). Next: **4.5 authz**.
