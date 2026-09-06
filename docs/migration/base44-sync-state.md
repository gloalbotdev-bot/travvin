# Base44 → Travvin sync state

Used by skill `port-base44`. Empty `last_seen_sha` means **first cycle**: diff `pre-migration` (Travvin tag) against `base44/main`.

Do not push to remote `base44`. Travvin `origin` stays `https://github.com/gloalbotdev-bot/travvin.git`.

## Setup

| Field | Value |
|---|---|
| remote_name | `base44` |
| remote_url | `https://github.com/gloalbot-boop/travvin-basee.git` (fetch only) |
| vendor_branch | `vendor/base44` (tracks `base44/main`, never merge into Travvin `main`) |
| first_cycle_from | `pre-migration` (`79ff145`) |
| last_seen_sha | `a9dba46fb300904d5eab212986b1f9978327545f` |
| last_seen_tag | `base44-seen-a9dba46` |
| partial_ui_to | `12593c2` (Owner UI + customer components additive; auth/routing deferred — see cycle log) |

## Cycle log

| Date | Mode | From | To (base44/main) | Travvin branch | Notes |
|---|---|---|---|---|---|
| 2026-08-18 | first | `79ff145` (pre-migration) | `121d851` | port/base44-2026-08-18 | Schemas, functions, cron, UI ported with security hardening |
| 2026-09-02 | subsequent | `121d851` | `a9dba46` | port/base44-20260902 | Discover/video, guest profiles, owner UI, Zimmer rooms/location; OwnerInfoAssistant extended (no zimmer_manager) |
| 2026-09-06 | subsequent **partial** | `a9dba46` | `12593c2` | port/base44-ui-20260906 | Owner bookings/messages/statistics + `getOwnerStatistics` (scoped); customer UI files additive; **deferred** Landing/`CustomerHome` swap + role lock ([decisions.md §6](./decisions.md)); `last_seen_sha` **not** advanced until auth/routing closed |
