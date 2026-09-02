/**
 * Customer search availability — booked zimmer IDs (no PII).
 */
import { datesOverlap } from '../booking-price.js';

function rowToPublic(row) {
  const data =
    typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data)
      ? row.data
      : {};
  return {
    zimmer_id: data.zimmer_id || null,
    check_in: data.check_in || null,
    check_out: data.check_out || null,
    status: data.status || null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} checkIn
 * @param {string} checkOut
 */
export async function getBookedZimmerIds(prisma, checkIn, checkOut) {
  const rows = await prisma.record.findMany({
    where: {
      entityType: 'BookingRequest',
      AND: [{ data: { path: ['status'], equals: 'אושרה' } }],
    },
    take: 5000,
  });

  return rows
    .map(rowToPublic)
    .filter(
      (b) =>
        b.zimmer_id &&
        b.check_in &&
        b.check_out &&
        datesOverlap(checkIn, checkOut, b.check_in, b.check_out),
    )
    .map((b) => b.zimmer_id);
}
