/**
 * Owner assistant response parser — operations are proposals (confirmed separately).
 * Accepts function-calling results ({ message, functionCalls }) and the legacy JSON shape.
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

const MUTATION_CALLS = new Set([
  'create_zimmer',
  'update_zimmer',
  'create_booking',
  'update_booking',
  'block_dates',
  'add_seasonal_price',
]);

const CARD_HINT_RE = /כרטיס|ממתין לאישור|אשר\/?י בכרטיס|לאישור בכרטיס/;

const FALSE_DONE_RE =
  /(?:^|[\s.,;:!?\-—])(?:בוצע|בוצעה|עודכן|עודכנה|נוסף|נוספה|נוספו|נשמר|נשמרה|הושלם|הושלמה|שיניתי|עדכנתי|הוספתי|יצרתי|ביצעתי|אישרתי|נפתר)(?:$|[\s.,;:!?\-—])/;

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
  out = out.replace(/\s+\.$/, '.').replace(/\s{2,}/g, ' ').trim();
  return out;
}

/**
 * Keep informational answers. A confirm-card line is added only when a card exists.
 * @param {string} content
 * @param {{ hasPendingAction?: boolean, incompleteOperation?: object|null, zimmers?: object[] }} opts
 */
export function finalizeOwnerAssistantContent(content, opts = {}) {
  const text = typeof content === 'string' && content.trim() ? content.trim() : 'תשובת mock בעברית';
  const looksDone = FALSE_DONE_RE.test(text);
  const incomplete = opts.incompleteOperation || null;
  const zimmers = opts.zimmers || [];

  if (opts.hasPendingAction) {
    if (looksDone) {
      return 'הכנתי הצעה לביצוע. אשר/י בכרטיס למטה (או כתבו "אישור") — עד אז לא נשמר שום שינוי.';
    }
    if (!/כרטיס|אישור|ממתין|מוצע/.test(text)) {
      return `${text}\n\n⏳ ממתין לאישור בכרטיס למטה (או כתבו "אישור") — עדיין לא בוצע שינוי.`;
    }
    return text;
  }

  if (incomplete && !opts.hasPendingAction) {
    const gateMsg = incompleteOperationMessage(incomplete, zimmers);
    const name = typeof incomplete.name === 'string' ? incomplete.name.trim() : '';
    const isDuplicateCreate =
      incomplete.type === 'create_zimmer' &&
      name &&
      zimmers.some((z) => String(z?.name || '').trim() === name);
    if (isDuplicateCreate) return gateMsg;
    if (CARD_HINT_RE.test(text)) {
      const cleaned = stripConfirmCardLanguage(text);
      if (!cleaned || cleaned.length < 20 || looksDone) return gateMsg;
      return cleaned;
    }
    if (looksDone || text.length < 20) return gateMsg;
    return text;
  }

  if (CARD_HINT_RE.test(text)) {
    const cleaned = stripConfirmCardLanguage(text);
    return cleaned || 'אשמח לעזור — פרטי מה תרצי לעדכן או לשאול.';
  }
  return text;
}

/**
 * @param {object|null} op
 * @param {object[]} [zimmers]
 */
export function incompleteOperationMessage(op, zimmers = []) {
  if (op?.type === 'create_zimmer') {
    const name = typeof op.name === 'string' ? op.name.trim() : '';
    if (name && Array.isArray(zimmers) && zimmers.some((z) => String(z?.name || '').trim() === name)) {
      return `כבר יש צימר בשם "${name}". לעדכן את הקיים, לשנות שם לחדש, או בכל זאת ליצור צימר נוסף עם אותו שם?`;
    }
    if (!name || name.length < 2) {
      return 'כדי להציע יצירת צימר לאישור חסר שם תקין. כתבי את השם (ואת המיקום) ואציע שוב.';
    }
    if (!op.location || !String(op.location).trim()) {
      return 'כדי להציע יצירת צימר לאישור חסר מיקום. כתבי איפה נמצא הצימר ואציע שוב.';
    }
    const zones = op.data_zones;
    const rooms = op.rooms_detail;
    const zoneText = Array.isArray(zones)
      ? zones.map((z) => String(z?.content || z?.title || '')).join(' ')
      : '';
    if (/מיט(?:ה|ות)|מיטות|חדרי?\s*שינה|ספה\s*נפתחת/.test(zoneText) && !(Array.isArray(rooms) && rooms.length)) {
      return 'תיאורי חדרים ומיטות צריכים להיכנס ל־rooms_detail (לא ל־data_zones). פרטי את החדרים במבנה ואציע שוב.';
    }
    return 'כדי להציע יצירת צימר לאישור חסרים פרטים. השלימי שם ומיקום (ואת פירוט החדרים אם דיברת עליהם) ואציע שוב.';
  }
  switch (op?.type) {
    case 'update_zimmer':
      return 'כדי להציע עדכון צימר לאישור חסר צימר או שדה לעדכון. פרטי איזה צימר ומה לשנות ואציע שוב.';
    case 'create_booking':
      return 'כדי להציע הזמנה לאישור חסרים פרטים (שם אורח, טלפון, צימר, תאריכים, מספר אורחים וסטטוס). השלימו ואציע שוב.';
    case 'update_booking':
      return 'כדי להציע עדכון הזמנה לאישור חסרים פרטי הזיהוי או השדות לשינוי. פרטי ואציע שוב.';
    case 'block_dates':
      return 'כדי להציע חסימת תאריכים לאישור חסרים צימר ותאריך. ליום אחד מספיק תאריך אחד; לטווח — התחלה וסיום.';
    case 'add_seasonal_price':
      return 'כדי להציע תמחור עונתי לאישור חסרים צימר, טווח תאריכים ומחיר קבוע לעונה.';
    default:
      return 'חסרים פרטים להצעת הפעולה. השלימו את הפרטים ואציע שוב לאישור.';
  }
}

/**
 * Short free-text confirm/cancel when an owner has an open pending action.
 * Kept for WhatsApp / free-text channels (broader than bare "כן"/"אישור").
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
  const fromCalls = Array.isArray(raw?.functionCalls) ? raw.functionCalls : null;
  const message =
    typeof raw?.message === 'string' && raw.message.trim()
      ? raw.message.trim()
      : fromCalls?.length
        ? 'הכנתי הצעה. אשר/י בכרטיס למטה (או כתבו "אישור") — עד אז לא נשמר שום שינוי.'
        : 'תשובת mock בעברית';

  let operation = null;
  const actions = [];
  let openForm = null;

  if (fromCalls) {
    for (const call of fromCalls) {
      const name = call?.name;
      const args = call?.args && typeof call.args === 'object' ? call.args : {};
      if (MUTATION_CALLS.has(name) && !operation) {
        operation = sanitizeOperation({ type: name, ...args });
      } else if (name === 'show_view' && ALLOWED_ACTIONS.has(args.view)) {
        actions.push(args.view);
      } else if (name === 'open_form' && OPEN_FORMS.has(args.form)) {
        openForm = args.form;
      }
    }
  } else {
    operation =
      raw?.operation && typeof raw.operation === 'object' && raw.operation.type
        ? sanitizeOperation(raw.operation)
        : null;
    if (Array.isArray(raw?.actions)) {
      for (const a of raw.actions) {
        if (typeof a === 'string' && ALLOWED_ACTIONS.has(a)) actions.push(a);
      }
    }
    if (typeof raw?.open_form === 'string' && OPEN_FORMS.has(raw.open_form)) openForm = raw.open_form;
  }

  const uiEffects = [];
  if (actions.length) uiEffects.push({ type: 'owner_action_links', actions });
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
