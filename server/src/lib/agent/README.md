# AI agent library

A channel-independent conversational agent: the same AI that owners use in the web app, reachable from WhatsApp (first channel).

```
lib/agent/
  core.js       createAgent(ports): identity → commands → AI → plain-text reply. No app imports.
  commands.js   Hebrew + English channel commands (עזרה/help, חדש/reset, …). No app imports.
  travvin.js    App binding: assistant, users, WhatsAppSession, zimmer render.
lib/whatsapp-bot/
  index.js      WhatsApp channel: webhook events → agent → reply (dedupe, per-sender ordering, text-only).
```

## How a message flows

```
WhatsApp → provider webhook → routes/whatsapp.js → whatsapp-bot (dedupe, log)
        → agent.handleMessage({ channel, address, text })
            identity  : users.phone match → owner/admin | non-owner refused | ambiguous refused
            commands  : handled without calling the AI
            profile   : owner_assistant only (v1)
            brain     : handleAssistantChat() — same path as POST /api/assistant/chat
            confirm   : confirm_action uiEffect → numbered אישור/ביטול → clientState.confirmActionId
            render    : uiEffects → text + numbered options
        → sendWhatsAppText() → outbox → provider → WhatsApp
```

## Ports

| Port | Travvin binding |
|---|---|
| `brain.chat` | `handleAssistantChat` |
| `identities.resolve` | `users.phone` match |
| `sessions.get / save` | `WhatsAppSession` |
| `renderEffects` | zimmer / booking / confirm text |

## Security rules

- Identity from WhatsApp sender phone only — never from message text.
- Ambiguous phone (multiple users) → refused.
- **v1: owners/admins only** — customers and anonymous get a polite refusal.
- Phone must be set on the user profile (owner settings / admin edit / invite). No OTP — matching the phone is enough.
- No edit-mode gate (same as the panel): writes are proposals only until confirm.
- Pending owner actions use the same confirm/cancel path as the web app (`1` approve / `2` cancel on WhatsApp).
- A later non-confirm message clears the session’s current card binding so stale `1`/`2` do not execute old proposals.
- *עצור* / *stop* opts out until *הפעל* / *start*.
- Legacy *מצב עריכה* / *מצב מידע* reply that edit mode is no longer required (compat only).

## Current limits

- Text only (voice/media get a polite reply).
- Meta Cloud API provider not wired yet (WHAPI for v1; see `lib/whatsapp/README.md`).
