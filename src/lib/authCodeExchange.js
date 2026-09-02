/**
 * One-time OAuth auth_code exchange (SEC-012).
 * Dedupes concurrent callers (e.g. AuthContext + page effects on same redirect).
 */
import { ownAuth } from '@/api/own/auth.js';
import { getStoredToken } from '@/api/own/http.js';

/** @type {Promise<string|null>|null} */
let inFlight = null;

export async function exchangeAuthCodeFromUrlOnce() {
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('auth_code');
  if (!code) return getStoredToken();

  if (!inFlight) {
    inFlight = (async () => {
      try {
        const data = await ownAuth.exchangeAuthCode(code);
        urlParams.delete('auth_code');
        const newUrl = `${window.location.pathname}${
          urlParams.toString() ? `?${urlParams}` : ''
        }${window.location.hash}`;
        window.history.replaceState({}, document.title, newUrl);
        return data?.access_token || getStoredToken();
      } catch (e) {
        console.error('auth_code exchange failed:', e);
        return null;
      } finally {
        inFlight = null;
      }
    })();
  }

  return inFlight;
}
