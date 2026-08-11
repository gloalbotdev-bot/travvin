/**
 * Schema validation smoke (M15 #13 / partial #14).
 */
import { validatePayload } from '../../src/lib/schema-loader.js';
import { assertCheckOutAfterCheckIn } from '../../src/lib/booking-guards.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

function assertThrows(fn, pred, msg) {
  try {
    fn();
    assert(false, `${msg} (expected throw)`);
  } catch (e) {
    assert(pred(e), msg);
  }
}

function main() {
  assertThrows(
    () => validatePayload('Review', { zimmer_id: 'z', owner_id: 'o', rating: 6 }),
    (e) => e.status === 400,
    'Review rating max 5',
  );

  assertThrows(
    () => validatePayload('Review', { zimmer_id: 'z', owner_id: 'o', rating: 0 }),
    (e) => e.status === 400,
    'Review rating min 1',
  );

  validatePayload('Review', { zimmer_id: 'z', owner_id: 'o', rating: 4 });
  assert(true, 'Review rating 4 ok');

  assertThrows(
    () =>
      validatePayload('BookingRequest', {
        zimmer_id: 'z',
        owner_id: 'o',
        guest_name: 'a',
        check_in: '01-10-2026',
        check_out: '01-05-2026',
      }),
    (e) => e.status === 400,
    'BookingRequest invalid date format rejected',
  );

  validatePayload('BookingRequest', {
    zimmer_id: 'z',
    owner_id: 'o',
    guest_name: 'a',
    guest_phone: '050-1',
    check_in: '2026-01-01',
    check_out: '2026-01-05',
  });
  assert(true, 'BookingRequest YYYY-MM-DD ok');

  assertThrows(
    () => assertCheckOutAfterCheckIn({ check_in: '2026-01-05', check_out: '2026-01-01' }),
    (e) => e.status === 400,
    'check_out after check_in enforced',
  );

  assertThrows(
    () => validatePayload('Contact', { name: 'x', owner_id: 'o', email: 'not-an-email' }),
    (e) => e.status === 400,
    'Contact email format',
  );

  assertThrows(
    () => validatePayload('Promotion', {
      zimmer_id: 'z',
      owner_id: 'o',
      check_in: '2026-01-01',
      check_out: '2026-01-05',
      discount_percent: 150,
    }),
    (e) => e.status === 400,
    'Promotion discount_percent max 100',
  );

  assertThrows(
    () => validatePayload('Zimmer', { name: 'z', price_per_night: -1 }),
    (e) => e.status === 400,
    'Zimmer negative price rejected',
  );

  assertThrows(
    () =>
      validatePayload('Review', {
        zimmer_id: 'z',
        owner_id: 'o',
        rating: 5,
        settlement_offer: { percentage: 120, status: 'pending' },
      }),
    (e) => e.status === 400,
    'settlement_offer.percentage max 100',
  );

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll validation smoke tests passed');
}

main();
