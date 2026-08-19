# AGENTS.md

## Project Context

Travvin — Express/Prisma API + Vite React frontend. Keep changes focused; follow existing conventions.

Start with `README.md` for setup.

## Key Files

- `src/` — frontend
- `src/api/client.js` — API client (`api`)
- `src/api/own/` — HTTP, auth, entities, functions, integrations, realtime
- `server/` — Express + Prisma (`npm run dev:server`)
- `server/src/schemas/` — entity JSON Schema + RLS
- `vite.config.js` — Vite + `/api` proxy to `VITE_OWN_API_URL`
- `.env.local` — local env; never commit secrets
- `.cursor/skills/port-base44/` — on-demand skill to port Base44 GitHub updates (say `port-base44`)

## Working Notes

- Default stack: `npm run dev:server` + `npm run dev` (or `npm run dev:all`)
- Frontend API base: `VITE_OWN_API_URL` (default `http://localhost:3001`)
- Run relevant `package.json` checks before finishing changes
