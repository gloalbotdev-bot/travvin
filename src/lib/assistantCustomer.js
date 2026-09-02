/**
 * Customer assistant UI — apply server uiEffects (Phase 4).
 */

export function buildRecentTurns(messages, limit = 20) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m.type === 'text' && typeof m.content === 'string')
    .slice(-limit)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'bot',
      content: m.content,
    }));
}

export function resolveZimmersByIds(zimmers, ids) {
  const list = Array.isArray(zimmers) ? zimmers : [];
  return (Array.isArray(ids) ? ids : [])
    .map((id) => list.find((z) => z.id === id))
    .filter(Boolean);
}

/**
 * @param {object} params
 * @param {object} params.response
 * @param {object[]} params.zimmers
 * @param {object|null} [params.searchDates]
 * @param {string} [params.userMessage]
 * @param {object} params.actions
 */
export async function applyCustomerUiEffects({
  response,
  zimmers,
  searchDates = null,
  userMessage = '',
  actions,
}) {
  const { message, uiEffects = [], meta = {} } = response || {};

  if (message?.content && actions.onBotText) {
    actions.onBotText(message.content);
  }

  if (meta.emptyAvailability && actions.onEmptyAvailability) {
    actions.onEmptyAvailability();
  }

  for (const effect of uiEffects) {
    switch (effect.type) {
      case 'map_results': {
        const found = resolveZimmersByIds(zimmers, effect.zimmerIds);
        actions.onMapResults?.(found, effect);
        break;
      }
      case 'show_zimmers': {
        const found = resolveZimmersByIds(zimmers, effect.zimmerIds);
        actions.onShowZimmers?.(found, effect.zimmerIds);
        break;
      }
      case 'show_zimmer': {
        const z = zimmers.find((x) => x.id === effect.zimmerId);
        if (z) actions.onShowZimmer?.(z);
        break;
      }
      case 'quick_options':
        actions.onQuickOptions?.(effect.options || []);
        break;
      case 'booking_form': {
        const z = zimmers.find((x) => x.id === effect.zimmerId);
        if (z) actions.onBookingForm?.(z, effect.searchDates || searchDates);
        break;
      }
      case 'unanswered_question_pending': {
        const z = zimmers.find((x) => x.id === effect.zimmerId);
        if (z) await actions.onUnansweredQuestion?.(z, userMessage);
        break;
      }
      case 'date_search_widget':
        actions.onDateSearchWidget?.();
        break;
      default:
        break;
    }
  }

  const parsed = meta.parsed;
  if (
    parsed?.action === 'search' &&
    parsed.zimmer_ids?.length &&
    !uiEffects.some((e) => e.type === 'show_zimmers')
  ) {
    const found = resolveZimmersByIds(zimmers, parsed.zimmer_ids);
    if (found.length) actions.onShowZimmers?.(found, parsed.zimmer_ids);
  }
}
