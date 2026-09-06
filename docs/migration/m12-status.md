# Milestone 12 status

Date: 2026-08-09

## Decision

Remove `@base44/vite-plugin`. Keep `@base44/sdk` until M13. Vite provides `@` alias + `/api` proxy to the own backend (`VITE_OWN_API_URL` / `localhost:3001`).

**Note:** Domain-flag rollback to Base44 that relied on the plugin proxying `/api` → `VITE_BASE44_APP_BASE_URL` no longer works; rollback for this milestone is **git revert**. Own clients already use absolute `VITE_OWN_API_URL`. Abandoned agent UI (`OwnerAgentChat`) may break until M16 removes it.

## Done

- `vite.config.js` — react only; `resolve.alias` `@` → `src`; proxy `/api` → own API; keep `.js`→jsx optimizeDeps loader
- `npm uninstall @base44/vite-plugin`
- README note for proxy / `dev:server`
- No `legacySDKImports` / HMR / analytics / visual-edit injections

## Verify

```bash
npm run dev          # no "[base44] Proxy enabled: … trav-vin.com"
npm run build
npm run preview
```

With `npm run dev:server` up: login, list zimmers, upload, HMR edit.

## Rollback

```bash
git revert <m12-commit>
```

## Next

**M13** — DONE (see [m13-status.md](./m13-status.md)). Next: **M14** cleanup `base44/` schemas copy.
