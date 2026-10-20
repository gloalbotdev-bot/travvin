# AI agent library

A channel-independent conversational agent: the same AI that owners and guests use in the web app, reachable from any text channel. WhatsApp is the first channel.

```
lib/agent/
  core.js       createAgent(ports): identity → commands → profile → AI → plain-text reply. No app imports.
  commands.js   Hebrew + English channel commands (עזרה/help, חדש/reset, מצב עריכה/edit…). No app imports.
  travvin.js    The only app binding: plugs in the assistant, users table, WhatsAppSession storage, zimmer data.
lib/whatsapp-bot/
  index.js      WhatsApp channel: webhook events → agent → reply (dedupe, per-sender ordering, text-only).
```

## How a message flows

```
WhatsApp → provider webhook → routes/whatsapp.js → whatsapp-bot (dedupe, log)
        → agent.handleMessage({ channel, address, text })
            identity  : users.phone match → owner/admin | customer | anonymous guest | ambiguous (refused)
            commands  : handled without calling the AI
            profile   : owner/admin → owner_assistant · everyone else → customer_chat
            brain     : handleAssistantChat() — the same code path as POST /api/assistant/chat
            render    : uiEffects (zimmer cards, booking form, panel links) → text + numbered options
        → sendWhatsAppText() → outbox (rate limit, quota pause) → provider → WhatsApp
```

## Ports (what `core.js` needs)

| Port | Shape | Travvin binding |
|---|---|---|
| `brain.chat(req, identity)` | `req = { profile, message, conversationId, clientState }` → `{ conversationId, message: { content }, uiEffects }` | `handleAssistantChat` |
| `identities.resolve(channel, address)` | → `{ kind: 'user' \| 'anonymous' \| 'ambiguous', actor, user, name }` | `users.phone` match |
| `sessions.get / save` | per `(channel, address)` conversation state | `WhatsAppSession` entity |
| `renderEffects(effects)` | → `{ lines, quickOptions }` | zimmer lookup + app links |

To add a channel (Telegram, SMS, web widget), call `agent.handleMessage()` from that channel's adapter. To give the agent more abilities, extend the assistant profiles in `lib/assistant/`. Both web and WhatsApp pick them up.

## Security rules

- **Identity comes only from the channel's verified sender address** (WhatsApp verifies the phone number), never from message text.
- **A number linked to more than one account is refused** rather than guessed.
- **If the account on a number changes, the session's history is wiped.**
- **Owners start in read-only *info* mode.** Actions (create a booking, update a zimmer) need *מצב עריכה*, which expires after 30 minutes.
- **The assistant enforces the same authorization as the web app**: the actor is the matched user, and RLS applies.
- ***עצור* / *stop* opts a sender out** until *הפעל* / *start*.

## Current limits

- **Text only.** Voice notes, images and documents get a polite "text only" reply. `lib/transcribe-audio.js` could add voice support later.
- **The customer flow has no availability filtering by dates yet.** On WhatsApp the assistant sees all approved zimmers, and bookings are completed in the app (link in the reply).
- **Users are recognized only by `users.phone`.** Customers and owners must have their phone saved in their profile.
