import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * @param {{ id: string, email: string, role: string }} user
 */
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: EXPIRES_IN },
  );
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
    SECRET,
    { expiresIn: '15m' },
  );
}

/**
 * @returns {{ purpose: string, ownerId: string, redirect?: string }|null}
 */
export function verifyCalendarOAuthState(token) {
  try {
    const payload = jwt.verify(token, SECRET);
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
    const payload = jwt.verify(token, SECRET);
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
