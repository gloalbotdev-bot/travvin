/**
 * Google login intent vs stored User.role — one Google account = one role,
 * except admins (always) and users with allowedRoles (dual access).
 */

/** @typedef {'user'|'owner'|'admin'} AuthIntent */

/**
 * Normalize allowed_roles JSON from DB into a string[].
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseAllowedRoles(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => r === 'user' || r === 'owner' || r === 'admin');
}

/**
 * Roles the user may use for a login session.
 * @param {{ role?: string|null, allowedRoles?: unknown }} row
 * @returns {Set<string>}
 */
export function effectiveRoles(row) {
  const set = new Set();
  if (row?.role) set.add(row.role);
  for (const r of parseAllowedRoles(row?.allowedRoles)) set.add(r);
  return set;
}

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
 * Admins may enter as customer, owner, or admin.
 * Dual-access users may enter any intent in allowedRoles ∪ {role}.
 * @param {string|undefined|null} role
 * @param {AuthIntent} intent
 * @param {unknown} [allowedRoles]
 */
export function roleMatchesIntent(role, intent, allowedRoles) {
  if (role === 'admin') {
    return intent === 'admin' || intent === 'owner' || intent === 'user';
  }
  if (intent === 'admin') return false;
  if (role === intent) return true;
  const allowed = parseAllowedRoles(allowedRoles);
  return allowed.includes(intent);
}

/**
 * Pick session role from JWT claim if it is allowed for this user row.
 * @param {{ role?: string|null, allowedRoles?: unknown }} row
 * @param {string|undefined|null} jwtRole
 * @returns {string}
 */
export function resolveSessionRole(row, jwtRole) {
  if (row?.role === 'admin') {
    if (jwtRole === 'admin' || jwtRole === 'owner' || jwtRole === 'user') return jwtRole;
    return 'admin';
  }
  const allowed = effectiveRoles(row);
  if (jwtRole && allowed.has(jwtRole)) return jwtRole;
  return row?.role || 'user';
}
