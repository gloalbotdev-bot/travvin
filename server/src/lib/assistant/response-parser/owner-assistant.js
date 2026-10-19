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

/** Past-tense / success claims that must not appear before confirm or without an op. */
const FALSE_DONE_RE =
  /(?:^|[\s.,;:!?\-—])(?:בוצע|בוצעה|עודכן|עודכנה|נוסף|נוספה|נוספו|נשמר|נשמרה|הושלם|הושלמה|שיניתי|עדכנתי|הוספתי|יצרתי|ביצעתי|אישרתי|נפתר)(?:$|[\s.,;:!?\-—])/;

/**
 * Rewrite LLM copy so it cannot claim a write already happened.
 * @param {string} content
 * @param {{ hasPendingAction?: boolean }} opts
 */
export function finalizeOwnerAssistantContent(content, opts = {}) {
  const text = typeof content === 'string' && content.trim() ? content.trim() : 'תשובת mock בעברית';
  const looksDone = FALSE_DONE_RE.test(text);

  if (opts.hasPendingAction) {
    if (looksDone) {
      return 'הכנתי הצעה לביצוע. אשר/י בכרטיס למטה — עד אז לא נשמר שום שינוי.';
    }
    if (!/כרטיס|אישור|ממתין|מוצע/.test(text)) {
      return `${text}\n\n⏳ ממתין לאישור בכרטיס למטה — עדיין לא בוצע שינוי.`;
    }
    return text;
  }

  if (looksDone) {
    return 'עדיין לא ביצעתי שום שינוי. אם תרצי שאעדכן משהו — פרטי את הפרטים ואציע פעולה לאישור בכרטיס.';
  }
  return text;
}

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
