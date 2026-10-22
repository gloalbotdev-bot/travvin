/**
 * User persistence + public shapes for auth.me() and User entity.
 */
import { parseAllowedRoles, resolveSessionRole } from './auth-role-intent.js';
import { toWhatsAppNumber } from './whatsapp/helpers.js';

/** Persist phones as international digits (no +) so WhatsApp identity matches reliably. */
export function normalizeUserPhone(phone) {
  if (phone === null || phone === undefined) return null;
  const raw = String(phone).trim();
  if (!raw) return null;
  return toWhatsAppNumber(raw) || raw.replace(/\D/g, '') || null;
}

function verifiedAtIso(user) {
  const v = user.whatsappVerifiedAt ?? user.whatsapp_verified_at ?? null;
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export function userToAuth(user, sessionRole) {
  const role = sessionRole || user.role;
  const allowed = parseAllowedRoles(user.allowedRoles);
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName ?? user.full_name ?? '',
    role,
    allowed_roles: allowed.length ? allowed : null,
    phone: user.phone ?? null,
    business_name: user.businessName ?? user.business_name ?? null,
    notifications: user.notifications ?? null,
    whatsapp_verified_at: verifiedAtIso(user),
  };
}

export function userToEntity(user) {
  const allowed = parseAllowedRoles(user.allowedRoles);
  return {
    ...userToAuth(user),
    allowed_roles: allowed.length ? allowed : null,
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
          allowedRoles: data.allowedRoles ?? data.allowed_roles ?? undefined,
          phone: normalizeUserPhone(data.phone) ?? null,
          businessName: data.businessName ?? data.business_name ?? null,
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
      if (data.allowedRoles !== undefined) patch.allowedRoles = data.allowedRoles;
      if (data.allowed_roles !== undefined) patch.allowedRoles = data.allowed_roles;
      if (data.full_name !== undefined) patch.fullName = data.full_name;
      if (data.fullName !== undefined) patch.fullName = data.fullName;
      let clearWhatsAppVerified = false;
      if (data.phone !== undefined) {
        const nextPhone = normalizeUserPhone(data.phone);
        patch.phone = nextPhone;
        const prev = normalizeUserPhone(existing.phone);
        if (nextPhone !== prev) {
          // Phone changed — require WhatsApp OTP again before bot access.
          clearWhatsAppVerified = true;
        }
      }
      if (data.business_name !== undefined) patch.businessName = data.business_name;
      if (data.businessName !== undefined) patch.businessName = data.businessName;
      if (data.notifications !== undefined) patch.notifications = data.notifications;
      if (data.passwordHash !== undefined) patch.passwordHash = data.passwordHash;
      if (data.emailVerified !== undefined) patch.emailVerified = data.emailVerified;
      if (data.registered !== undefined) patch.registered = data.registered;
      const row = await prisma.user.update({ where: { id }, data: patch });
      if (clearWhatsAppVerified || data.whatsapp_verified_at === null || data.whatsappVerifiedAt === null) {
        await prisma.$executeRaw`
          UPDATE users SET whatsapp_verified_at = NULL WHERE id = ${id}::uuid
        `;
        row.whatsappVerifiedAt = null;
      } else if (data.whatsappVerifiedAt || data.whatsapp_verified_at) {
        await prisma.$executeRaw`
          UPDATE users SET whatsapp_verified_at = NOW() WHERE id = ${id}::uuid
        `;
        row.whatsappVerifiedAt = new Date();
      }
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

    /**
     * @param {string} email
     * @param {string} role
     * @param {{ full_name?: string, phone?: string, business_name?: string }} [profile]
     */
    async invite(email, role, profile = {}) {
      const normalized = email.toLowerCase();
      const phone = profile.phone !== undefined ? normalizeUserPhone(profile.phone) : undefined;
      const fullName = profile.full_name !== undefined ? profile.full_name : undefined;
      const businessName = profile.business_name !== undefined ? profile.business_name : undefined;
      let u = await prisma.user.findUnique({ where: { email: normalized } });
      if (u) {
        // Never demote an existing admin via invite (owner/user invite on admin email).
        if (u.role === 'admin' && role !== 'admin') {
          const err = new Error('Cannot change role of an existing admin via invite');
          err.status = 409;
          throw err;
        }
        const data = { role, registered: true };
        if (fullName !== undefined) data.fullName = fullName || null;
        const prevPhone = normalizeUserPhone(u.phone);
        if (phone !== undefined) data.phone = phone;
        if (businessName !== undefined) data.businessName = businessName || null;
        u = await prisma.user.update({ where: { id: u.id }, data });
        if (phone !== undefined && prevPhone !== phone) {
          await prisma.$executeRaw`
            UPDATE users SET whatsapp_verified_at = NULL WHERE id = ${u.id}::uuid
          `;
          u.whatsappVerifiedAt = null;
        }
      } else {
        u = await prisma.user.create({
          data: {
            email: normalized,
            role,
            registered: true,
            emailVerified: false,
            fullName: fullName || null,
            phone: phone ?? null,
            businessName: businessName || null,
          },
        });
      }
      return userToEntity(u);
    },

    async markWhatsAppVerified(id) {
      // Raw SQL so this works even before `prisma generate` picks up the new column.
      await prisma.$executeRaw`
        UPDATE users SET whatsapp_verified_at = NOW() WHERE id = ${id}::uuid
      `;
      const row = await prisma.user.findUnique({ where: { id } });
      if (!row) {
        const err = new Error(`User not found: ${id}`);
        err.status = 404;
        throw err;
      }
      row.whatsappVerifiedAt = new Date();
      return userToEntity(row);
    },

    toAuth: userToAuth,
    toAuthWithSession(row, jwtRole) {
      return userToAuth(row, resolveSessionRole(row, jwtRole));
    },
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
