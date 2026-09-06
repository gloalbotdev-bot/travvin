# Milestone 8.5 status

Date: 2026-08-05

## Done

- `server/src/lib/push-in-app-notification.js` — no auth, service-role `SystemMessage.create`, `if (!title)` → 400
- `server/src/lib/finalize-review-auto-publish.js` — no auth, publishes `pending_publish`/`pending_owner` only
- `server/src/lib/service-role.js` — internal admin actor for asServiceRole restore
- `server/src/routes/functions.js` — `POST /api/functions/pushInAppNotification`, `POST /api/functions/finalizeReviewAutoPublish`
- `src/api/own/functions.js` — routes push/finalize without Bearer (faithful no-auth)
- Smoke: `npm run test:functions`

## Requires (already set for local dev)

```
VITE_BACKEND_FUNCTIONS=own
VITE_BACKEND_ENTITIES=own
VITE_BACKEND_AUTH=own
VITE_OWN_API_URL=http://localhost:3001
```

Calendar functions still fall back to Base44 until M8.

## Verify

```bash
cd server
npm run test:functions
npm run test:geocode
```

Manual:

1. Logged-in customer writes a review → owner gets in-app notification (SystemMessage)
2. `curl -X POST http://localhost:3001/api/functions/finalizeReviewAutoPublish -H "Content-Type: application/json" -d "{\"review_id\":\"<pending-id>\"}"` → `{ action: "published" }`
3. Repeat on same id → `{ action: "skipped" }`

## Notes

- Endpoints intentionally unauthenticated (deferred-fixes #4 #22 #24)
- Review wait → finalize is wired in M9 (`delayed_jobs` + cron)

## Next

**M9** — DONE (see [m9-status.md](./m9-status.md)). Next: **M10** InvokeLLM.
