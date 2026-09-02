/**
 * Owner assistant response parser — Phase 6.
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

/**
 * @param {unknown} raw
 * @param {{ mode: 'info'|'edit' }} opts
 */
export function parseOwnerAssistantResponse(raw, opts) {
  const mode = opts.mode === 'edit' ? 'edit' : 'info';

  let message =
    typeof raw?.message === 'string' && raw.message.trim()
      ? raw.message.trim()
      : 'תשובת mock בעברית';

  let operation = null;
  const rawHadOperation =
    raw?.operation && typeof raw.operation === 'object' && raw.operation.type;
  if (rawHadOperation) {
    operation = sanitizeOperation(raw.operation);
  }

  if (mode === 'info') {
    operation = null;
  }

  const actions = Array.isArray(raw?.actions)
    ? raw.actions.filter((a) => typeof a === 'string' && ALLOWED_ACTIONS.has(a))
    : [];

  const uiEffects = [];
  if (actions.length) {
    uiEffects.push({ type: 'owner_action_links', actions });
  }
  if (mode === 'info' && rawHadOperation) {
    uiEffects.push({ type: 'edit_mode_required' });
    message =
      message ||
      'אתה במצב מידע. כדי לבצע את הפעולה — עבור למצב עריכה עם המתג בכותרת.';
  }

  return {
    content: message,
    operation,
    actions,
    uiEffects,
    parsed: {
      message,
      operation,
      actions,
    },
  };
}
