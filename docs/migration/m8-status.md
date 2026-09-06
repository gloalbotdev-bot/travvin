# Milestone 8 status

Date: 2026-08-05

## Decision

Per-owner Google Calendar (Option B) — see [decisions.md](./decisions.md) §4.

## Done

- Prisma: `CalendarProvider` / `CalendarConnectionStatus` enums + `CalendarConnection` table
- SQL: `server/prisma/sql/003_calendar.sql` + `npm run db:apply-calendar`
- AES-256-GCM token crypto (`CALENDAR_TOKEN_ENCRYPTION_KEY`)
- OAuth connect/status/disconnect: `/api/connectors/google-calendar/*`
- Real `calendar_id` from calendarList (not alias `primary`)
- `addBookingToCalendar` / `syncGoogleCalendar` on own backend (ownership + per-owner connection)
- SyncState: `owner_id`, `provider`, `last_sync_attempt` + RLS
- Cron `*/30` Asia/Jerusalem with per-owner isolation + one transient retry
- UI: CalendarSyncCard + AccountSettings connect
- Smoke: `npm run test:calendar`

## Env (server/.env)

```
CALENDAR_TOKEN_ENCRYPTION_KEY=<openssl rand -base64 32>
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3001/api/connectors/google-calendar/oauth/callback
# optional reuse of GOOGLE_CLIENT_ID / SECRET
```

Add redirect URI in Google Cloud Console.

## Flip

Requires `VITE_BACKEND_FUNCTIONS=own` (already for geocode/push).

## Verify

```bash
cd server
npm run db:apply-calendar
npx prisma generate
npm run test:calendar
npm run test:authz
```

Manual: owner Connect calendar → approve booking → event on that owner's calendar → auto_sync cron / manual sync.

## Next

**M9** — DONE (see [m9-status.md](./m9-status.md)). Next: **M10** InvokeLLM.
