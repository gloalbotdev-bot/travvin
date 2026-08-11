/**
 * Generic JSONB entity store + User entity on `users` table (M5).
 */
import {
  applyDefaults,
  getEntityMeta,
  listEntityNames,
  stripAutoFields,
  validatePayload,
} from './schema-loader.js';
import { assertCan, normalizeActor, readScopeWhere } from './authz.js';
import {
  assertReviewCreateStatus,
  assertReviewSettlementOffer,
  assertReviewStatusTransition,
} from './review-status.js';
import {
  assertNoApprovedOverlap,
  assertCheckOutAfterCheckIn,
  computeBookingTotalPrice,
  withZimmerBookingLock,
} from './booking-guards.js';
import { createUserStore } from './user-store.js';
import { publishEntityChange } from './entity-events.js';

const COLUMN_SORT = {
  created_date: 'createdDate',
  updated_date: 'updatedDate',
  id: 'id',
};

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ afterCreate?: Function, afterUpdate?: Function }} [hooks]
 */
export function createEntityStore(prisma, hooks = {}) {
  const users = createUserStore(prisma);

  return {
    listEntityNames,
    getEntityMeta,

    async list(entityType, sort, limit, actor) {
      assertEntity(entityType);
      if (entityType === 'User') {
        assertCan('User', 'read', normalizeActor(actor), null);
        return users.list(sort, limit);
      }
      const user = normalizeActor(actor);
      return findMany(prisma, entityType, {}, sort, limit, user);
    },

    async filter(entityType, query = {}, sort, limit, actor) {
      assertEntity(entityType);
      if (entityType === 'User') {
        assertCan('User', 'read', normalizeActor(actor), null);
        if (query?.email) {
          const u = await users.findByEmail(query.email);
          return u ? [await users.get(u.id)] : [];
        }
        return users.list(sort, limit);
      }
      const user = normalizeActor(actor);
      return findMany(prisma, entityType, query || {}, sort, limit, user);
    },

    async get(entityType, id, actor) {
      assertEntity(entityType);
      const user = normalizeActor(actor);
      if (entityType === 'User') {
        const row = await users.get(id);
        assertCan('User', 'read', user, row);
        return row;
      }
      const row = await prisma.record.findFirst({
        where: { id, entityType },
      });
      if (!row) {
        const err = new Error(`${entityType} not found: ${id}`);
        err.status = 404;
        throw err;
      }
      const pub = toPublic(row);
      assertCan(entityType, 'read', user, pub);
      return pub;
    },

    async create(entityType, data, opts = {}) {
      assertEntity(entityType);
      const user = normalizeActor(opts.actor ?? {
        id: opts.createdById,
        email: opts.createdBy,
      });
      if (entityType === 'User') {
        assertCan('User', 'create', user, data);
        const created = await users.create(data);
        publishEntityChange('User', { type: 'create', id: created.id, data: created });
        return created;
      }
      const validated = validatePayload(entityType, data, { partial: false });
      const withDefaults = applyDefaults(entityType, validated);
      const payload = stripAutoFields(withDefaults);
      assertCan(entityType, 'create', user, payload);
      if (entityType === 'Review') {
        assertReviewCreateStatus(user, payload.status);
        assertReviewSettlementOffer({}, payload);
      }

      if (entityType === 'BookingRequest') {
        const zimmerId = payload.zimmer_id;
        assertCheckOutAfterCheckIn(payload);
        const row = await withZimmerBookingLock(prisma, zimmerId, async (tx) => {
          await assertNoApprovedOverlap(tx, {
            zimmerId,
            checkIn: payload.check_in,
            checkOut: payload.check_out,
          });
          payload.total_price = await computeBookingTotalPrice(tx, payload);
          return tx.record.create({
            data: {
              entityType,
              data: payload,
              createdById: opts.createdById ?? user.id ?? null,
              createdBy: opts.createdBy ?? user.email ?? null,
            },
          });
        });
        const pub = toPublic(row);
        publishEntityChange(entityType, { type: 'create', id: pub.id, data: pub });
        if (hooks.afterCreate) {
          Promise.resolve(hooks.afterCreate(entityType, pub)).catch((err) => {
            console.error('[entity-hooks] create', entityType, err);
          });
        }
        return pub;
      }

      if (entityType === 'Promotion') {
        assertCheckOutAfterCheckIn(payload);
      }

      const row = await prisma.record.create({
        data: {
          entityType,
          data: payload,
          createdById: opts.createdById ?? user.id ?? null,
          createdBy: opts.createdBy ?? user.email ?? null,
        },
      });
      const pub = toPublic(row);
      publishEntityChange(entityType, { type: 'create', id: pub.id, data: pub });
      if (hooks.afterCreate) {
        Promise.resolve(hooks.afterCreate(entityType, pub)).catch((err) => {
          console.error('[entity-hooks] create', entityType, err);
        });
      }
      return pub;
    },

    async update(entityType, id, data, actor) {
      assertEntity(entityType);
      const user = normalizeActor(actor);
      if (entityType === 'User') {
        const current = await users.get(id);
        assertCan('User', 'update', user, current);
        const patch = { ...(data || {}) };
        // M15 #11 — only admins may change roles; never on self
        // M15 #19 — never assign admin via User.update (use AdminPermission / seed)
        if (patch.role !== undefined) {
          if (user.role !== 'admin' || user.id === id) {
            delete patch.role;
          } else if (patch.role === 'admin' || !['owner', 'user'].includes(patch.role)) {
            const err = new Error('Forbidden: cannot assign this role via User.update');
            err.status = 403;
            throw err;
          }
        }
        const updated = await users.update(id, patch);
        publishEntityChange('User', { type: 'update', id: updated.id, data: updated });
        return updated;
      }
      const existing = await prisma.record.findFirst({
        where: { id, entityType },
      });
      if (!existing) {
        const err = new Error(`${entityType} not found: ${id}`);
        err.status = 404;
        throw err;
      }

      const current = toPublic(existing);
      assertCan(entityType, 'update', user, current);

      const validated = validatePayload(entityType, data, { partial: true });
      const patch = stripAutoFields(validated);
      if (entityType === 'Review') {
        assertReviewStatusTransition(user, current, patch);
        assertReviewSettlementOffer(current, patch);
      }
      const merged = {
        ...(typeof existing.data === 'object' && existing.data !== null
          ? existing.data
          : {}),
        ...patch,
      };

      if (entityType === 'BookingRequest') {
        assertCheckOutAfterCheckIn(merged);
        const zimmerId = merged.zimmer_id;
        const datesOrStatusChanged =
          patch.check_in !== undefined ||
          patch.check_out !== undefined ||
          patch.zimmer_id !== undefined ||
          patch.status !== undefined ||
          patch.num_adults !== undefined ||
          patch.num_children !== undefined ||
          patch.total_price !== undefined;

        const row = await withZimmerBookingLock(prisma, zimmerId, async (tx) => {
          if (merged.status === 'אושרה') {
            await assertNoApprovedOverlap(tx, {
              zimmerId,
              checkIn: merged.check_in,
              checkOut: merged.check_out,
              excludeId: id,
            });
          }
          if (datesOrStatusChanged) {
            merged.total_price = await computeBookingTotalPrice(tx, merged);
          }
          return tx.record.update({
            where: { id },
            data: { data: merged },
          });
        });
        const pub = toPublic(row);
        publishEntityChange(entityType, { type: 'update', id: pub.id, data: pub });
        if (hooks.afterUpdate) {
          Promise.resolve(hooks.afterUpdate(entityType, pub, current)).catch((err) => {
            console.error('[entity-hooks] update', entityType, err);
          });
        }
        return pub;
      }

      if (entityType === 'Promotion') {
        assertCheckOutAfterCheckIn(merged);
      }

      const row = await prisma.record.update({
        where: { id },
        data: { data: merged },
      });
      const pub = toPublic(row);
      publishEntityChange(entityType, { type: 'update', id: pub.id, data: pub });
      if (hooks.afterUpdate) {
        Promise.resolve(hooks.afterUpdate(entityType, pub, current)).catch((err) => {
          console.error('[entity-hooks] update', entityType, err);
        });
      }
      return pub;
    },

    async delete(entityType, id, actor) {
      assertEntity(entityType);
      const user = normalizeActor(actor);
      if (entityType === 'User') {
        const current = await users.get(id);
        assertCan('User', 'delete', user, current);
        const result = await users.delete(id);
        publishEntityChange('User', { type: 'delete', id });
        return result;
      }
      const existing = await prisma.record.findFirst({
        where: { id, entityType },
      });
      if (!existing) {
        const err = new Error(`${entityType} not found: ${id}`);
        err.status = 404;
        throw err;
      }
      assertCan(entityType, 'delete', user, toPublic(existing));
      await prisma.record.delete({ where: { id } });
      publishEntityChange(entityType, { type: 'delete', id });
      return { id, deleted: true };
    },
  };
}

function assertEntity(entityType) {
  getEntityMeta(entityType);
}

async function findMany(prisma, entityType, query, sort, limit, actor) {
  const where = buildWhere(entityType, query);
  const scope = readScopeWhere(entityType, actor);

  if (scope === false) {
    return [];
  }
  if (scope) {
    where.AND = [...(where.AND || []), scope];
  }

  const orderBy = parseSort(sort);
  const take = parseLimit(limit);

  const rows = await prisma.record.findMany({
    where,
    orderBy,
    ...(take != null ? { take } : {}),
  });
  return rows.map(toPublic);
}

function buildWhere(entityType, query) {
  const where = { entityType };
  const and = [];

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;

    if (key === 'id') {
      and.push({ id: String(value) });
      continue;
    }
    if (key === 'created_by_id') {
      and.push({ createdById: String(value) });
      continue;
    }
    if (key === 'created_by') {
      and.push({ createdBy: String(value) });
      continue;
    }

    and.push({
      data: {
        path: [key],
        equals: value,
      },
    });
  }

  if (and.length) where.AND = and;
  return where;
}

function parseSort(sort) {
  if (!sort || typeof sort !== 'string') {
    return { createdDate: 'desc' };
  }
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  const direction = desc ? 'desc' : 'asc';

  if (COLUMN_SORT[field]) {
    return { [COLUMN_SORT[field]]: direction };
  }
  return { createdDate: 'desc' };
}

function parseLimit(limit) {
  if (limit === undefined || limit === null || limit === '') return null;
  const n = Number(limit);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** Public shape matching Base44 entity documents. */
export function toPublic(row) {
  const data =
    typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data)
      ? { ...row.data }
      : {};

  return {
    ...data,
    id: row.id,
    created_date: toIso(row.createdDate),
    updated_date: toIso(row.updatedDate),
    created_by_id: row.createdById ?? null,
    created_by: row.createdBy ?? null,
  };
}

function toIso(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  return new Date(d).toISOString();
}
