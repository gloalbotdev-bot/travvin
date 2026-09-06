# Milestone 10 status

Date: 2026-08-05 (updated: Gemini-only)

## Decision

All `InvokeLLM` traffic via **Gemini only** — see [decisions.md](./decisions.md) §5.  
`POST /api/ai/invoke-llm` keeps the Base44 input contract. UploadFile stays on Base44 until M11.

## Done

- Server: `server/src/lib/llm/gemini.js` + `index.js` + `routes/ai.js`
- Text / JSON schema / `add_context_from_internet` → same `GEMINI_API_KEY`
- Client: `VITE_BACKEND_AI=own` (UploadFile still Base44)
- No auth on invoke (guests use `/chat`)
- Smoke: `npm run test:llm`

## Env (server/.env) — what you need

```
GEMINI_API_KEY=...          # required for live AI
# GEMINI_MODEL=gemini-3.5-flash   # optional; default gemini-3.5-flash
# LLM_MOCK=1                      # optional; forces mock without calling Google
```

**Do not add `OPENAI_API_KEY`** — unused.

Get a key: [Google AI Studio](https://aistudio.google.com/apikey)

## Flip (.env.local)

```
VITE_BACKEND_AI=own
```

## Verify

```bash
cd server
npm run test:llm
```

## Next

**M11** — DONE (see [m11-status.md](./m11-status.md)). Next: **M12** remove vite-plugin.
