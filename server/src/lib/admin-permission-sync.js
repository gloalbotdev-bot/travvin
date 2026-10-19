/**
 * Keep User.role in sync with AdminPermission whitelist.
 * Promote runs inside AdminPermission create (awaited); demote after delete when orphaned.
 */

/**
 * @param {ReturnType<import('./user-store.js').createUserStore>} users
 * @param {string} email
 */
export async function promoteAdminByEmail(users, email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    const err = new Error('AdminPermission email is required');
    err.status = 400;
    throw err;
  }
  return users.invite(normalized, 'admin');
}

/**
 * After deleting an AdminPermission, demote User.role admin→user when no other
 * active AdminPermission remains for that email.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {ReturnType<import('./user-store.js').createUserStore>} users
 * @param {string} email
 * @returns {Promise<boolean>} true if demoted
 */
export async function demoteAdminIfOrphan(prisma, users, email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalized) return false;

  const remaining = await prisma.record.findMany({
    where: {
      entityType: 'AdminPermission',
      data: { path: ['email'], equals: normalized },
    },
  });
  const hasActive = remaining.some((row) => {
    const data =
      typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data)
        ? row.data
        : {};
    return data.is_active !== false;
  });
  if (hasActive) return false;

  const u = await users.findByEmail(normalized);
  if (!u || u.role !== 'admin') return false;

  await users.update(u.id, { role: 'user' });
  return true;
}
