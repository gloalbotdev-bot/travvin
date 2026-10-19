/**
 * Minimum nights (חמשוש) smoke — rule matching + server guard + client parity.
 * Calendar: 2026-10-15 Thu, 10-16 Fri, 10-17 Sat, 10-18 Sun, 10-19 Mon.
 */
import { checkMinNights, describeMinNightsRules } from '../../src/lib/booking-price.js';
import { assertMinNights } from '../../src/lib/booking-guards.js';
import * as clientPrice from '../../../src/lib/bookingPrice.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

const weekend2 = { min_nights_rules: [{ scope: 'weekend', min_nights: 2 }] };
const summerOnly = {
  min_nights_rules: [
    { scope: 'weekend', min_nights: 3, start_date: '2026-07-01', end_date: '2026-08-31', label: 'קיץ' },
  ],
};
const midweek3 = { min_nights_rules: [{ scope: 'midweek', min_nights: 3 }] };
const mixed = {
  min_nights_rules: [
    { scope: 'all', min_nights: 2 },
    { scope: 'weekend', min_nights: 3 },
  ],
};

function makePrisma(zimmer, promos = []) {
  const toRow = (id, data) => ({ id, data, createdDate: new Date(), updatedDate: new Date() });
  return {
    record: {
      async findFirst() {
        return toRow('z1', zimmer);
      },
      async findMany() {
        return promos.map((p, i) => toRow(`p${i}`, p));
      },
    },
  };
}

async function expectReject(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
}

async function main() {
  // Rule matching
  assert(!checkMinNights(weekend2, '2026-10-16', '2026-10-17').ok, 'one Friday night blocked by weekend min 2');
  assert(!checkMinNights(weekend2, '2026-10-15', '2026-10-16').ok, 'one Thursday night blocked by weekend min 2');
  assert(checkMinNights(weekend2, '2026-10-15', '2026-10-17').ok, 'Thu→Sat (2 nights) allowed');
  assert(checkMinNights(weekend2, '2026-10-18', '2026-10-19').ok, 'one midweek night not affected by weekend rule');
  assert(checkMinNights(weekend2, '2026-10-17', '2026-10-18').ok, 'Saturday night is not a weekend night');

  assert(checkMinNights(summerOnly, '2026-10-16', '2026-10-17').ok, 'period rule does not apply outside its dates');
  const inSummer = checkMinNights(summerOnly, '2026-07-16', '2026-07-18');
  assert(!inSummer.ok && inSummer.required === 3, 'period rule applies inside its dates');

  assert(!checkMinNights(midweek3, '2026-10-18', '2026-10-20').ok, 'midweek rule blocks 2 midweek nights');
  assert(checkMinNights(midweek3, '2026-10-16', '2026-10-17').ok, 'midweek rule ignores stays with a weekend night');

  const mx = checkMinNights(mixed, '2026-10-15', '2026-10-17');
  assert(!mx.ok && mx.required === 3, 'highest applicable rule wins');
  assert(!checkMinNights(mixed, '2026-10-18', '2026-10-19').ok, '"all" rule applies to midweek');

  assert(checkMinNights({}, '2026-10-16', '2026-10-17').ok, 'no rules → always ok');
  assert(describeMinNightsRules(weekend2).includes('חמשוש'), 'description mentions חמשוש');
  assert(describeMinNightsRules({}) === '', 'empty description without rules');

  // Client/server parity
  const cases = [
    [weekend2, '2026-10-16', '2026-10-17'],
    [weekend2, '2026-10-15', '2026-10-17'],
    [summerOnly, '2026-07-16', '2026-07-18'],
    [midweek3, '2026-10-18', '2026-10-20'],
    [mixed, '2026-10-15', '2026-10-17'],
  ];
  assert(
    cases.every(([z, a, b]) => {
      const s = checkMinNights(z, a, b);
      const c = clientPrice.checkMinNights(z, a, b);
      return s.ok === c.ok && s.required === c.required && s.message === c.message;
    }),
    'client and server helpers agree',
  );

  // Server guard
  const zimmer = { ...weekend2, owner_id: 'owner-1' };
  const short = { zimmer_id: 'z1', check_in: '2026-10-16', check_out: '2026-10-17' };
  const customer = { id: 'cust-1', role: 'user' };

  const err = await expectReject(() => assertMinNights(makePrisma(zimmer), short, customer));
  assert(err?.status === 400 && err.body?.error === 'min_nights' && err.body.required === 2, 'customer short stay rejected (400 min_nights)');

  assert(
    !(await expectReject(() => assertMinNights(makePrisma(zimmer), { ...short, check_out: '2026-10-18' }, customer))),
    'customer valid stay accepted',
  );
  assert(
    !(await expectReject(() => assertMinNights(makePrisma(zimmer), short, { id: 'owner-1', role: 'owner' }))),
    'zimmer owner bypasses the rule',
  );
  assert(
    !(await expectReject(() => assertMinNights(makePrisma(zimmer), short, { id: 'a', role: 'admin' }))),
    'admin bypasses the rule',
  );
  assert(
    !!(await expectReject(() => assertMinNights(makePrisma(zimmer), short, { id: 'owner-2', role: 'owner' }))),
    'another owner is still blocked',
  );
  const promo = { zimmer_id: 'z1', status: 'פעיל', check_in: '2026-10-16', check_out: '2026-10-17' };
  assert(
    !(await expectReject(() => assertMinNights(makePrisma(zimmer, [promo]), short, customer))),
    'exact promo window is exempt',
  );

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll min-nights smoke tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
