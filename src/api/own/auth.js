/**
 * Own-backend auth — same method shapes as former Base44 SDK auth.
 */
import {
  clearStoredToken,
  getApiBase,
  ownFetch,
  setStoredToken,
} from './http.js';

export const ownAuth = {
  async me() {
    return ownFetch('/api/auth/me');
  },

  /**
   * @param {'google'} provider
   * @param {string} [redirectUrl]
   * @param {'user'|'owner'|'admin'} [intent] — permanent role for first signup; must match existing role on return
   */
  loginWithProvider(provider, redirectUrl, intent = 'user') {
    if (provider !== 'google') {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    const params = new URLSearchParams({
      redirect: redirectUrl || '/',
      intent: intent === 'owner' || intent === 'admin' ? intent : 'user',
    });
    window.location.href = `${getApiBase()}/api/auth/google?${params.toString()}`;
  },

  redirectToLogin(returnUrl) {
    const next = encodeURIComponent(returnUrl || window.location.pathname);
    window.location.href = `/welcome?next=${next}`;
  },

  logout(redirectUrl) {
    clearStoredToken();
    // Prevent next guest/other account from resuming this browser's chat UI
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('cc_state_v1');
    } catch { /* ignore */ }
    if (!redirectUrl) return;
    if (redirectUrl.startsWith('http')) {
      window.location.href = redirectUrl;
    } else {
      window.location.href = redirectUrl.startsWith('/') ? redirectUrl : `/${redirectUrl}`;
    }
  },

  setToken(token) {
    setStoredToken(token);
  },

  async loginViaEmailPassword(email, password) {
    const data = await ownFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    if (data?.access_token) setStoredToken(data.access_token);
    return data;
  },

  async register({ email, password }) {
    return ownFetch('/api/auth/register', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
  },

  async verifyOtp({ email, otpCode }) {
    return ownFetch('/api/auth/verify-otp', {
      method: 'POST',
      body: { email, otpCode },
      auth: false,
    });
  },

  async resendOtp(email) {
    return ownFetch('/api/auth/resend-otp', {
      method: 'POST',
      body: { email },
      auth: false,
    });
  },

  async resetPasswordRequest(email) {
    return ownFetch('/api/auth/reset-password-request', {
      method: 'POST',
      body: { email },
      auth: false,
    });
  },

  async resetPassword({ resetToken, newPassword }) {
    return ownFetch('/api/auth/reset-password', {
      method: 'POST',
      body: { resetToken, newPassword },
      auth: false,
    });
  },

  async exchangeAuthCode(code) {
    const data = await ownFetch('/api/auth/exchange-code', {
      method: 'POST',
      body: { code },
      auth: false,
    });
    if (data?.access_token) setStoredToken(data.access_token);
    return data;
  },

  async updateMe(data) {
    return ownFetch('/api/auth/me', { method: 'PATCH', body: data });
  },
};
