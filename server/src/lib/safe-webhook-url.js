/**
 * Reject non-https and private/loopback webhook URLs (SSRF).
 * @param {string} raw
 */
export function assertSafeHttpsUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || ''));
  } catch {
    const err = new Error('Invalid webhook URL');
    err.status = 400;
    throw err;
  }
  if (url.protocol !== 'https:') {
    const err = new Error('Webhook URL must be https');
    err.status = 400;
    throw err;
  }
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost') ||
    /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)
  ) {
    const err = new Error('Webhook URL host is not allowed');
    err.status = 400;
    throw err;
  }
  return url.toString();
}
