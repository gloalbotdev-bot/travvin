# Milestone 13 status

Date: 2026-08-09

## Decision

Point of no return for the Base44 **SDK**. All frontend API traffic is own-backend. Rollback = git revert + `npm install`.

Included with SDK removal (needed for zero `@base44` in `src/`): deleted unused `OwnerAgentChat.jsx` (abandoned agents runtime — [decisions.md](./decisions.md) §1 / M16). Owner panel already uses `OwnerInfoAssistant`.

## Done

- Deleted `src/api/base44Client.js`
- `src/api/client.js` — own-only client (keeps export name `base44` for consumers)
- `AuthContext` — own public-settings only; no SDK axios
- `app-params.js` — no `VITE_BASE44_*`; token via `access_token` + grace read of `base44_access_token` / `token`
- `http.js` — writes `access_token`, still reads legacy keys
- `functions.js` — own map only (no Base44 fallback)
- `realtime.js` — always on; optional `VITE_REALTIME_TRANSPORT`
- `npm uninstall @base44/sdk`
- `.env.example` / `.env.local` / README cleaned of migration flags

## Env (.env.local)

```
VITE_OWN_API_URL=http://localhost:3001
# VITE_REALTIME_TRANSPORT=polling
```

Remove all `VITE_BACKEND_*=…` and `VITE_BASE44_*=…`.

## Verify

```bash
# no matches expected:
rg "@base44" src package.json

npm run build
npm run typecheck
npm run lint
```

Manual: login (Google + email), owner zimmers, upload, chat, calendar status.

`npm run build` ✅. `typecheck` / `lint` still report pre-existing UI unused-import / prop typing issues (not introduced by M13).

## Next

**M14** — DONE (see [m14-status.md](./m14-status.md)). Next: **M15** deferred fixes (after stability).
