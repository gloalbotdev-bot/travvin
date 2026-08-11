/**
 * geocodeAddresses smoke — throttle + cache (M15 #12).
 */
import {
  geocodeAddresses,
  __resetGeocodeStateForTests,
} from '../../src/lib/geocode-addresses.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

async function main() {
  __resetGeocodeStateForTests();
  const calls = [];
  let fakeNow = 1_000_000;
  const sleeps = [];

  /** @type {typeof fetch} */
  const mockFetch = async (url, init) => {
    calls.push({ url, ua: init?.headers?.['User-Agent'] });
    if (decodeURIComponent(url).includes('Tel Aviv')) {
      return {
        json: async () => [{ lat: '32.0853', lon: '34.7818' }],
      };
    }
    if (decodeURIComponent(url).includes('bad')) {
      throw new Error('network');
    }
    return { json: async () => [] };
  };

  const deps = {
    now: () => fakeNow,
    sleep: async (ms) => {
      sleeps.push(ms);
      fakeNow += ms;
    },
  };

  const { results } = await geocodeAddresses(
    ['Tel Aviv', 'bad', '  ', ''],
    mockFetch,
    deps,
  );

  assert(results.length === 2, 'trims and drops empty addresses');
  assert(results[0].address === 'Tel Aviv', 'preserves input address key');
  assert(results[0].lat === 32.0853 && results[0].lng === 34.7818, 'parses lat/lng');
  assert(results[1].lat === null && results[1].lng === null, 'null on failure');

  assert(calls.length === 2, 'one fetch per uncached address');
  assert(
    calls.every((c) => c.ua === 'ZimmerBot/1.0 (desktop-search)'),
    'User-Agent header',
  );
  assert(
    calls[0].url.includes('countrycodes=il') && calls[0].url.includes('limit=1'),
    'Nominatim query params',
  );

  // Second pass — same addresses should hit cache (no new fetches)
  const before = calls.length;
  const again = await geocodeAddresses(['Tel Aviv', 'TEL AVIV'], mockFetch, deps);
  assert(again.results[0].lat === 32.0853, 'cache hit returns coords');
  assert(again.results[1].lat === 32.0853, 'normalized cache key');
  assert(calls.length === before, 'cache avoids Nominatim refetch');

  // Throttle: two different uncached addresses in one call → sleep between
  __resetGeocodeStateForTests();
  sleeps.length = 0;
  calls.length = 0;
  fakeNow = 1_000_000;
  await geocodeAddresses(['Haifa', 'Eilat'], mockFetch, deps);
  assert(calls.length === 2, 'two unique addresses → two fetches');
  assert(
    sleeps.some((ms) => ms >= 1000),
    'throttle sleep between Nominatim calls',
  );

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll geocode smoke tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
