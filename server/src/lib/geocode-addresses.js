/**
 * geocodeAddresses — Nominatim with throttle + in-memory cache (M15 #12).
 * Policy: ≤1 req/sec; User-Agent required.
 */

const NOMINATIM_UA = 'ZimmerBot/1.0 (desktop-search)';
const MIN_INTERVAL_MS = Number(process.env.NOMINATIM_MIN_INTERVAL_MS || 1100);
const CACHE_TTL_MS = Number(process.env.NOMINATIM_CACHE_TTL_MS || 24 * 60 * 60 * 1000);
const CACHE_MAX = Number(process.env.NOMINATIM_CACHE_MAX || 500);

/** @type {Map<string, { lat: number|null, lng: number|null, at: number }>} */
const cache = new Map();
let lastFetchAt = 0;

function normalizeAddress(addr) {
  return String(addr || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // LRU-ish: re-insert
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key, lat, lng) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { lat, lng, at: Date.now() });
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

async function throttle(nowImpl = Date.now, sleepImpl = sleep) {
  const now = nowImpl();
  const wait = lastFetchAt + MIN_INTERVAL_MS - now;
  if (wait > 0) await sleepImpl(wait);
  lastFetchAt = nowImpl();
}

/** @internal test helper */
export function __resetGeocodeStateForTests() {
  cache.clear();
  lastFetchAt = 0;
}

/**
 * @param {string[]} rawAddresses
 * @param {typeof fetch} [fetchImpl]
 * @param {{ now?: () => number, sleep?: (ms: number) => Promise<void> }} [deps]
 * @returns {Promise<{ results: Array<{ address: string, lat: number|null, lng: number|null }> }>}
 */
export async function geocodeAddresses(
  rawAddresses,
  fetchImpl = fetch,
  deps = {},
) {
  const nowImpl = deps.now || Date.now;
  const sleepImpl = deps.sleep || sleep;

  const addresses = Array.isArray(rawAddresses)
    ? rawAddresses.map((a) => String(a || '').trim()).filter(Boolean)
    : [];

  const results = [];
  for (const addr of addresses) {
    const key = normalizeAddress(addr);
    const cached = cacheGet(key);
    if (cached) {
      results.push({ address: addr, lat: cached.lat, lng: cached.lng });
      continue;
    }

    try {
      await throttle(nowImpl, sleepImpl);
      const url =
        'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=il&q=' +
        encodeURIComponent(addr);
      const res = await fetchImpl(url, {
        headers: { 'User-Agent': NOMINATIM_UA },
      });
      const json = await res.json();
      if (Array.isArray(json) && json[0]?.lat && json[0]?.lon) {
        const lat = parseFloat(json[0].lat);
        const lng = parseFloat(json[0].lon);
        cacheSet(key, lat, lng);
        results.push({ address: addr, lat, lng });
      } else {
        cacheSet(key, null, null);
        results.push({ address: addr, lat: null, lng: null });
      }
    } catch {
      results.push({ address: addr, lat: null, lng: null });
    }
  }

  return { results };
}
