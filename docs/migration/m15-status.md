# Milestone 15 — COMPLETE

Date: 2026-08-10  
Status: **All deferred-fixes registry items closed or explicitly N/A/deferred.**

## Summary

| Batch | Items | Status |
|---|---|---|
| A–C Security | #1–#5, #11, #18–#24 | ✅ |
| D Data/logic | #9, #10, #21 | ✅ |
| E Data/logic | #6 N/A, #7, #8, #12 | ✅ |
| F Hygiene | #8ב, #13, #14, #15 | ✅ |

## Explicit exclusions (not M15)

| # | Item | Disposition |
|---|---|---|
| **16** | Agent info/edit server enforcement (`zimmer_manager`) | **Deferred → M16** per [decisions.md](./decisions.md) §1 |
| **17** | Google Calendar webhook auth | **N/A** — cron-only sync |
| **6** | Shared primary calendar | **N/A** — per-owner calendar (M8) |

## Automated verification

From repo root:

```bash
npm run test:server          # all contract tests (no live LLM)
cd server && npm run test:all:live   # + optional Gemini live test
```

Individual suites: `test:auth`, `test:authz`, `test:booking`, `test:calendar`, `test:geocode`, `test:validation`, `test:assistant`, `test:workflows`, `test:upload`, `test:llm`.

## Manual verification

Use [current-state-smoke.md](./current-state-smoke.md) — fill the checklist in one pass before production.

## Migration program status

**M1–M15:** complete.  
**M16 (agent restore):** optional product decision — see [m16-restore-guide.md](./m16-restore-guide.md).

Next doc: [MIGRATION-COMPLETE.md](./MIGRATION-COMPLETE.md).
