# Milestone 6 status

Date: 2026-08-05

## Done

- **6a polling:** `src/api/own/realtime.js` — `subscribe(cb)` polls `list('-updated_date', 100)` every 3s, diffs snapshots, emits `{ type, id, data? }` events matching SDK shape
- **6b SSE (optional):** `server/src/routes/events.js` + `server/src/lib/entity-events.js` — CRUD publishes in-process; SSE filtered per-actor via `can(read)`
- `src/api/own/entities.js` — subscribe wired through realtime module (no-op when flag off)
- `src/api/client.js` — `VITE_BACKEND_REALTIME` flag + `useOwnRealtime` export
- Auth middleware accepts `?token=` for EventSource (no custom headers)
- Consumers unchanged (7 call sites in 5 files)

## Flip to own realtime (local test)

Requires `VITE_BACKEND_ENTITIES=own` and `VITE_BACKEND_AUTH=own` (already set in many dev setups).

In `.env.local`:

```
VITE_BACKEND_REALTIME=own
VITE_OWN_API_URL=http://localhost:3001
```

Optional SSE instead of polling:

```
VITE_REALTIME_TRANSPORT=sse
```

Restart Vite after changing env vars.

**Rollback:** `VITE_BACKEND_REALTIME=base44` (subscribe becomes no-op on own entities).

## Verify

1. `npm run dev:server` + `npm run dev`
2. Two browser windows — same user roles (customer + owner):
   - Create `SystemMessage` → unread badge updates in `useUnreadNotifications` / `useOwnerSystemUnread`
   - Send `DirectChat` message → appears on other side within ~3s (polling) or immediately (SSE)
   - New `UnansweredQuestion` → `FloatingQuestionsWidget` badge updates
3. DevTools → no lingering intervals after navigating away (unmount clears subscription)
4. `npm run build` passes

## Notes

- Polling window is last 100 records by `updated_date`; deletions outside that window may not fire `delete` events (same class of limitation as SDK polling fallback)
- SSE reconnects after 5s on error
- `agents.subscribeToConversation` — out of scope (M16 / abandoned)

## Next

**Milestone 7** — DONE (see [m7-status.md](./m7-status.md)). Next: **M8** calendar.
