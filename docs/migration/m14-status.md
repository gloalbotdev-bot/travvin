# Milestone 14 status

Date: 2026-08-09

## Decision

Delete legacy `base44/` platform export tree after copying entity schemas (+ RLS) into `server/src/schemas/`. Favicon/manifest local. Package name `travvin`. API facade export renamed `api` (was historical `base44`).

## Done

- Copied 14 `*.jsonc` → `server/src/schemas/` (incl. DirectChat / SystemMessage / SyncState `rls`)
- `schema-loader.js` loads only `server/src/schemas`
- Deleted entire `base44/` (entities, functions, workflows, agent, connector, config)
- `public/favicon.svg` + `public/manifest.json`; `index.html` no longer points at external logo CDN
- `package.json` name → `travvin`
- README / AGENTS updated
- Facade: `src/api/client.js` exports `api`; consumers updated

## Remaining `base44` string hits (intentional)

- `media.base44.com` in `image.jsx` (Wix transform host) and a few dashboard demo image URLs — live CDN assets, not the platform SDK
- `docs/migration/**` history

## Verify

```bash
# schemas still load without base44/
node -e "import('./server/src/lib/schema-loader.js').then(m => console.log(m.listEntityNames().length))"

npm run build
```

Restart `dev` + `dev:server`; smoke login / zimmers / upload.

## Next

**Product:** use `/owner` assistant (`OwnerInfoAssistant`) for a while; restore path documented in [m16-restore-guide.md](./m16-restore-guide.md).  
**Engineering next:** **M15** deferred-fixes (after stability) — [deferred-fixes.md](./deferred-fixes.md).
