/**
 * Assistant profile authorization — actor from JWT only (Phase 2).
 */
import { getProfile } from './profiles.js';

const GUEST_PROFILES = new Set(['customer_date_search', 'customer_chat']);

const CUSTOMER_PROFILES = new Set([
  'customer_date_search',
  'customer_chat',
  'vacation_agent',
]);

const OWNER_PROFILES = new Set([
  'owner_assistant',
  'owner_booking_creator',
  'owner_zimmer_creator',
  'admin_zimmer_editor',
  'owner_tips',
  'generate_info_summary',
  'owner_zimmer_knowledge_summary',
]);

/** Internal/server-only profiles — not exposed on public chat in Phase 2. */
const INTERNAL_PROFILES = new Set(['stay_recommendations']);

/**
 * @param {import('../authz.js').Actor|null|undefined} actor
 * @param {string} profileId
 */
export function assertProfileAccess(actor, profileId) {
  const profile = getProfile(profileId);
  if (!profile) {
    const err = new Error(`Unknown profile: ${profileId}`);
    err.status = 400;
    err.code = 'UNKNOWN_PROFILE';
    throw err;
  }

  if (INTERNAL_PROFILES.has(profileId)) {
    const err = new Error('Profile not available on assistant chat API');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const role = actor?.role || null;
  const authed = Boolean(actor?.id);

  if (profileId === 'admin_session_summary') {
    if (!authed || role !== 'admin') {
      const err = new Error('Forbidden: admin only');
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    return profile;
  }

  if (role === 'admin') return profile;

  if (!authed) {
    if (GUEST_PROFILES.has(profileId)) return profile;
    const err = new Error('Authentication required');
    err.status = 401;
    err.code = 'AUTH_REQUIRED';
    throw err;
  }

  if (role === 'user' && CUSTOMER_PROFILES.has(profileId)) return profile;

  if (role === 'owner' && OWNER_PROFILES.has(profileId)) return profile;

  const err = new Error('Forbidden: profile not allowed for this role');
  err.status = 403;
  err.code = 'FORBIDDEN';
  throw err;
}
