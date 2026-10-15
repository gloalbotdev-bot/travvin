/**
 * WhatsApp provider contract. Every provider in ./providers/ returns an object of this shape;
 * the rest of the app only ever sees these types (never WHAPI / Meta payloads).
 */

/**
 * What a message is *for* — a stable business key such as `guest.checkin` or `supplier.custom`.
 * Free-text providers (WHAPI) ignore it. The Meta provider maps it to an approved template
 * when the 24-hour customer-service window is closed.
 * @typedef {string} MessageIntent
 */

/**
 * @typedef {object} SendOptions
 * @property {MessageIntent} [intent]
 * @property {Record<string, string>} [vars] Values a template may need (names, dates, title, body).
 * @property {Record<string, unknown>} [context] Opaque app metadata (ids for correlation/logging).
 * @property {string} [replyTo] Provider message id to quote (threaded reply).
 */

/**
 * @typedef {'image' | 'video' | 'audio' | 'document'} MediaKind
 */

/**
 * @typedef {SendOptions & {
 *   kind?: MediaKind,
 *   caption?: string,
 *   filename?: string,
 *   mimeType?: string,
 * }} MediaOptions
 */

/**
 * Matches the `delivery_status.whatsapp` values stored on GuestMessage / SupplierMessage.
 * @typedef {'sent' | 'failed' | 'not_configured' | 'skipped'} SendStatus
 */

/**
 * @typedef {object} SendResult
 * @property {boolean} ok
 * @property {SendStatus} status
 * @property {string} [providerMessageId]
 * @property {string} [error]
 * @property {boolean} [limitReached] Provider refused because of plan quota / rate limit.
 */

/**
 * @typedef {object} InboundMedia
 * @property {string} id
 * @property {string} url Empty when the provider does not expose a direct link.
 * @property {string} mimeType
 * @property {string} filename
 * @property {string} caption
 */

/**
 * @typedef {object} InboundMessageEvent
 * @property {'message'} type
 * @property {string} id
 * @property {string} from International digits, no `+` (e.g. `972501234567`).
 * @property {string} fromName
 * @property {boolean} isGroup
 * @property {string} timestamp ISO-8601
 * @property {'text' | MediaKind | 'sticker' | 'location' | 'contact' | 'other'} kind
 * @property {string} text Message text, or the media caption.
 * @property {string} replyTo Provider id of the message this one quotes ('' if none).
 * @property {InboundMedia | null} media
 */

/**
 * @typedef {object} StatusEvent
 * @property {'status'} type
 * @property {string} messageId The `providerMessageId` returned when sending.
 * @property {string} recipient
 * @property {'sent' | 'delivered' | 'read' | 'failed'} status
 * @property {string} timestamp ISO-8601
 */

/** @typedef {InboundMessageEvent | StatusEvent} InboundEvent */

/**
 * @typedef {object} WebhookRequest
 * @property {Record<string, string | string[] | undefined>} headers
 * @property {Record<string, unknown>} query
 * @property {Buffer | undefined} rawBody
 */

/**
 * @typedef {object} ProviderHealth
 * @property {boolean} ok The health call itself succeeded.
 * @property {boolean} connected The linked account can send right now.
 * @property {string} state Provider state label (e.g. WHAPI `AUTH`, `QR`).
 * @property {string} [account] The sending number.
 * @property {string} [accountName]
 * @property {number} [uptimeSeconds]
 * @property {string} [error]
 */

/**
 * @typedef {object} ProviderUsage
 * @property {boolean} ok
 * @property {boolean} [unlimited]
 * @property {number} [messagesLeft]
 * @property {number} [requestsLeft]
 * @property {number} [checksLeft]
 * @property {string[]} [allowedChats] Numbers a restricted (trial) plan may talk to.
 * @property {string} [error]
 */

/**
 * @typedef {object} WhatsAppProvider
 * @property {string} name
 * @property {boolean} supportsInbound
 * @property {(to: string, text: string, opts?: SendOptions) => Promise<SendResult>} sendMessage
 * @property {(to: string, fileUrl: string, opts?: MediaOptions) => Promise<SendResult>} sendMedia
 * @property {(req: WebhookRequest) => boolean} verifyWebhook
 * @property {(query: Record<string, unknown>) => { status: number, body: string } | null} answerWebhookChallenge
 *   GET handshake (Meta's `hub.challenge`). `null` → provider has none.
 * @property {(body: unknown) => InboundEvent[]} parseWebhook
 * @property {(messageId: string) => Promise<boolean>} [markRead]
 * @property {(phone: string) => Promise<{ ok: boolean, number: string, hasWhatsApp?: boolean, waId?: string, error?: string }>} [checkNumber]
 * @property {() => Promise<ProviderHealth>} [health]
 * @property {() => Promise<ProviderUsage>} [getUsage]
 * @property {(url: string) => Promise<{ ok: boolean, error?: string }>} [configureWebhook]
 *   Point the provider's inbound webhook at `url` (providers configured only in a dashboard omit this).
 */

export {};
