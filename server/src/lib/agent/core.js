/**
 * Channel-agnostic AI agent core.
 *
 * Takes a text message from any channel (WhatsApp today; SMS, Telegram, voice later), works out
 * who is talking, keeps the conversation going, asks the AI "brain" and returns plain text.
 * Knows nothing about WhatsApp, HTTP or the database — those arrive as injected ports
 * (see contract below and ./travvin.js for the app binding).
 *
 * v1 product rule: owners/admins only. Guests and customers are refused on this channel.
 */
import { parseCommand, resolveQuickOption } from './commands.js';

/**
 * @typedef {object} AgentIdentity
 * @property {'anonymous' | 'user' | 'ambiguous'} kind
 * @property {{ id: string, role: string, email?: string } | null} [actor]
 * @property {{ id: string, full_name?: string, email?: string } | null} [user]
 * @property {string} [name]
 */

/**
 * @typedef {object} AgentSession
 * @property {string} [id]
 * @property {string} channel
 * @property {string} address
 * @property {string} [user_id]
 * @property {string} [role]
 * @property {string} [display_name]
 * @property {string} [profile]
 * @property {string} [conversation_id]
 * @property {'info' | 'edit'} [mode]
 * @property {string} [mode_expires_at]
 * @property {{ role: 'user' | 'bot', content: string }[]} [recent_turns]
 * @property {{ label: string, text: string }[]} [quick_options]
 * @property {boolean} [opted_out]
 * @property {string} [last_inbound_at]
 * @property {string} [pending_action_id]
 */

/**
 * @typedef {object} BrainResult
 * @property {string|null} [conversationId]
 * @property {{ content: string }} message
 * @property {object[]} [uiEffects]
 * @property {object[]} [executedActions]
 */

/**
 * Ports the host application provides.
 * @typedef {object} AgentPorts
 * @property {{ chat: (req: { profile: string, message: string, conversationId: string|null, clientState: object }, identity: AgentIdentity) => Promise<BrainResult> }} brain
 * @property {{ get: (channel: string, address: string) => Promise<AgentSession|null>, save: (session: AgentSession) => Promise<AgentSession> }} sessions
 * @property {{ resolve: (channel: string, address: string) => Promise<AgentIdentity> }} identities
 * @property {(effects: object[], ctx: { identity: AgentIdentity, session: AgentSession }) => Promise<{ lines: string[], quickOptions: { label: string, text: string }[] }>} [renderEffects]
 * @property {() => Date} [now]
 */

const OWNER_ROLES = new Set(['owner', 'admin']);
const MAX_TURNS = { owner: 8, customer: 20 };
const MAX_TURN_CHARS = 1500;
const EDIT_MODE_MINUTES = 30;
const CONFIRM_TOKEN = '__confirm_action__';
const CANCEL_TOKEN = '__cancel_action__';

/** Reply texts. Hebrew first — the product language. */
const TEXT = {
  helpOwner: [
    '🤖 *עוזר AI לבעלי מתחמים*',
    'שאלו כל דבר על הצימרים, ההזמנות, הביקורות והשאלות של האורחים.',
    '',
    '• *מצב עריכה* — לאפשר לעוזר לבצע פעולות (יצירת הזמנה, עדכון צימר) ל-30 דקות',
    '• *מצב מידע* — חזרה לשאלות בלבד',
    '• *חדש* — שיחה חדשה',
    '• *עצור* — הפסקת הודעות',
  ].join('\n'),
  reset: '🔄 התחלנו שיחה חדשה. איך אפשר לעזור?',
  editOn: `✏️ מצב עריכה פעיל ל-${EDIT_MODE_MINUTES} דקות — העוזר יכול לבצע פעולות בחשבון שלך. כתבו *מצב מידע* כדי לחזור.`,
  editOff: 'ℹ️ חזרנו למצב מידע — העוזר עונה על שאלות בלבד.',
  editNotAllowed: 'מצב עריכה זמין רק לבעלי מתחמים מחוברים.',
  stop: '🔕 הפסקנו. לא נשלח הודעות נוספות. כתבו *הפעל* כדי לחזור.',
  start: '🔔 חזרנו! כתבו *עזרה* לרשימת אפשרויות.',
  ambiguous: 'המספר הזה משויך ליותר מחשבון אחד במערכת, ולכן אי אפשר לזהות אותך כאן. פנו לתמיכה או השתמשו באפליקציה.',
  ownersOnly:
    'הבוט בוואטסאפ זמין כרגע רק לבעלי מתחמים. עדכנו את מספר הטלפון בפרופיל בעל המתחם באפליקציה, ואז כתבו שוב מכאן.',
  error: '⚠️ משהו השתבש אצלנו. נסו שוב בעוד רגע.',
  editModeHint: '\n\n_כדי שאבצע את הפעולה כתבו *מצב עריכה*._',
};

/**
 * @param {AgentPorts} ports
 */
export function createAgent(ports) {
  const { brain, sessions, identities } = ports;
  const renderEffects = ports.renderEffects || (async () => ({ lines: [], quickOptions: [] }));
  const now = ports.now || (() => new Date());

  /**
   * @param {{ channel: string, address: string, text: string, displayName?: string }} input
   * @returns {Promise<{ reply: string | null, session: AgentSession, identity: AgentIdentity, command: string | null }>}
   */
  async function handleMessage({ channel, address, text, displayName = '' }) {
    const identity = await identities.resolve(channel, address);
    const existing = await sessions.get(channel, address);
    /** @type {AgentSession} */
    let session = existing || {
      channel,
      address,
      mode: 'info',
      recent_turns: [],
      quick_options: [],
      opted_out: false,
      pending_action_id: '',
    };

    // A number can change owner (phone re-assigned / account changed) — never leak context.
    const userId = identity.kind === 'user' ? identity.actor?.id || '' : '';
    if ((session.user_id || '') !== userId) {
      session = {
        ...session,
        user_id: userId,
        conversation_id: '',
        recent_turns: [],
        quick_options: [],
        mode: 'info',
        pending_action_id: '',
      };
    }
    session.role = identity.kind === 'user' ? identity.actor?.role || '' : '';
    session.display_name = identity.name || displayName || session.display_name || '';
    session.last_inbound_at = now().toISOString();

    const isOwner = identity.kind === 'user' && OWNER_ROLES.has(identity.actor?.role || '');
    const command = parseCommand(text);

    if (identity.kind === 'ambiguous') {
      return finish(TEXT.ambiguous, null);
    }

    if (session.opted_out && command !== 'start') {
      // Stay silent until the user opts back in.
      return { reply: null, session: await sessions.save(session), identity, command };
    }

    // v1: WhatsApp bot is owners/admins only.
    if (!isOwner) {
      if (command === 'stop') {
        session.opted_out = true;
        return finish(TEXT.stop, command);
      }
      if (command === 'start') {
        session.opted_out = false;
        return finish(TEXT.ownersOnly, command);
      }
      return finish(TEXT.ownersOnly, command === 'help' ? command : null);
    }

    if (command) {
      switch (command) {
        case 'help':
          return finish(TEXT.helpOwner, command);
        case 'reset':
          session.recent_turns = [];
          session.quick_options = [];
          session.conversation_id = '';
          session.pending_action_id = '';
          return finish(TEXT.reset, command);
        case 'edit_on':
          session.mode = 'edit';
          session.mode_expires_at = new Date(now().getTime() + EDIT_MODE_MINUTES * 60000).toISOString();
          return finish(TEXT.editOn, command);
        case 'edit_off':
          session.mode = 'info';
          session.mode_expires_at = '';
          return finish(TEXT.editOff, command);
        case 'stop':
          session.opted_out = true;
          return finish(TEXT.stop, command);
        case 'start':
          session.opted_out = false;
          return finish(TEXT.start, command);
        case 'whoami':
          return finish(describeIdentity(identity), command);
        default:
          break;
      }
    }

    if (session.mode === 'edit' && session.mode_expires_at && new Date(session.mode_expires_at) <= now()) {
      session.mode = 'info';
      session.mode_expires_at = '';
    }

    let message = resolveQuickOption(text, session.quick_options || []) || String(text || '').trim();
    if (!message) return finish(TEXT.helpOwner, 'help');

    /** @type {object} */
    const clientState = {
      mode: session.mode === 'edit' ? 'edit' : 'info',
      recentTurns: (session.recent_turns || []).slice(-MAX_TURNS.owner),
      surface: 'home',
    };

    // Confirm / cancel a pending owner action (same path as the web confirmActionId flow).
    const pendingId = session.pending_action_id || '';
    if (pendingId) {
      const decision = resolveActionDecision(message);
      if (decision === 'confirm') {
        clientState.confirmActionId = pendingId;
        message = 'אישור פעולה';
        session.pending_action_id = '';
        session.quick_options = [];
      } else if (decision === 'cancel') {
        clientState.cancelActionId = pendingId;
        message = 'ביטול פעולה';
        session.pending_action_id = '';
        session.quick_options = [];
      }
    }

    const profile = 'owner_assistant';
    session.profile = profile;
    const turnCap = MAX_TURNS.owner;
    const recentTurns = (session.recent_turns || []).slice(-turnCap);
    if (!clientState.confirmActionId && !clientState.cancelActionId) {
      clientState.recentTurns = recentTurns;
    }

    /** @type {BrainResult} */
    let result;
    try {
      result = await brain.chat(
        {
          profile,
          message,
          conversationId: session.conversation_id || null,
          clientState,
        },
        identity,
      );
    } catch (e) {
      console.error('[agent] brain failed:', e instanceof Error ? e.message : e);
      // A stale conversation id must not lock the user out.
      if (e?.status === 404) session.conversation_id = '';
      return finish(TEXT.error, null);
    }

    const content = String(result?.message?.content || '').trim();
    const effects = Array.isArray(result?.uiEffects) ? result.uiEffects : [];
    const rendered = await renderEffects(effects, { identity, session }).catch((e) => {
      console.warn('[agent] effect render failed:', e instanceof Error ? e.message : e);
      return { lines: [], quickOptions: [] };
    });

    let quickOptions = rendered.quickOptions || [];
    const confirmFx = effects.find((e) => e?.type === 'confirm_action' && e.actionId);
    if (confirmFx) {
      session.pending_action_id = String(confirmFx.actionId);
      quickOptions = [
        { label: 'אישור ✅', text: CONFIRM_TOKEN },
        { label: 'ביטול ❌', text: CANCEL_TOKEN },
        ...quickOptions.filter((o) => o.text !== CONFIRM_TOKEN && o.text !== CANCEL_TOKEN),
      ];
    }

    let reply = [content, ...rendered.lines].filter(Boolean).join('\n\n');
    if (effects.some((e) => e?.type === 'edit_mode_required')) reply += TEXT.editModeHint;
    if (quickOptions.length) {
      reply += `\n\n${quickOptions.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}`;
    }

    session.conversation_id = result?.conversationId || session.conversation_id || '';
    session.quick_options = quickOptions;
    if (!clientState.confirmActionId && !clientState.cancelActionId) {
      session.recent_turns = [
        ...recentTurns,
        { role: 'user', content: message.slice(0, MAX_TURN_CHARS) },
        { role: 'bot', content: content.slice(0, MAX_TURN_CHARS) },
      ].slice(-turnCap);
    }

    return finish(reply || TEXT.error, null);

    async function finish(reply, cmd) {
      const saved = await sessions.save(session);
      return { reply, session: saved, identity, command: cmd };
    }
  }

  return { handleMessage };
}

/** @param {string} message */
function resolveActionDecision(message) {
  const n = String(message || '')
    .trim()
    .toLowerCase();
  if (n === CONFIRM_TOKEN || n === 'כן' || n === 'אישור' || n === 'confirm' || n === 'yes') return 'confirm';
  if (n === CANCEL_TOKEN || n === 'לא' || n === 'ביטול' || n === 'cancel' || n === 'no') return 'cancel';
  return null;
}

/** @param {AgentIdentity} identity */
function describeIdentity(identity) {
  if (identity.kind !== 'user') {
    return 'את/ה מחובר/ת כאורח/ת (המספר לא משויך לחשבון). כדי לקבל עזרה אישית — עדכנו את מספר הטלפון בפרופיל באפליקציה.';
  }
  const roleLabel =
    { owner: 'בעל/ת מתחם', admin: 'מנהל/ת מערכת', user: 'לקוח/ה' }[identity.actor?.role || ''] ||
    identity.actor?.role;
  return `את/ה מזוהה כ-*${identity.name || identity.user?.email || ''}* (${roleLabel}).`;
}

export const AGENT_CONFIRM_TOKEN = CONFIRM_TOKEN;
export const AGENT_CANCEL_TOKEN = CANCEL_TOKEN;
