/**
 * User persistence + public shapes for auth.me() and User entity.
 */

export function userToAuth(user) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName ?? '',
    role: user.role,
    phone: user.phone ?? null,
    business_name: user.businessName ?? null,
    notifications: user.notifications ?? null,
  };
}

export function userToEntity(user) {
  return {
    ...userToAuth(user),
    created_date: user.createdDate.toISOString(),
    updated_date: user.updatedDate.toISOString(),
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export function createUserStore(prisma) {
  return {
    async findById(id) {
      return prisma.user.findUnique({ where: { id } });
    },

    async findByEmail(email) {
      return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    },

    async findByGoogleId(googleId) {
      return prisma.user.findUnique({ where: { googleId } });
    },

    async list(sort, limit) {
      const orderBy = parseUserSort(sort);
      const take = limit != null ? Number(limit) : undefined;
      const rows = await prisma.user.findMany({ orderBy, ...(take ? { take } : {}) });
      return rows.map(userToEntity);
    },

    async get(id) {
      const u = await prisma.user.findUnique({ where: { id } });
      if (!u) {
        const err = new Error(`User not found: ${id}`);
        err.status = 404;
        throw err;
      }
      return userToEntity(u);
    },

    async create(data) {
      const row = await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash: data.passwordHash ?? null,
          fullName: data.fullName ?? data.full_name ?? null,
          role: data.role ?? 'user',
          googleId: data.googleId ?? null,
          emailVerified: data.emailVerified ?? false,
          registered: data.registered ?? true,
        },
      });
      return userToEntity(row);
    },

    async update(id, data) {
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        const err = new Error(`User not found: ${id}`);
        err.status = 404;
        throw err;
      }
      const patch = {};
      if (data.role !== undefined) patch.role = data.role;
      if (data.full_name !== undefined) patch.fullName = data.full_name;
      if (data.fullName !== undefined) patch.fullName = data.fullName;
      if (data.phone !== undefined) patch.phone = data.phone;
      if (data.business_name !== undefined) patch.businessName = data.business_name;
      if (data.businessName !== undefined) patch.businessName = data.businessName;
      if (data.notifications !== undefined) patch.notifications = data.notifications;
      if (data.passwordHash !== undefined) patch.passwordHash = data.passwordHash;
      if (data.emailVerified !== undefined) patch.emailVerified = data.emailVerified;
      if (data.registered !== undefined) patch.registered = data.registered;
      const row = await prisma.user.update({ where: { id }, data: patch });
      return userToEntity(row);
    },

    async delete(id) {
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        const err = new Error(`User not found: ${id}`);
        err.status = 404;
        throw err;
      }
      await prisma.user.delete({ where: { id } });
      return { id, deleted: true };
    },

    async invite(email, role) {
      const normalized = email.toLowerCase();
      let u = await prisma.user.findUnique({ where: { email: normalized } });
      if (u) {
        u = await prisma.user.update({
          where: { id: u.id },
          data: { role, registered: true },
        });
      } else {
        u = await prisma.user.create({
          data: {
            email: normalized,
            role,
            registered: true,
            emailVerified: false,
          },
        });
      }
      return userToEntity(u);
    },

    toAuth: userToAuth,
  };
}

function parseUserSort(sort) {
  if (!sort || typeof sort !== 'string') return { createdDate: 'desc' };
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  const dir = desc ? 'desc' : 'asc';
  const map = {
    created_date: 'createdDate',
    updated_date: 'updatedDate',
    email: 'email',
  };
  return { [map[field] || 'createdDate']: dir };
}
