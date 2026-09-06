# File mapping — Base44 → Travvin

Use this when classifying a `git diff` from the vendor repo. Travvin is an own Express/Prisma backend; Base44 remains a React + `base44/` platform tree.

## Port (with translation)

| Base44 path | Travvin target | How |
|---|---|---|
| `src/pages/*` | same path | Keep UI; rewrite SDK imports to `import { api } from '@/api/client'` |
| `src/components/*` (except items below) | same path | Same import rewrite |
| `src/hooks/*`, `src/lib/*` (non-auth) | same path | Port behavior; do not reintroduce `@base44/sdk` |
| New form field on existing entity | UI + `server/src/schemas/<Entity>.jsonc` | JSONB — no Prisma column per field |
| New entity or new RLS | `server/src/schemas/` + `server/src/lib/authz.js` | Translate RLS; add smoke if needed |
| `base44/entities/*.jsonc` | `server/src/schemas/*.jsonc` | Copy schema/RLS intent, not the folder |
| `base44/functions/<name>/entry.ts` | `server/src/lib/` + `server/src/routes/functions.js` | Reimplement in Node; do not paste Deno |
| `base44/workflows/*.jsonc` | `server/src/lib/entity-hooks.js` and/or `server/src/jobs/` | Translate triggers to hooks/cron |
| New npm UI dependency in Base44 `package.json` | root `package.json` | Add only packages the ported UI actually imports |

## Never copy (unless the user explicitly overrides)

| Path / artifact | Why |
|---|---|
| `src/api/base44Client.js` | Replaced by `src/api/client.js` + `src/api/own/` |
| `@base44/sdk`, `@base44/vite-plugin` | Removed in M12–M13 |
| Base44 `vite.config.js` | Travvin proxies `/api` to `VITE_OWN_API_URL` |
| Entire `base44/` tree as a folder | Schemas live under `server/src/schemas/` |
| `src/pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx` | Removed; own auth/Google OAuth |
| `src/components/owner/OwnerAgentChat.jsx` | Product: `OwnerInfoAssistant` instead (see decisions) |
| `base44/agents/zimmer_manager.jsonc` | Same decision; restore only if user overrides |
| Base44 README / `base44/config.jsonc` / CLI-only files | Not the Travvin stack |

## Product decisions (keep unless user overrides)

Source: `docs/migration/decisions.md`.

- Owner tab assistant: `OwnerInfoAssistant`, not `OwnerAgentChat` / `zimmer_manager`.
- LLM: Gemini only (`GEMINI_API_KEY`), not OpenAI.
- Google Calendar: per-owner connection, cron-only (`*/30`), no public webhook.
- API facade name: `api` from `src/api/client.js`, not `base44`.

## Import rewrite

Base44 typically has:

```js
import { base44 } from '@/api/base44Client';
```

Travvin:

```js
import { api } from '@/api/client';
```

Replace `base44.entities` / `base44.auth` / `base44.functions` / `base44.integrations` with the same shape on `api`. Do not restore `base44.agents` unless the user overrides the agent decision.

## Auth / calendar / LLM files — extra caution

Diffs touching these need review-gates.md **and** an explicit user confirm even if no bug is found:

- `src/lib/AuthContext.jsx`, `src/lib/app-params.js`
- `src/components/owner/CalendarSyncCard.jsx`
- InvokeLLM call sites (`VacationAgentChat`, admin/owner assistants)
- `server/` equivalents: `server/src/lib/google-*.js`, `server/src/lib/llm/`, `server/src/routes/auth.js`

A 1:1 UI port must not undo server-side booking overlap, pricing, or RLS already in Travvin.
