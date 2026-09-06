# Milestone 4.5 status

Date: 2026-08-04

## Done

- `docs/migration/authz-baseline.md` — declared RLS + provisional open default for 12 undeclared entities
- `server/src/lib/authz.js` — rule evaluator (`$or`, `user_condition`, `data.*` templates)
- `server/src/middleware/entity-authz.js` — `attachActor` from `x-user-id` / `x-user-email` / `x-user-role`
- Entity store + routes enforce authz on get/create/update/delete; list/filter use `readScopeWhere`
- DirectChat: party or admin only
- SystemMessage: read open; write admin|owner
- Smoke: `npm run test:authz` (from `server/`)

## Notes

- Cross-user live Base44 probe **not run** (no second login account) — undeclared policy is provisional; checklist in baseline to re-measure
- Permissive paths cite deferred-fixes **#1 #2 #3 #18 #20 #23**
- SuperAdmin gate stays client-only (faithful restore)
- Actor headers are temporary until M5 JWT

## Verify

```bash
cd server
npm run test:contract
npm run test:authz
```

## Next

**Milestone 5** — DONE (see [m5-status.md](./m5-status.md)). **M6 realtime** — DONE (see [m6-status.md](./m6-status.md)).
