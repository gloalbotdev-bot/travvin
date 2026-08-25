/**
 * Google login intent vs stored User.role — one Google account = one role.
 */

/** @typedef {'user'|'owner'|'admin'} AuthIntent */

/**
 * @param {string|undefined|null} raw
 * @returns {AuthIntent}
 */
export function normalizeAuthIntent(raw) {
  if (raw === 'owner' || raw === 'admin' || raw === 'user') return raw;
  return 'user';
}

/**
 * Role to assign when creating a brand-new user for this intent.
 * Admin accounts are never created via Google signup.
 * @param {AuthIntent} intent
 * @returns {'user'|'owner'|null} null = refuse create (admin intent on new account)
 */
export function roleForNewUser(intent) {
  if (intent === 'owner') return 'owner';
  if (intent === 'user') return 'user';
  return null;
}

/**
 * Whether an existing user's role may complete login for this intent.
 * @param {string|undefined|null} role
 * @param {AuthIntent} intent
 */
export function roleMatchesIntent(role, intent) {
  if (intent === 'admin') return role === 'admin';
  if (intent === 'owner') return role === 'owner';
  if (intent === 'user') return role === 'user';
  return false;
}
