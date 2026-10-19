/**
 * Zimmer auto-geocode smoke — address saved without a map point → lat/lng.
 */
import { maybeAutoGeocodeZimmer } from '../../src/lib/zimmer-auto-geocode.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

function makeStore(initial) {
  const rows = new Map(initial.map((r) => [r.id, structuredClone(r)]));
  const store = {
    updates: 0,
    async get(_type, id) {
      return structuredClone(rows.get(id));
    },
    async update(_type, id, patch) {
      store.updates += 1;
      const old = rows.get(id);
      const next = { ...old, ...patch };
      rows.set(id, next);
      // Simulate the afterUpdate hook firing on our own write.
      await maybeAutoGeocodeZimmer(store, structuredClone(next), structuredClone(old), { geocode: store.geocode });
      return next;
    },
    row: (id) => rows.get(id),
  };
  return store;
}

function makeGeocode(hit = { lat: 33.1, lng: 35.5 }) {
  const fn = async (addresses) => {
    fn.calls.push(addresses);
    return { results: addresses.map((address) => ({ address, ...(hit || { lat: null, lng: null }) })) };
  };
  fn.calls = [];
  return fn;
}

async function main() {
  // 1. Address without point → geocoded and saved once (no loop)
  {
    const z = { id: 'z1', location: 'ראש פינה', stay_settings: { address: 'הגפן 5, ראש פינה', checkin_time: '15:00' } };
    const store = makeStore([z]);
    store.geocode = makeGeocode();
    const wrote = await maybeAutoGeocodeZimmer(store, z, null, { geocode: store.geocode });
    const ss = store.row('z1').stay_settings;
    assert(wrote === true, 'address without point is geocoded');
    assert(ss.lat === 33.1 && ss.lng === 35.5 && ss.geo_source === 'auto', 'lat/lng + geo_source=auto saved');
    assert(ss.checkin_time === '15:00', 'other stay_settings preserved');
    assert(store.geocode.calls.length === 1 && store.updates === 1, 'no hook loop after own write');
  }

  // 2. Manual point is never overwritten
  {
    const old = { id: 'z2', location: 'צפת', stay_settings: { address: 'הרצל 1, צפת', lat: 32.9, lng: 35.4, geo_source: 'manual' } };
    const rec = { ...old, stay_settings: { ...old.stay_settings, address: 'הרצל 9, צפת' } };
    const store = makeStore([rec]);
    store.geocode = makeGeocode();
    const wrote = await maybeAutoGeocodeZimmer(store, rec, old, { geocode: store.geocode });
    assert(wrote === false && store.geocode.calls.length === 0, 'manual point not overwritten');
  }

  // 3. Auto point + address changed → re-geocoded
  {
    const old = { id: 'z3', location: 'צפת', stay_settings: { address: 'הרצל 1, צפת', lat: 32.9, lng: 35.4, geo_source: 'auto' } };
    const rec = { ...old, stay_settings: { ...old.stay_settings, address: 'ירושלים 3, צפת' } };
    const store = makeStore([rec]);
    store.geocode = makeGeocode({ lat: 32.95, lng: 35.49 });
    const wrote = await maybeAutoGeocodeZimmer(store, rec, old, { geocode: store.geocode });
    assert(wrote === true && store.row('z3').stay_settings.lat === 32.95, 'auto point re-geocoded on address change');
  }

  // 4. Auto point + address unchanged → skip
  {
    const z = { id: 'z4', location: 'צפת', stay_settings: { address: 'הרצל 1, צפת', lat: 32.9, lng: 35.4, geo_source: 'auto' } };
    const store = makeStore([z]);
    store.geocode = makeGeocode();
    const wrote = await maybeAutoGeocodeZimmer(store, z, structuredClone(z), { geocode: store.geocode });
    assert(wrote === false && store.geocode.calls.length === 0, 'unchanged address not re-geocoded');
  }

  // 5. City-only address → skip
  {
    const z = { id: 'z5', location: 'ראש פינה', stay_settings: { address: 'ראש פינה' } };
    const store = makeStore([z]);
    store.geocode = makeGeocode();
    const wrote = await maybeAutoGeocodeZimmer(store, z, null, { geocode: store.geocode });
    assert(wrote === false && store.geocode.calls.length === 0, 'city-only address skipped');
  }

  // 6. Address not found → nothing saved
  {
    const z = { id: 'z6', location: 'X', stay_settings: { address: 'nowhere 1, X' } };
    const store = makeStore([z]);
    store.geocode = makeGeocode(null);
    const wrote = await maybeAutoGeocodeZimmer(store, z, null, { geocode: store.geocode });
    assert(wrote === false && store.updates === 0, 'not found → no write');
  }

  // 7. Owner picked a point in the same save → skip
  {
    const old = { id: 'z7', location: 'צפת', stay_settings: { address: 'הרצל 1, צפת' } };
    const rec = { ...old, stay_settings: { address: 'הרצל 1, צפת', lat: 32.9, lng: 35.4 } };
    const store = makeStore([rec]);
    store.geocode = makeGeocode();
    const wrote = await maybeAutoGeocodeZimmer(store, rec, old, { geocode: store.geocode });
    assert(wrote === false && store.geocode.calls.length === 0, 'point set in same save is respected');
  }

  // 8. Address changed while geocoding → no stale write
  {
    const z = { id: 'z8', location: 'צפת', stay_settings: { address: 'הרצל 1, צפת' } };
    const store = makeStore([{ ...z, stay_settings: { address: 'אחר 2, צפת' } }]);
    store.geocode = makeGeocode();
    const wrote = await maybeAutoGeocodeZimmer(store, z, null, { geocode: store.geocode });
    assert(wrote === false && store.updates === 0, 'stale address not written');
  }

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll zimmer auto-geocode smoke tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
