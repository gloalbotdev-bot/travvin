# Travvin

Local frontend (Vite/React) + API (`server/` — Express + Prisma).

## Prerequisites

1. Clone the repository.
2. `npm install` at repo root (npm ≥ 10.9; see `.npmrc`).
3. `npm install` in `server/`.
4. Postgres: `docker compose up -d`, **or** set `DATABASE_URL` in `server/.env`.

## Environment

Root `.env.local`:

```bash
VITE_OWN_API_URL=http://localhost:3001
```

Server secrets: `server/.env` (see `server/.env.example`).

Entity schemas: `server/src/schemas/*.jsonc`.

## Run

```bash
npm run dev:server   # API :3001
npm run dev          # Vite :5173 (proxies /api → VITE_OWN_API_URL)
# or:
npm run dev:all
```

Health: `GET http://localhost:3001/api/health` → `{ "ok": true, "db": true }`.

## Tests

```bash
npm run test:server    # all server contract tests (from repo root)
cd server && npm run test:all:live   # + live Gemini (optional)
```

## Docs

Migration history: `docs/migration/`.  
**Migration complete:** [docs/migration/MIGRATION-COMPLETE.md](docs/migration/MIGRATION-COMPLETE.md).  
Manual smoke checklist: [docs/migration/current-state-smoke.md](docs/migration/current-state-smoke.md).
