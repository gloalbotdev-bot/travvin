/**
 * buildGuestSummary — GuestProfile upsert via InvokeLLM (Base44 port).
 */
import { SERVICE_ACTOR } from './service-role.js';
import { invokeLlm } from './llm/index.js';

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  err.body = { status, message };
  throw err;
}

/** @param {unknown} raw */
export function normalizePhoneE164(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d]/g, '');
  if (!s) return null;
  if (s.startsWith('972')) s = s.slice(3);
  else if (s.startsWith('00972')) s = s.slice(5);
  if (s.length === 10 && s.startsWith('0')) s = s.slice(1);
  else if (s.length === 9 && s.startsWith('0')) s = s.slice(1);
  if (s.length !== 9) return null;
  return `972${s}`;
}

/** @param {string|null|undefined} checkIn @param {string|null|undefined} checkOut */
function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.round(ms / 86400000);
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {object} payload
 * @param {import('./authz.js').Actor} actor
 */
export async function buildGuestSummary(store, payload = {}, actor) {
  let ownerId;
  let phoneE164 = null;

  if (payload.booking_id) {
    let b;
    try {
      b = await store.get('BookingRequest', payload.booking_id, SERVICE_ACTOR);
    } catch (e) {
      if (e.status === 404) fail(404, 'booking not found');
      throw e;
    }
    ownerId = b.owner_id;
    phoneE164 = normalizePhoneE164(b.guest_phone);
  } else {
    ownerId = payload.owner_id;
    phoneE164 = normalizePhoneE164(payload.guest_phone);
  }

  if (!ownerId || !phoneE164) fail(400, 'owner_id + guest_phone required');

  if (actor?.id !== SERVICE_ACTOR.id) {
    if (!actor?.id) fail(401, 'Unauthorized');
    if (actor.id !== ownerId && actor.role !== 'admin') fail(403, 'forbidden');
  }

  const allBookings = await store.filter('BookingRequest', { owner_id: ownerId }, undefined, undefined, SERVICE_ACTOR);
  const stays = (allBookings || [])
    .filter((b) => b.checked_out === true && normalizePhoneE164(b.guest_phone) === phoneE164)
    .sort(
      (a, b) =>
        new Date(a.checked_out_at || a.check_out).getTime() -
        new Date(b.checked_out_at || b.check_out).getTime(),
    );

  if (stays.length === 0) {
    return { ok: true, message: 'no checked-out stays' };
  }

  const last = stays[stays.length - 1];
  const first = stays[0];
  const stays_count = stays.length;
  const total_paid = stays.reduce((s, b) => s + (Number(b.total_price) || 0), 0);

  const customerUserIds = [
    ...new Set(stays.map((b) => b.created_by_id).filter((uid) => uid && uid !== ownerId)),
  ];

  /** @type {string[]} */
  const directChatLines = [];
  /** @type {string[]} */
  const chatSessionLines = [];

  for (const uid of customerUserIds) {
    try {
      const chats = await store.filter(
        'DirectChat',
        { owner_id: ownerId, customer_id: uid },
        undefined,
        undefined,
        SERVICE_ACTOR,
      );
      for (const c of chats || []) {
        (c.messages || []).slice(-40).forEach((m) => {
          directChatLines.push(`${m.role === 'customer' ? 'אורח' : 'בעלים'}: ${m.content || ''}`);
        });
      }
    } catch {
      /* ignore */
    }
    try {
      const sessions = await store.filter('ChatSession', { user_id: uid }, undefined, undefined, SERVICE_ACTOR);
      for (const s of sessions || []) {
        (s.messages || []).slice(-30).forEach((m) => {
          chatSessionLines.push(`${m.role || 'user'}: ${m.content || ''}`);
        });
      }
    } catch {
      /* ignore */
    }
  }

  const staysText = stays
    .map((b, i) => {
      const n = nightsBetween(b.check_in, b.check_out);
      return `שהייה ${i + 1}: צימר ${b.zimmer_name || '—'}, כניסה ${b.check_in || '—'}, יציאה ${b.check_out || '—'}, ${n} לילות, ${b.num_guests || '?'} אורחים.`;
    })
    .join('\n');

  const chatText = [...directChatLines, ...chatSessionLines].join('\n').slice(0, 6000);

  const prompt = `אתה עוזר של בעל צימר. בנה פרופיל קצר בעברית לאורח חוזר, שיעזור לבעל הצימר להכיר אותו ולהעניק שירות טוב יותר.

פרטי השהיות של האורח אצל בעל הצימר:
${staysText}

${
  chatText
    ? `קטעים משיחות ישירות מול האורח (צ'אט ישיר בלבד):
${chatText}`
    : 'אין שיחות ישירות זמינות לאורח זה.'
}

כתוב סיכום תמציתי בעברית (עד 5 שורות, ללא כותרות וללא סימני עיצוב) שכולל אך ורק:
- שם האורח
- בקשות או העדפות שעלו מהשיחות הישירות עם האורח עצמו (זמני כניסה/יציאה, בקשות שירות, העדפות מזון וכיו"ב)

כללים נוקשים — אל תחרוג מהם:
- אל תכתוב שום מטא-תצפית על דפוסי ההזמנה או החיפוש של הלקוח (כגון: בירורים מעמיקים, פתיחת מספר הזמנות במקביל, השוואות בין צימרים, תדירות חזרה, מספר הזמנות).
- אל תזכיר דירוג צ'ק-אאוט, הערות הזמנה פנימיות או מחיר ששולם.
- אל תמציא עובדות שלא מופיעות בשיחה הישירה. אם אין מספיק מידע — כתוב רק את שם האורח ואת פרטי השהייה (צימר, תאריכים, מספר אורחים).`;

  let aiSummary = '';
  try {
    const resp = await invokeLlm({ prompt });
    aiSummary = typeof resp === 'string' ? resp : String(resp || '');
    aiSummary = (aiSummary || '').trim();
  } catch {
    /* leave empty */
  }

  const profileData = {
    owner_id: ownerId,
    guest_name: last.guest_name || first.guest_name || '',
    phone_e164: phoneE164,
    guest_user_ids: customerUserIds,
    stays_count,
    total_paid,
    last_checkin: last.check_in || null,
    last_checkout: last.check_out || null,
    last_zimmer_name: last.zimmer_name || '',
    first_seen: first.check_in || null,
    ai_summary: aiSummary,
    ai_summary_updated_at: new Date().toISOString(),
  };

  const existing = await store.filter(
    'GuestProfile',
    { owner_id: ownerId, phone_e164: phoneE164 },
    undefined,
    undefined,
    SERVICE_ACTOR,
  );

  let profileId;
  if (existing?.length) {
    profileId = existing[0].id;
    await store.update('GuestProfile', profileId, profileData, SERVICE_ACTOR);
  } else {
    const created = await store.create('GuestProfile', profileData, {
      actor: SERVICE_ACTOR,
      createdById: SERVICE_ACTOR.id,
      createdBy: SERVICE_ACTOR.email,
    });
    profileId = created?.id;
  }

  return { ok: true, profile_id: profileId, stays_count, total_paid, ai_summary: aiSummary };
}
