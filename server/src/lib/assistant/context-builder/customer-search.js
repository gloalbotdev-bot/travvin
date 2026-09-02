/**
 * Customer search context builder — Phase 3 (server-side, mirrors CustomerChat/SearchChat).
 */
import { REGION_KEYWORDS } from '../../regions.js';
import {
  formatILS,
  rankZimmersByFit,
  zimmerPriceSummary,
} from '../../booking-price.js';
import { formatZimmerKnowledgeForPrompt, sanitizeUntrustedText } from '../../sanitize-prompt-data.js';
import { getBookedZimmerIds } from '../customer-availability.js';

const MAX_RECENT_TURNS = 20;
const MAX_TURN_CONTENT = 2000;

/**
 * @param {unknown} clientState
 */
export function parseClientState(clientState) {
  if (!clientState || typeof clientState !== 'object' || Array.isArray(clientState)) {
    return {
      surface: 'customer',
      searchDates: null,
      searchParams: null,
      recentTurns: [],
    };
  }

  const surface =
    clientState.surface === 'desktop' ? 'desktop' : 'customer';

  const recentTurns = normalizeRecentTurns(clientState.recentTurns);

  return {
    surface,
    searchDates: clientState.searchDates || null,
    searchParams: clientState.searchParams || null,
    recentTurns,
  };
}

function normalizeRecentTurns(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-MAX_RECENT_TURNS).flatMap((t) => {
    if (!t || typeof t !== 'object') return [];
    const role = t.role === 'user' || t.role === 'bot' ? t.role : null;
    if (!role) return [];
    const content = sanitizeUntrustedText(String(t.content || '')).slice(0, MAX_TURN_CONTENT);
    if (!content) return [];
    return [{ role, content }];
  });
}

function filterByRegion(zimmers, regions, freeText) {
  if (!regions?.length && !freeText) return zimmers;
  return zimmers.filter((z) => {
    const loc = (z.location || '').trim();
    if (!loc) return false;
    const regionMatch = (regions || []).some((region) =>
      (REGION_KEYWORDS[region] || []).some((kw) => loc.includes(kw)),
    );
    const freeMatch =
      freeText && (loc.includes(freeText) || freeText.includes(loc));
    return regionMatch || freeMatch;
  });
}

function formatZimmerContextLine(z, opts) {
  const zones = formatZimmerKnowledgeForPrompt(z);
  const {
    priceCheckIn,
    priceCheckOut,
    numAdults,
    numChildren,
    numGuests,
    compact,
  } = opts;

  let priceStr = `מחיר: ${z.price_per_night ? z.price_per_night + '₪/לילה' : compact ? '—' : 'לא צוין'}`;
  if (priceCheckIn && priceCheckOut) {
    const price = zimmerPriceSummary(z, priceCheckIn, priceCheckOut, numAdults, numChildren);
    if (compact) {
      priceStr = price.isPartial
        ? `${formatILS(price.avg)}/לילה (חלקי, סה"כ ${formatILS(price.total)})`
        : `${formatILS(price.avg)}/לילה (מלא, סה"כ ${formatILS(price.total)})`;
    } else {
      priceStr = price.isPartial
        ? `מחיר ללילה: ${formatILS(price.avg)} (תמחור חלקי, סה"כ ${formatILS(price.total)})`
        : `מחיר ללילה: ${formatILS(price.avg)} (מחיר מלא, סה"כ ${formatILS(price.total)})`;
    }
  }

  if (compact) {
    return `--- ${z.name} (ID: ${z.id}) --- מיקום: ${z.location || '—'} | ${priceStr} | חדרים: ${z.num_rooms || '?'} | מקס אורחים: ${z.max_guests || '?'}\n${zones}`;
  }

  const price = priceCheckIn && priceCheckOut
    ? zimmerPriceSummary(z, priceCheckIn, priceCheckOut, numAdults, numChildren)
    : null;
  const priceLine = price
    ? price.isPartial
      ? `מחיר ללילה: ${formatILS(price.avg)} (תמחור חלקי לפי אדם, סה"כ ${formatILS(price.total)} ל-${price.nights} לילות)`
      : `מחיר ללילה: ${formatILS(price.avg)} (מחיר מלא, סה"כ ${formatILS(price.total)} ל-${price.nights} לילות)`
    : priceStr;

  const spare = numGuests != null
    ? ` | תפוסה לקבוצה: ${Math.max(0, (z.max_guests || 0) - numGuests)} מקומות עודפים`
    : '';

  return `--- ${z.name} (ID: ${z.id}) --- מיקום: ${z.location || 'לא צוין'} | ${priceLine} | חדרים: ${z.num_rooms || '?'} | אורחים מקס: ${z.max_guests || '?'}${spare} | ${zones}`;
}

async function loadCustomerContext(store, actor, message, priorUserTurns) {
  if (!actor?.id || actor.role !== 'user') return '';

  const asksAboutProfile = /הזמנ|היסטור|פרופיל|הבאה|קרובה|הבא שלי|ההזמנות שלי/.test(message);
  if (priorUserTurns > 0 && !asksAboutProfile) return '';

  try {
    const [bookings, sessions] = await Promise.all([
      store.filter('BookingRequest', { created_by_id: actor.id }, '-created_date', 50, actor),
      store.filter('ChatSession', { user_id: actor.id }, '-created_date', 3, actor),
    ]);

    const now = new Date();
    const upcoming = bookings
      .filter((b) => new Date(b.check_in) >= now)
      .sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
    const past = bookings
      .filter((b) => new Date(b.check_out) < now)
      .sort((a, b) => new Date(b.check_out) - new Date(a.check_out));
    const lastSearch = sessions[0];

    let ctx = `\nמידע על הלקוח המחובר (${actor.full_name || actor.email}, ${actor.email}):`;
    if (upcoming.length > 0) {
      ctx += `\n- הזמנות קרובות (${upcoming.length}):`;
      upcoming.slice(0, 3).forEach((u) => {
        ctx += `\n  • ${u.zimmer_name} מ-${u.check_in} עד ${u.check_out} (סטטוס: ${u.status})`;
      });
    } else {
      ctx += `\n- אין הזמנות קרובות`;
    }
    if (past.length > 0) {
      const p = past[0];
      ctx += `\n- הזמנה אחרונה שהסתיימה: ${p.zimmer_name} מ-${p.check_in} עד ${p.check_out} (${p.status})`;
    }
    if (bookings.length > 0) {
      ctx += `\n- סה"כ ${bookings.length} הזמנות בהיסטוריה`;
    }
    if (lastSearch?.created_date) {
      ctx += `\n- חיפוש אחרון: ${new Date(lastSearch.created_date).toLocaleDateString('he-IL')}`;
    }
    return ctx;
  } catch {
    return '';
  }
}

/**
 * @param {{ store: ReturnType<import('../entity-store.js').createEntityStore>, prisma: import('@prisma/client').PrismaClient }} deps
 * @param {{ actor: import('../authz.js').Actor|null|undefined, profileId: string, message: string, clientState: unknown }} input
 */
export async function buildCustomerSearchContext(deps, input) {
  const { store, prisma } = deps;
  const { actor, profileId, message, clientState } = input;
  const parsed = parseClientState(clientState);

  const allZimmers = await store.filter(
    'Zimmer',
    { approval_status: 'אושר' },
    null,
    null,
    actor || null,
  );

  let availableZimmers = allZimmers;
  let datesInfo = '';
  let numAdults = 0;
  let numChildren = 0;
  let priceCheckIn = null;
  let priceCheckOut = null;
  let searchParams = parsed.searchParams;
  let dateSearchLabel = '';

  if (profileId === 'customer_date_search' && searchParams) {
    if (searchParams.mode === 'exact') {
      priceCheckIn = searchParams.checkIn;
      priceCheckOut = searchParams.checkOut;
    } else {
      priceCheckIn = searchParams.rangeStart;
      priceCheckOut = new Date(
        new Date(searchParams.rangeStart).getTime() +
          (searchParams.numNights || 2) * 86400000,
      )
        .toISOString()
        .split('T')[0];
    }
    const checkIn = searchParams.checkIn || searchParams.rangeStart;
    const checkOut = searchParams.checkOut || searchParams.rangeEnd;
    const bookedIds = await getBookedZimmerIds(prisma, checkIn, checkOut);
    numAdults = searchParams.num_adults || 0;
    numChildren = searchParams.num_children || 0;

    availableZimmers = allZimmers.filter(
      (z) =>
        !bookedIds.includes(z.id) &&
        (!z.max_guests || z.max_guests >= (searchParams.numGuests || 1)),
    );

    if (searchParams.max_budget) {
      availableZimmers = availableZimmers.filter((z) => {
        const price = zimmerPriceSummary(
          z,
          priceCheckIn,
          priceCheckOut,
          numAdults,
          numChildren,
        );
        return price.avg <= searchParams.max_budget;
      });
    }

    if (searchParams.regions?.length || searchParams.freeText) {
      availableZimmers = filterByRegion(
        availableZimmers,
        searchParams.regions,
        searchParams.freeText,
      );
    }

    availableZimmers = rankZimmersByFit(availableZimmers, numAdults, numChildren);

    dateSearchLabel =
      searchParams.mode === 'exact'
        ? `${checkIn} עד ${checkOut}, ${searchParams.numGuests} אורחים`
        : `${searchParams.numNights} לילות בין ${searchParams.rangeStart} ל-${searchParams.rangeEnd}, ${searchParams.numGuests} אורחים`;
    if (searchParams.regions?.length) dateSearchLabel += `, ${searchParams.regions.join('/')}`;
    else if (searchParams.freeText) dateSearchLabel += `, ${searchParams.freeText}`;
    if (searchParams.max_budget) dateSearchLabel += `, עד ${formatILS(searchParams.max_budget)}`;
  } else if (parsed.searchDates) {
    const sd = parsed.searchDates;
    const checkIn = sd.checkIn || sd.rangeStart;
    const checkOut = sd.checkOut || sd.rangeEnd;
    const bookedIds = await getBookedZimmerIds(prisma, checkIn, checkOut);
    availableZimmers = allZimmers.filter(
      (z) =>
        !bookedIds.includes(z.id) &&
        (!z.max_guests || z.max_guests >= (sd.numGuests || 1)),
    );
    numAdults = sd.num_adults || 0;
    numChildren = sd.num_children || 0;
    if (sd.checkIn) {
      priceCheckIn = sd.checkIn;
      priceCheckOut = sd.checkOut;
      datesInfo = `תאריכי חיפוש: ${sd.checkIn} עד ${sd.checkOut}, ${numAdults} מבוגרים ו-${numChildren} ילדים.`;
    } else {
      priceCheckIn = sd.rangeStart;
      priceCheckOut = new Date(
        new Date(sd.rangeStart).getTime() + ((sd.numNights || 2) * 86400000),
      )
        .toISOString()
        .split('T')[0];
      datesInfo = `חיפוש גמיש: ${sd.numNights} לילות בין ${sd.rangeStart} ל-${sd.rangeEnd}, ${numAdults} מבוגרים ו-${numChildren} ילדים.`;
    }
    availableZimmers = rankZimmersByFit(availableZimmers, numAdults, numChildren);
  }

  const compact = parsed.surface === 'desktop';
  const zimmerContext = availableZimmers
    .map((z) =>
      formatZimmerContextLine(z, {
        priceCheckIn,
        priceCheckOut,
        numAdults,
        numChildren,
        numGuests: searchParams?.numGuests ?? parsed.searchDates?.numGuests,
        compact,
      }),
    )
    .join(compact ? '\n' : '\n\n');

  const historyLimit = compact ? 6 : 20;
  const historyText = parsed.recentTurns
    .slice(-historyLimit)
    .map((m) =>
      m.role === 'user'
        ? `לקוח: ${m.content}`
        : `בוט: ${typeof m.content === 'string' ? m.content : '[תוצאות]'}`,
    )
    .join('\n');

  const priorUserTurns = parsed.recentTurns.filter((m) => m.role === 'user').length;
  const customerContext = await loadCustomerContext(store, actor, message, priorUserTurns);

  let contextText = '';
  if (profileId === 'customer_date_search' && searchParams) {
    contextText =
      searchParams.mode === 'flexible'
        ? `מחפש ${searchParams.numNights} לילות בין ${searchParams.rangeStart} ל-${searchParams.rangeEnd}, ${numAdults} מבוגרים ו-${numChildren} ילדים`
        : `מחפש מ-${searchParams.checkIn} עד ${searchParams.checkOut}, ${numAdults} מבוגרים ו-${numChildren} ילדים`;
    if (searchParams.max_budget) contextText += `, תקציב עד ${formatILS(searchParams.max_budget)} ללילה`;
    if (searchParams.regions?.length) contextText += `, אזור: ${searchParams.regions.join(' / ')}`;
    if (searchParams.freeText) contextText += `, חיפוש חופשי: "${searchParams.freeText}"`;
    if (searchParams.amenities?.length) {
      contextText += `\nמתקנים מבוקשים: ${searchParams.amenities.join(', ')}`;
    }
  }

  return {
    surface: parsed.surface,
    availableZimmers,
    zimmerContext,
    historyText,
    datesInfo,
    customerContext,
    contextText,
    dateSearchLabel,
    searchParams,
    numAdults,
    numChildren,
    priceCheckIn,
    priceCheckOut,
  };
}
