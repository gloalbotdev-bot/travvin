/**
 * Auto-geocode Zimmer.stay_settings.address → lat/lng when the owner saved an
 * address without picking a point on the map. Runs from entity hooks (async).
 * A manually picked point (geo_source: 'manual') is never overwritten.
 */
import { geocodeAddresses } from './geocode-addresses.js';
import { SERVICE_ACTOR } from './service-role.js';

function norm(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasPoint(ss) {
  return Number.isFinite(ss?.lat) && Number.isFinite(ss?.lng);
}

/**
 * @param {object} record  Zimmer after create/update
 * @param {object|null} old Zimmer before update (null on create)
 * @returns {string|null} address to geocode, or null to skip
 */
export function addressToAutoGeocode(record, old) {
  const ss = record?.stay_settings || {};
  const address = String(ss.address || '').trim();
  if (!address) return null;
  // City-only address would produce a misleading "precise" marker.
  if (norm(address) === norm(record?.location)) return null;
  if (ss.geo_source === 'manual') return null;

  const oldSs = old?.stay_settings || {};
  const pointChanged = old && (oldSs.lat !== ss.lat || oldSs.lng !== ss.lng);
  if (pointChanged && hasPoint(ss)) return null;

  if (!hasPoint(ss)) return address;
  if (ss.geo_source === 'auto' && old && norm(oldSs.address) !== norm(address)) return address;
  return null;
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {object} record
 * @param {object|null} old
 * @param {{ geocode?: (addresses: string[]) => Promise<{ results: Array<{ lat: number|null, lng: number|null }> }> }} [deps]
 * @returns {Promise<boolean>} true when coordinates were written
 */
export async function maybeAutoGeocodeZimmer(store, record, old, deps = {}) {
  const address = addressToAutoGeocode(record, old);
  if (!address || !record?.id) return false;

  const geocode = deps.geocode || geocodeAddresses;
  const { results } = await geocode([address]);
  const hit = results?.[0];
  if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) {
    console.warn('[zimmer-auto-geocode] no result for zimmer', record.id);
    return false;
  }

  const fresh = await store.get('Zimmer', record.id, SERVICE_ACTOR);
  const freshSs = fresh?.stay_settings || {};
  if (norm(freshSs.address) !== norm(address) || freshSs.geo_source === 'manual') return false;

  await store.update(
    'Zimmer',
    record.id,
    { stay_settings: { ...freshSs, lat: hit.lat, lng: hit.lng, geo_source: 'auto' } },
    SERVICE_ACTOR,
  );
  return true;
}
