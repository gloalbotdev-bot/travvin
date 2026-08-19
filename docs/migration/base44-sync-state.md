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
| last_seen_sha | `121d851acfc9e526326aa18aecc1ccd13384d628` |
| last_seen_tag | |

## Cycle log

| Date | Mode | From | To (base44/main) | Travvin branch | Notes |
|---|---|---|---|---|---|
| 2026-08-18 | first | `79ff145` (pre-migration) | `121d851` | port/base44-2026-08-18 | Schemas, functions, cron, UI ported with security hardening |
