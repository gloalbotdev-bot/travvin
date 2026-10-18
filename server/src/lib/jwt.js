import jwt from 'jsonwebtoken';
import { getJwtSecret } from './env.js';

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function secret() {
  const s = getJwtSecret();
  if (!s) {
    throw new Error('JWT_SECRET is not configured');
  }
  return s;
}

/**
 * @param {{ id: string, email: string, role: string }} user
 */
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret(),
    { expiresIn: EXPIRES_IN },
  );
}

/**
 * Short-lived token so a role-mismatch screen can submit a RoleAccessRequest
 * without an authenticated session.
 * @param {{ userId: string, email: string, fromRole: string, toRole: string }} payload
 */
export function signRoleAccessRequestToken(payload) {
  return jwt.sign(
    {
      purpose: 'role_access_request',
      userId: payload.userId,
      email: payload.email,
      fromRole: payload.fromRole,
      toRole: payload.toRole,
    },
    secret(),
    { expiresIn: '30m' },
  );
}

/**
 * @returns {{ userId: string, email: string, fromRole: string, toRole: string }|null}
 */
export function verifyRoleAccessRequestToken(token) {
  try {
    const payload = jwt.verify(token, secret());
    if (
      payload.purpose !== 'role_access_request' ||
      !payload.userId ||
      !payload.fromRole ||
      !payload.toRole
    ) {
      return null;
    }
    return {
      userId: String(payload.userId),
      email: String(payload.email || ''),
      fromRole: String(payload.fromRole),
      toRole: String(payload.toRole),
    };
  } catch {
    return null;
  }
}

/**
 * Short-lived signed state for calendar OAuth CSRF + owner binding.
 * @param {{ ownerId: string, redirect?: string }} payload
 */
export function signCalendarOAuthState(payload) {
  return jwt.sign(
    {
      purpose: 'calendar_oauth',
      ownerId: payload.ownerId,
      redirect: payload.redirect || '/owner',
    },
    secret(),
    { expiresIn: '15m' },
  );
}

/**
 * @returns {{ purpose: string, ownerId: string, redirect?: string }|null}
 */
export function verifyCalendarOAuthState(token) {
  try {
    const payload = jwt.verify(token, secret());
    if (payload.purpose !== 'calendar_oauth' || !payload.ownerId) return null;
    return {
      purpose: payload.purpose,
      ownerId: payload.ownerId,
      redirect: payload.redirect,
    };
  } catch {
    return null;
  }
}

/**
 * @returns {{ id: string, email: string, role: string }|null}
 */
export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, secret());
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function extractBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
