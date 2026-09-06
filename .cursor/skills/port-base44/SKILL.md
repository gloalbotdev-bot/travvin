---
name: port-base44
description: >-
  Ports Base44 GitHub updates into the Travvin own-backend repo. Use when the
  user says port-base44, asks for a Base44 sync/port cycle, or wants to migrate
  changes from the Base44-connected GitHub repository into this project.
disable-model-invocation: true


# port-base44

Read [mapping.md](mapping.md) and [review-gates.md](review-gates.md) before classifying or editing. Read [docs/migration/base44-sync-state.md](../../../docs/migration/base44-sync-state.md) for cycle mode.

Travvin `origin` is `https://github.com/gloalbotdev-bot/travvin.git`. The Base44-connected repo is a **read-only** vendor source.

## Hard rules

- Never `git push` to remote `base44`. Never change `origin` to the Base44 repo.
- Never merge `base44/main` (or `vendor/base44`) into Travvin `main`.
- Never copy items in the mapping.md "never copy" list unless the user explicitly overrides.
- **Stop before any Travvin source edit** until the user answers every review-gate question. Do not fix silently. Do not port 1:1 silently.
- PowerShell: chain commands with `;` not `&&`.
- Do not commit or push until the user approves at the end of the cycle.

## Workflow

Copy and track:

```
Cycle progress:
- [ ] 1. Setup / fetch
- [ ] 2. Choose first vs subsequent diff
- [ ] 3. Classify files (mapping.md)
- [ ] 4. Review bugs/security (review-gates.md)
- [ ] 5. STOP — ask user per finding
- [ ] 6. Wait for answers
- [ ] 7. Branch port/base44-YYYYMMDD
- [ ] 8. Port according to answers
- [ ] 9. test:server + build + smoke of touched screens
- [ ] 10. Summary — ask commit and push
- [ ] 11. On approval: commit, merge main, push origin
- [ ] 12. Update state file + tag base44-seen-<shortsha>
```

### 1. Setup / fetch

If remote `base44` is missing:

```powershell
git remote -v
```

Stop and ask for the Base44 GitHub URL. After the user provides it:

```powershell
git remote add base44 <URL>
git remote set-url --push base44 DISABLE
git fetch base44
git branch -f vendor/base44 base44/main
```

If remote exists: `git fetch base44` then `git branch -f vendor/base44 base44/main`.

If fetch fails (auth / private repo), stop and tell the user what access is needed. Do not invent a URL.

### 2. First vs subsequent

Read `docs/migration/base44-sync-state.md`.

- `last_seen_sha` empty → **first cycle**:

```powershell
git diff --stat pre-migration base44/main
git diff --name-status pre-migration base44/main
```

- `last_seen_sha` set → **subsequent cycle** (Base44 vs previous Base44 snapshot only):

```powershell
git diff --stat <last_seen_sha> base44/main
git diff --name-status <last_seen_sha> base44/main
```

If `base44/main` equals `last_seen_sha`, stop: nothing new to port.

Inspect diffs for changed files. Do not apply patches onto Travvin `main`.

### 3–6. Classify, review, ask, wait

Classify every changed path using mapping.md.

Run the review-gates.md checklist on incoming Base44 code **and** on how a 1:1 port would interact with Travvin server-side hardening.

Present findings in Hebrew. For each finding, ask exactly one of:

1. לתקן תוך כדי העברה
2. להעביר 1:1 ולדחות תיקון
3. לדלג על השינוי הזה

Use AskQuestion when available. **No Travvin file edits until every finding is answered.** If there are no findings, still list the classified change set and ask the user to confirm before porting.

Preserve product decisions unless the user overrides (see mapping.md).

### 7–8. Port

```powershell
git checkout main
git pull origin main
git checkout -b port/base44-YYYYMMDD
```

Use today's date. Port only approved items. Translate Base44 backend/functions/workflows into Travvin server code; do not paste Deno/`@base44` as-is.

Frontend: keep Travvin `import { api } from '@/api/client'` (not `base44` from the SDK client).

### 9. Verify

From repo root:

```powershell
npm run test:server
npm run build
```

Smoke the screens that changed (see `docs/migration/current-state-smoke.md` if useful). Fix breakages from the port itself without reopening deferred review items.

### 10–11. Git (only after user approval)

Ask to commit and push. On explicit approval:

1. Commit on `port/base44-YYYYMMDD` (no secrets; no `--no-verify`).
2. Checkout `main`, merge the port branch, `git push origin main`.
3. No force-push. Do not push `base44` or `vendor/base44`.

### 12. Record the snapshot

Set `last_seen_sha` to `git rev-parse base44/main`. Create tag `base44-seen-<shortsha>` pointing at that vendor commit. Append a cycle row to the state file (date, from-ref, to-sha, branch, notes).

## User trigger

User says `port-base44` (or «סבב port-base44» / «תריצי port-base44»).
