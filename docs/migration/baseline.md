# Migration baseline

Date: 2026-08-03  
Node: v22.22.0  
npm: 10.9.2  
Tag: `pre-migration` (commit after initial import)

## Local run

| Check | Result |
|---|---|
| `npm ci` | OK (628 packages) |
| `leaflet` in package.json | OK (^1.9.4) |
| `npm run build` | OK — Vite 6.4.3; proxy `/api` → `https://trav-vin.com` |
| `npm run dev` | OK — http://localhost:5174/ (5173 was busy) |
| Landing HTTP | 200 |
| Base44 CLI global install | **FAILED** — NetFree blocked `npm.jsr.io` (E418). Use hosted backend + `npm run dev` until CLI is available. |
| `VITE_BASE44_APP_ID` | **PLACEHOLDER** in `.env.local` — replace with real dashboard value |

## Manual route checklist

See [decisions.md](./decisions.md). Fill after logging in as admin + owner.

## Tooling baseline (after jsconfig/eslint fix)

| Command | Result |
|---|---|
| `npm run typecheck` | Fails — **438** existing errors now visible. Accepted baseline; not fixed in prep. |
| `npm run lint` | Fails — **18** unused-import errors (auto-fixable). Accepted baseline. |
| `npm run build` | Pass |
| jsconfig includes `src/api`, `src/lib`, `.jsx` | Yes |
| eslint covers `src/api`, `src/hooks`, `src/lib`, App/main | Yes |

## Decisions locked

See [decisions.md](./decisions.md): abandon agent; calendar cron-only; restore review wait jobs.
