# Current-state smoke (post migration)

Date: 2026-08-11  
Account: `gw38452@gmail.com` (owner + admin) + `rutc1313@gmail.com` (customer) + public (לא מחובר).

**מטרה:** סבב בדיקה אחד מרוכז לפני פרודקשן — מלא את הטבלאות ב-✓ / ✗.

## 1. Automated (הרץ קודם)

From repo root:

```bash
npm run test:server
```

Optional live Gemini:

```bash
cd server && npm run test:llm
```

| Check | Command | Result |
|---|---|---|
| Health | `GET /api/health` → `{ ok: true, db: true }` | ✓ |
| Full contract suite | `npm run test:server` | ✓ |
| Live LLM (optional) | `npm run test:llm` | ⬜ |

`test:server` covers: validation, entities, auth, authz, booking, calendar, geocode, functions, workflows, assistant ops, upload.

## 2. Manual — 11 routes

Mark ✓ / ✗ after visit. Public = logged out. Owner+admin = `gw38452@gmail.com`.

| Route | Public | Owner | Admin |
|---|---|---|---|
| `/` Landing | ✓ | ✓ | ✓ |
| `/welcome` | ✓ | ✓ | ✓ |
| `/admin-login` | ✓ | — | ✓ |
| `/chat` | — | ✓ | ✓ |
| `/promotions` | ✓ | ✓ | ✓ |
| `/owner` | — | ✓ | — |
| `/superadmin` | — | — | ✓ |
| `/join` | ✓ | ✓ | — |
| `/account-settings` | — | ✓ | ✓ |
| `/customer-portal` | — | ✓ | ✓ |
| `/desktop-search` | — | ✓ | ✓ |

\* אחרי login, `/` מפנה אוטומטית לפי תפקיד.

## 3. Owner product flows

| Flow | Result |
|---|---|
| Login Google | ✓ |
| Edit zimmer + save | ✓ |
| Upload image (`/uploads`) | ✓ |
| Legacy `media.base44.com` image still shows | N/A |
| Create booking + approve (overlap → 409 Hebrew message) | ✓ |
| Assistant **info** mode — read-only | ✓ |
| Assistant **edit** mode — create/update zimmer, add booking | ✓ |
| Calendar sync card (Dashboard, not Calendar tab) | ✓ |
| Review create + owner compromise offer (rating 1–3) | ✓ |

## 4. Customer flows

| Flow | Result |
|---|---|
| Chat search + book | ✓ |
| Portal → **השאלות שלי** tab | ✓ |
| Portal → bookings / reviews / updates | ✓ |

## 5. Security spot checks (M15)

| Check | Expected | Result |
|---|---|---|
| Logout → chat history not visible to next user | empty / own only | ✓ |
| Non-owner cannot PATCH another owner's zimmer | 403 | ✓ |
| `pushInAppNotification` from browser | 403 | ✓ |
| Review rating 6 via API | 400 | ✓ |

## Smoke verdict

**Overall:** ✓ PASS

Notes:

- Smoke completed 2026-08-11. Account `rutc1313@gmail.com` used for cross-user 5ד.
- During smoke: booking overlap 409 on cancel fixed (`entity-store.js`); Zimmer RLS added after 5ד returned 200 pre-fix.
- Google Calendar sync card is on **Dashboard** tab, not Calendar tab.
- Review compromise flow requires overall rating **1–3** (`pending_owner`); rating 4+ → auto-publish queue only.

---

## 6. Optional extended security (not required for smoke PASS)

Already covered by `npm run test:server` unless noted. Run manually only if hardening before prod.

| Check | Expected | Covered by |
|---|---|---|
| `finalizeReviewAutoPublish` from browser | 403 | test:functions |
| `addBookingToCalendar` for another owner's booking | 403 | test:calendar |
| `executeOwnerAssistantOp` with wrong `owner_id` | 403 | test:assistant |
| Stranger GET another user's `BookingRequest` | 403 | test:authz |
| Stranger GET `Contact` / `CustomerProfile` | 403 | test:authz |
| `User.update` with `role: admin` from browser | 403 | test:authz |
| Upload without auth | 401 | test:upload |
| Google Calendar OAuth as customer (`role: user`) | 403 | manual |
| `SystemMessage.create` as owner | 403 | test:authz |
| `Promotion` / `OwnerRequest` PATCH by stranger | open (no RLS yet) | known gap |

---

## Reference

- Migration closed: [MIGRATION-COMPLETE.md](./MIGRATION-COMPLETE.md)
- M16 agent (optional): [m16-restore-guide.md](./m16-restore-guide.md)
