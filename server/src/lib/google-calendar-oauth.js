/**
 * Google Calendar OAuth (separate from login OAuth) — M8.
 */
import { encryptSecret } from './token-crypto.js';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const CALENDAR_LIST = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';

// Same scopes as Base44 connector (googlecalendar.jsonc).
// calendar_id is resolved via calendarList when allowed, else userinfo email fallback.
export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'email',
].join(' ');

export function getCalendarGoogleConfig() {
  return {
    clientId:
      process.env.GOOGLE_CALENDAR_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      '',
    clientSecret:
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET ||
      process.env.GOOGLE_CLIENT_SECRET ||
      '',
    redirectUri:
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
      `http://localhost:${process.env.PORT || 3001}/api/connectors/google-calendar/oauth/callback`,
  };
}

export function isCalendarGoogleConfigured() {
  const { clientId, clientSecret } = getCalendarGoogleConfig();
  return Boolean(clientId && clientSecret);
}

/** @param {{ state: string }} opts */
export function buildCalendarAuthUrl({ state }) {
  const { clientId, redirectUri } = getCalendarGoogleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: CALENDAR_SCOPES,
    access_type: 'offline',
    // Force consent so Google returns refresh_token (same client as login OAuth).
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function exchangeCalendarCode(code) {
  const { clientId, clientSecret, redirectUri } = getCalendarGoogleConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Calendar token exchange failed: ${t}`);
  }
  return res.json();
}

/** @param {string} refreshToken */
export async function refreshCalendarAccessToken(refreshToken) {
  const { clientId, clientSecret } = getCalendarGoogleConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    const err = new Error(`Calendar token refresh failed: ${t}`);
    err.status = res.status >= 400 && res.status < 500 ? 401 : 502;
    throw err;
  }
  return res.json();
}

/**
 * Resolve real calendar id (never store alias "primary").
 * Prefer userinfo email (works with calendar.events + email scopes);
 * try calendarList only as enrichment when the token allows it.
 * @param {string} accessToken
 * @param {typeof fetch} [fetchImpl]
 */
export async function resolvePrimaryCalendarId(accessToken, fetchImpl = fetch) {
  const ui = await fetchImpl('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (ui.ok) {
    const profile = await ui.json();
    if (profile?.email) {
      // Primary calendar id is almost always the account email.
      return {
        calendarId: String(profile.email),
        accountEmail: String(profile.email),
      };
    }
  }

  const res = await fetchImpl(CALENDAR_LIST, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok) {
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const primary = items.find((c) => c.primary === true) || items[0];
    if (primary?.id && primary.id !== 'primary') {
      return {
        calendarId: String(primary.id),
        accountEmail: primary.id.includes('@') ? String(primary.id) : null,
      };
    }
  }

  const t = res.ok ? 'no usable calendar id' : await res.text().catch(() => 'calendarList error');
  const err = new Error(`Could not resolve calendar id: ${t}`);
  err.status = 502;
  throw err;
}

export { encryptSecret };
