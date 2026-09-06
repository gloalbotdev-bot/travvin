/**
 * autoCheckoutExpiredStays — hourly cron helper (Base44 port, internal only).
 */
import { SERVICE_ACTOR } from './service-role.js';

function ilOffsetMin(d) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    timeZoneName: 'shortOffset',
  }).formatToParts(d);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+3';
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(tz);
  if (!m) return 180;
  const sign = m[1] === '-' ? -1 : 1;
  const h = parseInt(m[2], 10) || 0;
  const min = m[3] ? parseInt(m[3], 10) : 0;
  return sign * (h * 60 + min);
}

/** Convert Israel wall-clock (YYYY-MM-DD, hh, mm) to UTC Date. */
function ilWallToUtc(dateStr, hh, mm) {
  const [Y, Mo, D] = dateStr.split('-').map((n) => parseInt(n, 10));
  const utcApprox = new Date(Date.UTC(Y, Mo - 1, D, hh, mm, 0));
  const offset = ilOffsetMin(utcApprox);
  return new Date(utcApprox.getTime() - offset * 60000);
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 */
export async function autoCheckoutExpiredStays(store) {
  const nowMs = Date.now();
  const FIVE_HOURS = 5 * 3600000;

  let approved = [];
  try {
    approved = await store.filter('BookingRequest', { status: 'אושרה' }, '-created_date', 2000, SERVICE_ACTOR);
  } catch {
    /* ignore */
  }

  const pending = (approved || []).filter((b) => b.checked_out !== true && b.check_out);

  /** @type {Record<string, string>} */
  const checkoutTimeCache = {};
  const getCheckoutTime = async (zimmerId) => {
    if (!zimmerId) return '11:00';
    if (checkoutTimeCache[zimmerId]) return checkoutTimeCache[zimmerId];
    let t = '11:00';
    try {
      const z = await store.get('Zimmer', zimmerId, SERVICE_ACTOR);
      t = z?.stay_settings?.checkout_time || '11:00';
    } catch {
      t = '11:00';
    }
    checkoutTimeCache[zimmerId] = t;
    return t;
  };

  /** @type {Array<object>} */
  const results = [];
  for (const b of pending) {
    const t = await getCheckoutTime(b.zimmer_id);
    const parts = (t || '11:00').split(':');
    const hh = parseInt(parts[0], 10) || 11;
    const mm = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
    const checkoutDate = String(b.check_out).slice(0, 10);
    if (!checkoutDate) continue;
    const checkoutUtc = ilWallToUtc(checkoutDate, hh, mm);
    if (nowMs >= checkoutUtc.getTime() + FIVE_HOURS) {
      try {
        await store.update(
          'BookingRequest',
          b.id,
          {
            checked_out: true,
            checked_out_at: new Date().toISOString(),
            checkout_by: 'owner',
          },
          SERVICE_ACTOR,
        );
        results.push({ id: b.id, guest: b.guest_name, checkout: checkoutDate });
      } catch (e) {
        results.push({ id: b.id, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  return { ok: true, scanned: pending.length, checked_out: results.length, results };
}

export { ilWallToUtc, ilOffsetMin };
