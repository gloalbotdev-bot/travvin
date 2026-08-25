/**
 * Auth routes — Base44-compatible surface for own backend.
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { signToken, verifyToken, extractBearer } from '../lib/jwt.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  generateOtp,
  generateResetToken,
  saveOtp,
  verifyOtpCode,
  deliverOtp,
  deliverResetLink,
} from '../lib/otp.js';
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchGoogleProfile,
  isGoogleConfigured,
} from '../lib/google-oauth.js';
import {
  normalizeAuthIntent,
  roleForNewUser,
  roleMatchesIntent,
} from '../lib/auth-role-intent.js';
import { createUserStore } from '../lib/user-store.js';
import { requireAuth } from '../middleware/auth.js';

/** @param {import('@prisma/client').PrismaClient} prisma */
export function createAuthRouter(prisma) {
  const router = Router();
  const users = createUserStore(prisma);

  /** Pending Google OAuth states (in-memory; fine for single dev server). */
  const oauthStates = new Map();

  router.get('/me', async (req, res) => {
    if (req.user) return res.json(req.user);
    const token = extractBearer(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const claims = verifyToken(token);
    if (!claims) return res.status(401).json({ error: 'Invalid token' });
    const row = await users.findById(claims.id);
    if (!row) return res.status(401).json({ error: 'User not found' });
    if (!row.registered) {
      return res.status(403).json({
        error: 'User not registered',
        extra_data: { reason: 'user_not_registered' },
      });
    }
    res.json(users.toAuth(row));
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }
      const row = await users.findByEmail(email);
      if (!row || !(await verifyPassword(password, row.passwordHash))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (!row.registered) {
        return res.status(403).json({
          error: 'User not registered',
          extra_data: { reason: 'user_not_registered' },
        });
      }
      const access_token = signToken(users.toAuth(row));
      res.json({ access_token, user: users.toAuth(row) });
    } catch (err) {
      sendErr(res, err);
    }
  });

  router.post('/register', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }
      const existing = await users.findByEmail(email);
      if (existing?.emailVerified) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      const passwordHash = await hashPassword(password);
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, emailVerified: false },
        });
      } else {
        await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            passwordHash,
            role: 'user',
            registered: true,
            emailVerified: false,
          },
        });
      }
      const code = generateOtp();
      await saveOtp(prisma, email, code, 'register');
      deliverOtp(email, code, 'register');
      res.json({ ok: true });
    } catch (err) {
      sendErr(res, err);
    }
  });

  router.post('/verify-otp', async (req, res) => {
    try {
      const { email, otpCode } = req.body || {};
      if (!email || !otpCode) {
        return res.status(400).json({ error: 'Email and otpCode required' });
      }
      const ok = await verifyOtpCode(prisma, email, otpCode, 'register');
      if (!ok) return res.status(400).json({ error: 'Invalid verification code' });
      const row = await users.findByEmail(email);
      if (!row) return res.status(404).json({ error: 'User not found' });
      await prisma.user.update({
        where: { id: row.id },
        data: { emailVerified: true, registered: true },
      });
      const updated = await users.findById(row.id);
      const access_token = signToken(users.toAuth(updated));
      res.json({ access_token });
    } catch (err) {
      sendErr(res, err);
    }
  });

  router.post('/resend-otp', async (req, res) => {
    try {
      const email = (req.body?.email || '').toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email required' });
      const code = generateOtp();
      await saveOtp(prisma, email, code, 'register');
      deliverOtp(email, code, 'register-resend');
      res.json({ ok: true });
    } catch (err) {
      sendErr(res, err);
    }
  });

  router.post('/reset-password-request', async (req, res) => {
    try {
      const email = (req.body?.email || '').toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email required' });
      const row = await users.findByEmail(email);
      if (row) {
        const token = generateResetToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await prisma.passwordResetToken.deleteMany({ where: { email } });
        await prisma.passwordResetToken.create({ data: { email, token, expiresAt } });
        deliverResetLink(email, token);
      }
      // Always OK — don't leak whether email exists
      res.json({ ok: true });
    } catch (err) {
      sendErr(res, err);
    }
  });

  router.post('/reset-password', async (req, res) => {
    try {
      const { resetToken, newPassword } = req.body || {};
      if (!resetToken || !newPassword) {
        return res.status(400).json({ error: 'resetToken and newPassword required' });
      }
      const row = await prisma.passwordResetToken.findFirst({
        where: { token: resetToken, expiresAt: { gt: new Date() } },
      });
      if (!row) return res.status(400).json({ error: 'Invalid or expired reset token' });
      const passwordHash = await hashPassword(newPassword);
      await prisma.user.update({
        where: { email: row.email },
        data: { passwordHash },
      });
      await prisma.passwordResetToken.delete({ where: { id: row.id } });
      res.json({ ok: true });
    } catch (err) {
      sendErr(res, err);
    }
  });

  router.patch('/me', requireAuth, async (req, res) => {
    try {
      const body = { ...(req.body || {}) };
      // M15 #11 — never allow self role escalation via updateMe
      delete body.role;
      await users.update(req.user.id, body);
      const row = await users.findById(req.user.id);
      res.json(users.toAuth(row));
    } catch (err) {
      sendErr(res, err);
    }
  });

  router.get('/google', (req, res) => {
    if (!isGoogleConfigured()) {
      return res.status(503).json({
        error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env',
      });
    }
    const redirect = req.query.redirect || '/';
    const intent = normalizeAuthIntent(req.query.intent);
    const state = crypto.randomBytes(16).toString('hex');
    oauthStates.set(state, { redirect, intent, at: Date.now() });
    // prune old states
    for (const [k, v] of oauthStates) {
      if (Date.now() - v.at > 10 * 60 * 1000) oauthStates.delete(k);
    }
    const url = buildGoogleAuthUrl({ state });
    res.redirect(url);
  });

  router.get('/google/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query;
      if (error) {
        return res.redirect(`${frontendUrl()}/welcome?auth_error=${encodeURIComponent(String(error))}`);
      }
      const pending = oauthStates.get(String(state));
      oauthStates.delete(String(state));
      const after = pending?.redirect || '/';
      const intent = normalizeAuthIntent(pending?.intent);

      const accessToken = await exchangeGoogleCode(String(code));
      const profile = await fetchGoogleProfile(accessToken);

      let row =
        (profile.id && (await users.findByGoogleId(profile.id))) ||
        (profile.email && (await users.findByEmail(profile.email)));

      if (row) {
        if (!roleMatchesIntent(row.role, intent)) {
          const asRole =
            row.role === 'owner' || row.role === 'admin' || row.role === 'user'
              ? row.role
              : 'user';
          return res.redirect(
            `${frontendUrl()}/welcome?auth_error=role_mismatch&as=${encodeURIComponent(asRole)}`,
          );
        }
        if (!row.googleId && profile.id) {
          row = await prisma.user.update({
            where: { id: row.id },
            data: {
              googleId: profile.id,
              fullName: row.fullName || profile.name || null,
              emailVerified: true,
            },
          });
        }
      } else {
        const newRole = roleForNewUser(intent);
        if (!newRole) {
          return res.redirect(
            `${frontendUrl()}/welcome?auth_error=role_mismatch&as=user`,
          );
        }
        row = await prisma.user.create({
          data: {
            email: (profile.email || '').toLowerCase(),
            fullName: profile.name || null,
            googleId: profile.id || null,
            role: newRole,
            emailVerified: true,
            registered: true,
          },
        });
      }

      if (!row.registered) {
        const front = frontendUrl();
        return res.redirect(`${front}/welcome?auth_error=user_not_registered`);
      }

      const jwt = signToken(users.toAuth(row));
      const target = resolveRedirect(after, jwt);
      res.redirect(target);
    } catch (err) {
      console.error('[google callback]', err);
      res.redirect(`${frontendUrl()}/welcome?auth_error=oauth_failed`);
    }
  });

  return router;
}

function frontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function resolveRedirect(after, accessToken) {
  let url = after;
  if (!url.startsWith('http')) {
    url = `${frontendUrl()}${url.startsWith('/') ? url : `/${url}`}`;
  }
  const u = new URL(url);
  u.searchParams.set('access_token', accessToken);
  return u.toString();
}

function sendErr(res, err) {
  res.status(err.status || 500).json({ error: err.message || String(err) });
}
