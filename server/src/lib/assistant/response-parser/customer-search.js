/**
 * Customer search response parser — Phase 3 (uiEffects only, no DB mutations).
 */

const CUSTOMER_QUICK_OPTIONS = [
  { label: '🔍 בחר צימר ושאל שאלות', text: 'אני רוצה לשאול שאלות על אחד מהצימרים' },
  { label: '📅 הזמן אונליין', text: 'אני רוצה להזמין אחד מהצימרים' },
  { label: '🔄 שנה תאריכים', text: 'אני רוצה לשנות תאריכים' },
];

const DESKTOP_QUICK_OPTIONS = (topName = '') => [
  { label: '💬 שאל שאלה על צימר', text: `בנוגע לצימר "${topName}": ` },
  { label: '📅 הזמן אונליין', text: `אני רוצה להזמין את "${topName}"` },
  { label: '🔄 שנה תאריכים', text: 'אני רוצה לשנות תאריכים' },
];

function filterZimmerIds(ids, availableZimmers) {
  const allowed = new Set(availableZimmers.map((z) => z.id));
  return (Array.isArray(ids) ? ids : [])
    .filter((id) => typeof id === 'string' && allowed.has(id))
    .slice(0, 20);
}

function resolveZimmerId(id, availableZimmers) {
  if (typeof id !== 'string' || !id) return null;
  return availableZimmers.find((z) => z.id === id) || null;
}

/**
 * @param {unknown} raw
 * @param {{ availableZimmers: object[], surface: string, searchDates?: object|null }} ctx
 */
export function parseCustomerSearchResponse(raw, ctx) {
  const parsed =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...raw }
      : { action: 'answer', message: String(raw || ''), zimmer_ids: [] };

  const action = typeof parsed.action === 'string' ? parsed.action : 'answer';
  const message = typeof parsed.message === 'string' ? parsed.message : '';
  const zimmerIds = filterZimmerIds(parsed.zimmer_ids, ctx.availableZimmers);
  const zimmerId = resolveZimmerId(parsed.zimmer_id, ctx.availableZimmers)?.id || null;
  const unanswered = parsed.unanswered_question === true;

  const uiEffects = [];
  const topName =
    zimmerIds.length > 0
      ? ctx.availableZimmers.find((z) => z.id === zimmerIds[0])?.name || ''
      : '';

  if (action === 'search' && zimmerIds.length > 0) {
    uiEffects.push({ type: 'show_zimmers', zimmerIds });
    const options =
      ctx.surface === 'desktop'
        ? DESKTOP_QUICK_OPTIONS(topName)
        : CUSTOMER_QUICK_OPTIONS;
    uiEffects.push({ type: 'quick_options', options });
  } else if (action === 'view' && zimmerId) {
    uiEffects.push({ type: 'show_zimmer', zimmerId });
    uiEffects.push({
      type: 'quick_options',
      options: [
        { label: '💬 שאל שאלה', text: `בנוגע לצימר "${topName || ''}": ` },
        { label: '📅 הזמן', text: `אני רוצה להזמין את ${topName || 'הצימר'}` },
      ],
    });
  } else if (action === 'booking' && zimmerId) {
    uiEffects.push({
      type: 'booking_form',
      zimmerId,
      searchDates: ctx.searchDates || null,
    });
  } else if (unanswered && zimmerId) {
    uiEffects.push({
      type: 'unanswered_question_pending',
      zimmerId,
      note: 'Phase 3 — mutation deferred to Phase 4+ dispatcher',
    });
  }

  return {
    content: message || 'מצטער, לא הצלחתי לעבד את הבקשה.',
    parsed: {
      action,
      message,
      zimmer_ids: zimmerIds,
      zimmer_id: zimmerId,
      unanswered_question: unanswered,
    },
    uiEffects,
  };
}
