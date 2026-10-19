/**
 * Owner assistant response parser — operations are proposals (confirmed separately).
 */
import { sanitizeOperation } from '../../owner-assistant-ops.js';

const ALLOWED_ACTIONS = new Set([
  'bookings',
  'calendar',
  'questions',
  'reviews',
  'new_zimmer',
  'edit_zimmer',
]);

const OPEN_FORMS = new Set(['block', 'price', 'booking']);

/**
 * @param {unknown} raw
 * @param {{ focus?: { date?: string, zimmerId?: string }|null }} [opts]
 */
export function parseOwnerAssistantResponse(raw, opts = {}) {
  const message =
    typeof raw?.message === 'string' && raw.message.trim()
      ? raw.message.trim()
      : 'תשובת mock בעברית';

  const operation =
    raw?.operation && typeof raw.operation === 'object' && raw.operation.type
      ? sanitizeOperation(raw.operation)
      : null;

  const actions = Array.isArray(raw?.actions)
    ? raw.actions.filter((a) => typeof a === 'string' && ALLOWED_ACTIONS.has(a))
    : [];

  const openForm = typeof raw?.open_form === 'string' && OPEN_FORMS.has(raw.open_form)
    ? raw.open_form
    : null;

  const uiEffects = [];
  if (actions.length) {
    uiEffects.push({ type: 'owner_action_links', actions });
  }
  if (openForm) {
    uiEffects.push({
      type: 'open_form',
      form: openForm,
      date: opts.focus?.date || null,
      zimmerId: opts.focus?.zimmerId || null,
    });
  }

  return {
    content: message,
    operation,
    actions,
    openForm,
    uiEffects,
    parsed: {
      message,
      operation,
      actions,
      open_form: openForm,
    },
  };
}
