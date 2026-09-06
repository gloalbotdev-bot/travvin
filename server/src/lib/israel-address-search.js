/**
 * searchIsraelAddresses — data.gov.il + Nominatim (Base44 port).
 * Allowlisted hosts only; cities/streets cached in memory.
 */
const DATAGOV = 'https://data.gov.il/api/3/action/datastore_search';
const CITIES_RID = 'b7cf8f14-64a2-4b33-8d4b-edb286fdbd37';
const STREETS_RID = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const UA = 'ZimmerBot/1.0 (address-search)';

const ALLOWED_HOSTS = new Set(['data.gov.il', 'nominatim.openstreetmap.org']);

const MIN_INTERVAL_MS = Number(process.env.NOMINATIM_MIN_INTERVAL_MS || 1100);
let lastNominatimFetchAt = 0;

/** @type {Array<{ code: number, name: string }>|null} */
let citiesCache = null;
/** @type {Map<number, Array<{ name: string }>>} */
const streetsCache = new Map();

const trim = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  err.body = { status, message };
  throw err;
}

function assertAllowedUrl(urlStr) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    fail(400, 'invalid url');
  }
  if (!ALLOWED_HOSTS.has(u.hostname)) {
    fail(400, 'host not allowed');
  }
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

async function throttleNominatim(nowImpl = Date.now) {
  const now = nowImpl();
  const wait = lastNominatimFetchAt + MIN_INTERVAL_MS - now;
  if (wait > 0) await sleep(wait);
  lastNominatimFetchAt = nowImpl();
}

/**
 * @param {string} url
 * @param {typeof fetch} fetchImpl
 * @param {RequestInit} [init]
 */
async function safeFetch(url, fetchImpl, init) {
  assertAllowedUrl(url);
  return fetchImpl(url, init);
}

/**
 * @param {typeof fetch} [fetchImpl]
 */
async function getCities(fetchImpl = fetch) {
  if (citiesCache) return citiesCache;
  const url = `${DATAGOV}?resource_id=${CITIES_RID}&limit=1500`;
  const res = await safeFetch(url, fetchImpl);
  const j = await res.json();
  const records = j?.result?.records || [];
  citiesCache = records
    .map((r) => ({ code: r['סמל_ישוב'], name: trim(r['שם_ישוב']) }))
    .filter((r) => r.name);
  return citiesCache;
}

/**
 * @param {number|string} code
 * @param {typeof fetch} [fetchImpl]
 */
async function getStreets(code, fetchImpl = fetch) {
  const key = Number(code);
  if (streetsCache.has(key)) return streetsCache.get(key);
  const filters = encodeURIComponent(JSON.stringify({ 'סמל_ישוב': key }));
  const url = `${DATAGOV}?resource_id=${STREETS_RID}&limit=5000&filters=${filters}`;
  const res = await safeFetch(url, fetchImpl);
  const j = await res.json();
  const records = j?.result?.records || [];
  const seen = new Set();
  const list = [];
  for (const r of records) {
    const name = trim(r['שם_רחוב']);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    list.push({ name });
  }
  streetsCache.set(key, list);
  return list;
}

/** @internal test helper */
export function __resetIsraelAddressStateForTests() {
  citiesCache = null;
  streetsCache.clear();
  lastNominatimFetchAt = 0;
}

/**
 * @param {{ mode?: string, query?: string, code?: number|string, city?: string, lat?: number, lng?: number }} opts
 * @param {typeof fetch} [fetchImpl]
 * @param {{ now?: () => number }} [deps]
 */
export async function searchIsraelAddresses(opts = {}, fetchImpl = fetch, deps = {}) {
  const nowImpl = deps.now || Date.now;
  const mode = String(opts.mode || 'city');

  if (mode === 'reverse') {
    const lat = parseFloat(String(opts.lat));
    const lng = parseFloat(String(opts.lng));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) fail(400, 'bad coords');
    await throttleNominatim(nowImpl);
    const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await safeFetch(url, fetchImpl, { headers: { 'User-Agent': UA } });
    const j = await res.json();
    const a = j?.address || {};
    return {
      address: j?.display_name || '',
      city: a.city || a.town || a.village || a.hamlet || a.suburb || a.locality || '',
      street: a.road || a.pedestrian || a.path || '',
      house: a.house_number || '',
    };
  }

  if (mode === 'city') {
    const query = trim(opts.query);
    const all = await getCities(fetchImpl);
    let results = query ? all.filter((c) => c.name.includes(query)) : [];
    results = results.slice(0, 50);
    return { results };
  }

  if (mode === 'street') {
    const city = String(opts.city || '').trim();
    const query = trim(opts.query);
    let codeFilter = opts.code;
    if (codeFilter == null && city) {
      const all = await getCities(fetchImpl);
      const rec = all.find((r) => r.name === city);
      if (!rec) return { results: [] };
      codeFilter = rec.code;
    }
    if (codeFilter == null) return { results: [] };
    const allStreets = await getStreets(codeFilter, fetchImpl);
    let results = query ? allStreets.filter((s) => s.name.includes(query)) : allStreets;
    results = results.slice(0, 50);
    return { results };
  }

  fail(400, 'unknown mode');
}
