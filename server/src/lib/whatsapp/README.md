# WhatsApp provider layer

All WhatsApp traffic goes through this folder. The rest of the server never builds a provider payload, reads a provider response, or parses a provider webhook.

**Switching providers (WHAPI → Meta) means writing one provider file plus one line in `index.js`.** `providers/whapi.js` is the only file that knows WHAPI endpoints, payloads and webhook shapes.

```
lib/whatsapp/
  contract.js              WhatsAppProvider interface + normalized types (JSDoc)
  index.js                 Facade: createWhatsAppProvider(), sendWhatsAppText(), deliverWhatsAppText()
  outbox.js                Process-wide send queue: min gap between sends, pause on plan/rate limit
  message-log.js           WhatsAppMessage log: audit, delivery receipts, inbound de-duplication
  helpers.js               Provider-neutral helpers (phone normalization, media kind, shared-secret check)
  providers/whapi.js       WHAPI (gate.whapi.cloud). Every WHAPI call lives here
  providers/legacy-webhook.js  Pre-WHAPI behaviour: POST to AppSetting `whatsapp_webhook_url`
routes/whatsapp.js         POST /webhook (public, secret-checked) · GET /status, POST /test-send (admin)
scripts/whatsapp.js        CLI: health | usage | check | send | webhook | chat
```

The AI bot that answers incoming messages is in `lib/whatsapp-bot/` and `lib/agent/` (see `lib/agent/README.md`).

**v1 product rules:** owners/admins only; identity = match sender phone to `users.phone` (no OTP).

## Rules

1. **App code imports only `lib/whatsapp/index.js`.** Never `providers/*`, never `fetch` to a WhatsApp host.
2. **App code speaks the contract:** `sendMessage(to, text, opts)` and `sendMedia(to, fileUrl, opts)` return a `SendResult`, and inbound webhooks arrive as `InboundEvent[]`. Phone numbers can be in any local format; providers normalize them.
3. **Always pass `intent` and `vars`** (e.g. `intent: 'guest.checkin'`, `vars: { customer_name, zimmer_name, title, body }`). WHAPI ignores them. The Meta provider needs them to choose an approved template outside the 24-hour window.
4. **Provider-specific behaviour stays in the provider**: auth, endpoints, payload shapes, retries, rate-limit and error codes, webhook signatures, template rules.
5. `SendResult.status` values are exactly the `delivery_status.whatsapp` enum on GuestMessage / SupplierMessage (`sent | failed | not_configured | skipped`). A provider must not invent new ones. It sets `limitReached: true` when the plan or rate limit refused the send, and the outbox then pauses all sending for 15 minutes.
6. **Send through `sendWhatsAppText()`** (or `deliverWhatsAppText()` for notifications), not `provider.sendMessage()` directly. That way every message is queued, allowlist-checked and logged.

## Configuration

Server env is read from `server/.env`, with the repo-root `.env.local` filling in anything not set there. The WHAPI token lives in `.env.local`, which git ignores.

| Var | Notes |
|---|---|
| `WHATSAPP_ENABLED` | `0` turns off all sending and the bot. Default on |
| `WHATSAPP_PROVIDER` | `whapi`, `webhook` (default, legacy), `none` |
| `WHAPI_TOKEN` | Channel token from the WHAPI dashboard |
| `WHAPI_BASE_URL` | Optional, defaults to `https://gate.whapi.cloud` |
| `WHAPI_CHANNEL_ID` | Informational (`CAPTAM-NX8HB`) |
| `WHATSAPP_WEBHOOK_SECRET` | Required for inbound. Without it every webhook is rejected (401) |
| `WHATSAPP_ALLOWED_RECIPIENTS` | Comma-separated numbers. When set, **automatic notifications** go only to these numbers (trial/dev safety). Bot replies are not affected |
| `WHATSAPP_BOT_ALLOWED_SENDERS` | Comma-separated numbers. When set, the bot only answers these senders |
| `WHATSAPP_MIN_SEND_INTERVAL_MS` | Gap between sends, default `1000` |
| `WHATSAPP_MARK_READ` | `1` = mark inbound messages read (costs one API request each). Default off |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | For local numbers like `050…`. Default `972` |

**WHAPI inbound webhook:** `npm run whatsapp -- webhook https://<public-api-host>` points WHAPI at `<host>/api/whatsapp/webhook?secret=<WHATSAPP_WEBHOOK_SECRET>` for the `messages` and `statuses` events. WHAPI doesn't sign webhooks, so the shared secret is the only authentication. It can also be sent as an `x-webhook-secret` header.

**Trial plan (until 20.10.2026):** 150 messages, 5 distinct chats, 1,000 API requests. Check what's left with `npm run whatsapp -- usage`. The linked phone must open WhatsApp at least every 14 days.

## Migrating to the Meta WhatsApp Cloud API

Everything below goes in a new `providers/meta.js` plus one branch in `createWhatsAppProvider`. No caller changes. The bot, agent, outbox and log stay as they are.

1. **Config:** `WHATSAPP_PROVIDER=meta`, `META_WA_TOKEN`, `META_WA_PHONE_NUMBER_ID`, `META_WA_APP_SECRET`, `META_WA_VERIFY_TOKEN`, `META_WA_GRAPH_VERSION`.
2. **Send text:** `POST https://graph.facebook.com/<ver>/<phone-number-id>/messages` with `{ messaging_product: 'whatsapp', to, type: 'text', text: { body } }`. Read the id from `messages[0].id`. Set `limitReached` on Meta's rate-limit / quota error codes.
3. **24-hour window and templates:**
   - Keep a map in `providers/meta.js` from `intent` to `{ name, language, params: (vars) => [...] }` for the approved templates.
   - If the intent has a template, send it as `type: 'template'`. Business-initiated messages such as stay reminders are almost always outside the window.
   - Otherwise send free text. If Meta returns error **131047** (more than 24 hours since the user's last message), return `{ status: 'failed', error: 'outside 24h window, no template for <intent>' }`.
   - Bot replies (`intent: 'bot.reply'`) always answer a fresh inbound message, so they are inside the window.
4. **Send media:** `type: image | video | audio | document` with `{ link: fileUrl, caption?, filename? }`. The URL must be public HTTPS. Audio takes no caption, and only documents take a filename.
5. **Optional operations:**
   - `markRead`: `POST /messages` with `{ status: 'read', message_id }`.
   - `checkNumber`: not available on Meta. Omit it.
   - `health`: `GET /<phone-number-id>`.
   - `getUsage`: omit it.
   - `configureWebhook`: omit it. Meta webhooks are set in the app dashboard.
6. **Webhook verify (GET):** `answerWebhookChallenge(query)`: if `hub.mode === 'subscribe'` and `hub.verify_token` matches, return `{ status: 200, body: hub.challenge }`, otherwise `{ status: 403, body: '' }`.
7. **Webhook auth (POST):** `verifyWebhook(req)` checks `X-Hub-Signature-256` = `sha256=` + HMAC-SHA256(`req.rawBody`, app secret), using `timingSafeEqual`. The route already captures `rawBody`.
8. **Webhook parse:** walk `entry[].changes[].value.messages[]` and `.statuses[]` and map them to the same `InboundEvent` shapes as `whapi.js`:
   - `context.id` → `replyTo`.
   - Inbound media only has an `id`. Leave `media.url` empty; resolving it needs `GET /<media-id>` with the token.
9. **Test:** copy the WHAPI cases in `tests/contract/whatsapp.smoke.js` and adapt them for Meta with a fake `fetchImpl`.
