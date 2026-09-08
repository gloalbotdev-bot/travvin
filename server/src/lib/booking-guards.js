/**
 * Booking guards (M15 #9 #10) — overlap lock + server total_price.
 */
import {
  calcBookingTotalForZimmer,
  clampDiscount,
  datesOverlap,
} from './booking-price.js';

function rowToPublic(row) {
  const data =
    typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data)
      ? { ...row.data }
      : {};
  return {
    ...data,
    id: row.id,
    created_date:
      row.createdDate instanceof Date ? row.createdDate.toISOString() : row.createdDate,
    updated_date:
      row.updatedDate instanceof Date ? row.updatedDate.toISOString() : row.updatedDate,
    created_by_id: row.createdById ?? null,
    created_by: row.createdBy ?? null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} prisma
 * @param {string} zimmerId
 */
export async function loadZimmerData(prisma, zimmerId) {
  if (!zimmerId) return null;
  try {
    const row = await prisma.record.findFirst({
      where: { id: zimmerId, entityType: 'Zimmer' },
    });
    return row ? rowToPublic(row) : null;
  } catch {
    // Non-UUID test ids etc. — treat as missing zimmer
    return null;
  }
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} prisma
 */
export async function findOverlappingApproved(
  prisma,
  zimmerId,
  checkIn,
  checkOut,
  excludeId = null,
) {
  const rows = await prisma.record.findMany({
    where: {
      entityType: 'BookingRequest',
      AND: [
        { data: { path: ['zimmer_id'], equals: zimmerId } },
        { data: { path: ['status'], equals: 'אושרה' } },
      ],
    },
    take: 2000,
  });

  return rows
    .map(rowToPublic)
    .filter((b) => {
      if (excludeId && b.id === excludeId) return false;
      return datesOverlap(checkIn, checkOut, b.check_in, b.check_out);
    });
}

/**
 * Reject if an approved booking already covers these dates (M15 #9).
 */
export async function assertNoApprovedOverlap(
  prisma,
  { zimmerId, checkIn, checkOut, excludeId = null },
) {
  if (!zimmerId || !checkIn || !checkOut) return;
  const hits = await findOverlappingApproved(
    prisma,
    zimmerId,
    checkIn,
    checkOut,
    excludeId,
  );
  if (hits.length) {
    const err = new Error('התאריכים תפוסים — קיימת הזמנה מאושרת חופפת');
    err.status = 409;
    err.body = {
      error: 'booking_overlap',
      message: err.message,
      conflicting_ids: hits.map((h) => h.id),
    };
    throw err;
  }
}

/**
 * Compute authoritative total_price (optional active promo discount).
 */
export async function computeBookingTotalPrice(prisma, booking) {
  const zimmer = await loadZimmerData(prisma, booking.zimmer_id);
  if (!zimmer) {
    return booking.total_price != null ? Number(booking.total_price) : 0;
  }

  const adults = Number(booking.num_adults) || 0;
  const children = Number(booking.num_children) || 0;
  let total = calcBookingTotalForZimmer(
    zimmer,
    booking.check_in,
    booking.check_out,
    adults,
    children,
  );

  const promos = await prisma.record.findMany({
    where: {
      entityType: 'Promotion',
      AND: [
        { data: { path: ['zimmer_id'], equals: booking.zimmer_id } },
        { data: { path: ['status'], equals: 'פעיל' } },
      ],
    },
    take: 50,
  });
  for (const row of promos) {
    const p = rowToPublic(row);
    if (datesOverlap(booking.check_in, booking.check_out, p.check_in, p.check_out)) {
      total = Math.round(total * (1 - clampDiscount(p.discount_percent) / 100));
      break;
    }
  }

  return total;
}

/**
 * Mark overlapping active promos as captured after a booking (SEC-003).
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} prisma
 */
export async function captureOverlappingPromotions(prisma, booking) {
  if (!booking?.zimmer_id || !booking.check_in || !booking.check_out) return;

  const promos = await prisma.record.findMany({
    where: {
      entityType: 'Promotion',
      AND: [
        { data: { path: ['zimmer_id'], equals: booking.zimmer_id } },
        { data: { path: ['status'], equals: 'פעיל' } },
      ],
    },
    take: 50,
  });

  for (const row of promos) {
    const p = rowToPublic(row);
    if (!datesOverlap(booking.check_in, booking.check_out, p.check_in, p.check_out)) {
      continue;
    }
    const data =
      typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data)
        ? { ...row.data, status: 'נתפס' }
        : { status: 'נתפס' };
    await prisma.record.update({
      where: { id: row.id },
      data: { data },
    });
  }
}

/**
 * Derive owner_id from Zimmer; reject client mismatch (SEC-007/008).
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} prisma
 */
export async function resolveOwnerFromZimmer(prisma, payload, user) {
  const zimmerId = payload?.zimmer_id;
  if (!zimmerId) {
    const err = new Error('zimmer_id required');
    err.status = 400;
    throw err;
  }
  const zimmer = await loadZimmerData(prisma, zimmerId);
  if (!zimmer?.owner_id) {
    const err = new Error('Zimmer not found');
    err.status = 404;
    throw err;
  }
  if (
    user.role !== 'admin' &&
    payload.owner_id &&
    payload.owner_id !== zimmer.owner_id
  ) {
    const err = new Error('Forbidden: owner_id does not match zimmer');
    err.status = 403;
    throw err;
  }
  payload.owner_id = zimmer.owner_id;
  if (!payload.zimmer_name && zimmer.name) {
    payload.zimmer_name = zimmer.name;
  }
  return payload;
}

/** Strip ownership fields non-admins must not patch. */
export function stripImmutableOwnershipFields(entityType, patch, user) {
  if (user.role === 'admin') return patch;
  const next = { ...patch };
  if (
    entityType === 'BookingRequest' ||
    entityType === 'UnansweredQuestion' ||
    entityType === 'DirectChat' ||
    entityType === 'Zimmer'
  ) {
    delete next.owner_id;
  }
  if (entityType === 'Zimmer') {
    delete next.approval_status;
  }
  return next;
}

/** M15 #13 — check_out must be strictly after check_in when both set. */
export function assertCheckOutAfterCheckIn(payload) {
  const { check_in: checkIn, check_out: checkOut } = payload || {};
  if (!checkIn || !checkOut) return;
  if (String(checkOut) <= String(checkIn)) {
    const err = new Error('check_out must be after check_in');
    err.status = 400;
    throw err;
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} zimmerId
 * @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>} fn
 * @template T
 */
export async function withZimmerBookingLock(prisma, zimmerId, fn) {
  if (!zimmerId) return fn(prisma);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${String(zimmerId)}))`;
    return fn(tx);
  });
}
