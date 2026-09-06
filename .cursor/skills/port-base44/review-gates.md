# Review gates — ask before porting

Run this **after** classifying files and **before** any Travvin source edit. Incoming Base44 code is not trusted 1:1.

If a 1:1 port would reintroduce a gap Travvin already closed on the server, treat that as a finding even if Base44 "always worked that way."

## Finding format

For each finding, show in Hebrew:

- File(s)
- What is wrong (bug, security, or regression vs Travvin hardening)
- What you recommend
- Three options only: **לתקן תוך כדי העברה** / **להעביר 1:1 ולדחות תיקון** / **לדלג על השינוי הזה**

Do not port, skip, or "quietly harden" until the user picks. If there are zero findings, still list the classified changes and ask to confirm the port set.

## Security

- **XSS** — `dangerouslySetInnerHTML`, unsanitized markdown/HTML from users or LLM, unescaped entity fields in HTML.
- **IDOR / tenancy** — `owner_id`, `user_id`, or record ids taken from the client and trusted; missing owner/admin checks.
- **Client-only authz** — hide/show in React without server RLS / `server/src/lib/authz.js` equivalent.
- **Secrets** — API keys, tokens, `.env` values, calendar refresh tokens in source or committed files.
- **Open redirect** — login/return URLs from query string without allowlist.
- **Upload** — path traversal, unrestricted MIME, public overwrite of others' files.
- **Webhooks** — new public HTTP endpoints without auth (Travvin calendar is cron-only unless the user overrides).
- **LLM** — prompt injection via user/entity text; tools that delete or change data without server checks; sending secrets into prompts.
- **Pricing / booking** — price, overlap, or status changes only in the frontend; Travvin already enforces some of this in `server/src/lib/booking-guards.js` and related routes.

## Bugs and regressions

- Broken imports, undefined symbols, dead routes after a page add/rename.
- New entity/field used in UI but missing from `server/src/schemas`.
- New function/workflow in `base44/` with no Travvin server equivalent — do not leave a UI button calling a missing API.
- Logic errors (wrong status, inverted conditions, timezone `Asia/Jerusalem` mistakes).
- Reintroducing `OwnerAgentChat`, Base44 SDK, or Login/Register pages without an explicit override.
- Weakening M15-style validation (see `docs/migration/deferred-fixes.md` / `docs/migration/m15-status.md`).

## How to ask

Prefer AskQuestion with one question per finding (or grouped only when they share the same file and the same three options). Wait for all answers before `git checkout -b port/base44-YYYYMMDD` and before editing Travvin files.
