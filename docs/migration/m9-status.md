# Milestone 9 status

Date: 2026-08-05

## Decision

Faithful restore of Base44 entity notification workflows + Review Auto Publish waits. Calendar cron already in M8; Google Calendar webhook skipped ([decisions.md](./decisions.md) §2).

## Done

- 8 notify hooks → `pushInAppNotification` on entity create/update (`entity-hooks.js`)
- Review create `pending_publish` → wait 12h; `pending_owner` → wait 48h → `finalizeReviewAutoPublish`
- `DelayedJob` table + `npm run db:apply-delayed-jobs`
- Worker cron every minute (`DELAYED_JOBS_DISABLED=1` to skip)
- Env: `NOTIFICATIONS_ENABLED=false` disables notify hooks only (Review enqueue still runs)
- Env: `REVIEW_WAIT_MS` overrides wait for local/smoke tests
- Smoke: `npm run test:workflows`

## Verify

```bash
cd server
npm run db:apply-delayed-jobs
npx prisma generate
npm run test:workflows
npm run test:functions
```

Restart `npm run dev` / `npm run dev:server` so hooks + delayed-jobs cron load.

## Next

**M10** — DONE (see [m10-status.md](./m10-status.md)). Next: **M11** UploadFile.
