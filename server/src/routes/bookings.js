/**
 * Public booking availability (busy ranges) — no PII (M15 #2).
 * Returns only zimmer_id + check_in/check_out for approved bookings.
 */
import { Router } from 'express';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export function createBookingsRouter(prisma) {
  const router = Router();

  router.get('/busy', async (req, res) => {
    try {
      const zimmerId =
        typeof req.query.zimmer_id === 'string' ? req.query.zimmer_id : null;

      const and = [
        {
          data: {
            path: ['status'],
            equals: 'אושרה',
          },
        },
      ];
      if (zimmerId) {
        and.push({
          data: {
            path: ['zimmer_id'],
            equals: zimmerId,
          },
        });
      }

      const rows = await prisma.record.findMany({
        where: {
          entityType: 'BookingRequest',
          AND: and,
        },
        take: 5000,
        orderBy: { createdDate: 'desc' },
      });

      const busy = rows
        .map((row) => {
          const data =
            typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data)
              ? row.data
              : {};
          return {
            zimmer_id: data.zimmer_id || null,
            check_in: data.check_in || null,
            check_out: data.check_out || null,
          };
        })
        .filter((b) => b.zimmer_id && b.check_in && b.check_out);

      res.json(busy);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
