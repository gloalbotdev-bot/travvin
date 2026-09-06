# Milestone 5 status

Date: 2026-08-05

## Done

- Prisma: `User`, `OtpCode`, `PasswordResetToken`, `AppSettings`
- SQL: `server/prisma/sql/002_auth.sql` + `npm run db:apply-auth`
- JWT, bcrypt passwords, OTP (console delivery when no SMTP)
- Google OAuth: `/api/auth/google` + callback → `?access_token=` on frontend
- Routes: `/api/auth/*`, `/api/app/public-settings`, `/api/users/invite`
- `User` entity CRUD → `users` table (not JSONB `records`)
- Frontend: `src/api/own/auth.js`, `own/users.js`, `own/http.js`
- `VITE_BACKEND_AUTH` flag in `client.js` (**default `base44`**)
- `AuthContext.jsx` branches to own public-settings when flag=own
- Smoke: `npm run test:auth`

## What you need to provide (server/.env)

| Variable | Required for | Notes |
|---|---|---|
| `JWT_SECRET` | Any own auth | Long random string |
| `GOOGLE_CLIENT_ID` | Google login | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Google login | Same OAuth client |
| `GOOGLE_REDIRECT_URI` | Google login | `http://localhost:3001/api/auth/google/callback` |
| `FRONTEND_URL` | OAuth redirect | `http://localhost:5173` (or your Vite port) |
| `SMTP_*` | Email OTP/reset | Optional — codes log to server console in dev |

## Flip to own auth (local test)

1. Fill `server/.env` (see above)
2. `cd server && npm run db:apply-auth && npm run dev`
3. In `.env.local`:
   ```
   VITE_BACKEND_AUTH=own
   VITE_OWN_API_URL=http://localhost:3001
   ```
4. `npm run dev` (frontend) — Google login on `/welcome` or `/join`

To also use own entities (needs seed data):
```
VITE_BACKEND_ENTITIES=own
```

## Notes

- Email/password + OTP work without Google; OTP prints to server log if no SMTP
- `Login`/`Register` pages exist but are **not routed** in App.jsx (same as baseline)
- `updateMe({ role })` self-escalation preserved (deferred-fix #11)
- `inviteUser` has no server admin gate (deferred-fix #1)

## Verify

```bash
cd server
npm run test:auth
npm run test:authz
npm run test:contract
```

## Next

**Milestone 6** — DONE (see [m6-status.md](./m6-status.md)). Next: **M7 geocode** or P1 calendar/workflows.
