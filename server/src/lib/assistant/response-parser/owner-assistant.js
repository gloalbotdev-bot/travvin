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

const CARD_HINT_RE = /כרטיס|ממתין לאישור|אשר\/?י בכרטיס|לאישור בכרטיס/;

/**
 * Remove “approve on the card below” language when no pending action exists.
 * @param {string} text
 */
export function stripConfirmCardLanguage(text) {
  let out = String(text || '');
  out = out.replace(/\n*\s*⏳\s*ממתין לאישור בכרטיס למטה[^\n]*/g, '');
  out = out.replace(/אשר\/?י בכרטיס למטה\s*—?\s*[^.…\n]*/g, '');
  out = out.replace(/ממתין לאישור בכרטיס למטה/g, '');
  out = out.replace(/בכרטיס למטה/g, '');
  out = out.replace(/לאישור בכרטיס/g, 'לאישור');
  out = out.replace(/אישור בכרטיס/g, 'אישור');
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

/**
 * Rewrite LLM copy so it cannot claim a write already happened,
 * and never mentions a confirm card unless one was actually created.
 *
 * Important: a rejected/incomplete `operation` must NOT wipe an informational answer.
 * Only when the model was clearly proposing (false "done" / card language with nothing left)
 * do we replace with an incomplete-op hint.
 *
 * @param {string} content
 * @param {{ hasPendingAction?: boolean, incompleteOperation?: object|null }} opts
 */
export function finalizeOwnerAssistantContent(content, opts = {}) {
  const text = typeof content === 'string' && content.trim() ? content.trim() : 'תשובת mock בעברית';
  const looksDone = FALSE_DONE_RE.test(text);
  const incomplete = opts.incompleteOperation || null;

  if (opts.hasPendingAction) {
    if (looksDone) {
      return 'הכנתי הצעה לביצוע. אשר/י בכרטיס למטה (או כתבו "אישור") — עד אז לא נשמר שום שינוי.';
    }
    if (!/כרטיס|אישור|ממתין|מוצע/.test(text)) {
      return `${text}\n\n⏳ ממתין לאישור בכרטיס למטה (או כתבו "אישור") — עדיין לא בוצע שינוי.`;
    }
    return text;
  }

  // No pending card — never tell the owner to approve on a card.
  if (looksDone) {
    if (incomplete) return incompleteOperationMessage(incomplete);
    return 'עדיין לא ביצעתי שום שינוי. אם תרצי שאעדכן משהו — פרטי את הפרטים ואציע פעולה לאישור.';
  }
  if (CARD_HINT_RE.test(text)) {
    const cleaned = stripConfirmCardLanguage(text);
    // Card-only propose that failed the actionable gate → ask for missing fields.
    if (incomplete && (!cleaned || cleaned.length < 20)) {
      return incompleteOperationMessage(incomplete);
    }
    return cleaned || 'אשמח לעזור — פרטי מה תרצי לעדכן או לשאול.';
  }
  // Spurious incomplete op on a normal Q&A answer → keep the answer.
  return text;
}

/**
 * Short Hebrew hint when the model returned an operation that failed the actionable gate.
 * @param {object|null} op
 */
export function incompleteOperationMessage(op) {
  switch (op?.type) {
    case 'create_zimmer':
      return 'כדי להציע יצירת צימר לאישור חסר שם לצימר. כתבי את השם (ופרטים נוספים אם יש) ואציע שוב.';
    case 'update_zimmer':
      return 'כדי להציע עדכון צימר לאישור חסרים שדות לעדכון. פרטי מה לשנות ואציע שוב.';
    case 'create_booking':
      return 'כדי להציע הזמנה לאישור חסרים פרטים (שם אורח ותאריכי כניסה/יציאה). השלימו ואציע שוב.';
    case 'update_booking':
      return 'כדי להציע עדכון הזמנה לאישור חסרים פרטי הזיהוי או השדות לשינוי. פרטי ואציע שוב.';
    case 'block_dates':
      return 'כדי להציע חסימת תאריכים לאישור חסר תאריך התחלה. כתבי את התאריכים ואציע שוב.';
    case 'add_seasonal_price':
      return 'כדי להציע תמחור עונתי לאישור חסרים תאריכים או מחיר/אחוז. השלימו ואציע שוב.';
    default:
      return 'חסרים פרטים להצעת הפעולה. השלימו את הפרטים ואציע שוב לאישור.';
  }
}

/**
 * Short free-text confirm/cancel when an owner has an open pending action.
 * @param {string} text
 * @returns {'confirm'|'cancel'|null}
 */
export function parseOwnerTextActionDecision(text) {
  const n = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/^[/!]+/, '')
    .replace(/[.!?؟]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!n || n.length > 24) return null;
  if (/^(כן|אישור|מאשר|מאשרת|לאשר|confirm|yes|ok|okay|אוקיי)$/i.test(n)) return 'confirm';
  if (/^(לא|ביטול|מבטל|מבטלת|cancel|no)$/i.test(n)) return 'cancel';
  return null;
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
