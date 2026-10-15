/**
 * Provider-neutral helpers shared by the WhatsApp providers.
 */
import crypto from 'node:crypto';

/**
 * Normalize a phone number to international digits without `+` (`050-123-4567` → `972501234567`).
 * Returns '' when the input has no usable digits.
 * @param {string} phone
 * @param {string} [defaultCountryCode] Used for local numbers that start with a single `0`.
 */
export function toWhatsAppNumber(
  phone,
  defaultCountryCode = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '972',
) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) digits = defaultCountryCode + digits.slice(1);
  return digits;
}

/** E.164 allows 8–15 digits including the country code. */
export function isValidWhatsAppNumber(digits) {
  return /^\d{8,15}$/.test(digits);
}

/** `972501234567@s.whatsapp.net` → `972501234567` */
export function chatIdToNumber(chatId) {
  return String(chatId || '').split('@')[0].replace(/\D/g, '');
}

/**
 * @param {string} fileUrl
 * @param {string} [mimeType]
 * @returns {import('./contract.js').MediaKind}
 */
export function guessMediaKind(fileUrl, mimeType = '') {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime) return 'document';

  let pathname = String(fileUrl || '');
  try {
    pathname = new URL(pathname).pathname;
  } catch {
    /* not an absolute URL — use as-is */
  }
  const ext = pathname.toLowerCase().split('.').pop() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  if (['mp4', '3gp', 'mov', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'ogg', 'opus', 'm4a', 'aac', 'amr', 'wav'].includes(ext)) return 'audio';
  return 'document';
}

/** Unix seconds (or ms) → ISO-8601; falls back to now. */
export function toIsoTimestamp(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n < 1e12 ? n * 1000 : n).toISOString();
}

/**
 * Constant-time check of a shared secret sent as `x-webhook-secret` header or `?secret=` query.
 * Rejects everything when no secret is configured.
 * @param {import('./contract.js').WebhookRequest} req
 * @param {string} secret
 */
export function verifySharedSecret(req, secret) {
  if (!secret) return false;
  const header = req.headers?.['x-webhook-secret'];
  const provided = String((Array.isArray(header) ? header[0] : header) || req.query?.secret || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * @param {unknown} e
 * @returns {import('./contract.js').SendResult}
 */
export function failedResult(e) {
  return { ok: false, status: 'failed', error: e instanceof Error ? e.message : String(e) };
}
