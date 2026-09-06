# Milestone 7 status

Date: 2026-08-05

## Done

- `server/src/lib/geocode-addresses.js` — sequential Nominatim, no delay, `User-Agent: ZimmerBot/1.0 (desktop-search)`, `{ results: [{ address, lat, lng }] }`
- `server/src/routes/functions.js` — `POST /api/functions/geocodeAddresses` (requires auth)
- `src/api/own/functions.js` — `invoke()` returns `{ data }` like SDK; **geocodeAddresses** on own server; other names fall back to hosted Base44
- `src/api/client.js` — `VITE_BACKEND_FUNCTIONS` flag + `useOwnFunctions` export
- Smoke: `npm run test:geocode`

## Flip to own geocode (local test)

Requires `VITE_BACKEND_AUTH=own` (function checks JWT).

In `.env.local`:

```
VITE_BACKEND_FUNCTIONS=own
VITE_OWN_API_URL=http://localhost:3001
```

Restart Vite. Open `/desktop-search` while logged in — map pins should populate.

**Rollback:** `VITE_BACKEND_FUNCTIONS=base44`

## Verify

```bash
cd server
npm run test:geocode
npm run test:auth
```

Manual: `/desktop-search` → search → counter "X מתוך Y צימרים ממוקמים על המפה" shows located count.

## Notes

- Coords stay in client `coordsCache` only (not persisted) — faithful to baseline
- `pushInAppNotification` / calendar functions still invoke Base44 when flag=own (fallback until M8/M8.5)

## Next

**Milestone 8.5** — DONE (see [m85-status.md](./m85-status.md)). Next: **M8** calendar.
