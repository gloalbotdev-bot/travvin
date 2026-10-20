/**
 * Channel commands understood by the agent before anything reaches the AI (Hebrew + English).
 * Pure — no app imports.
 */

/** @typedef {'help' | 'reset' | 'edit_on' | 'edit_off' | 'stop' | 'start' | 'whoami'} AgentCommand */

/** @type {Record<AgentCommand, string[]>} */
const COMMANDS = {
  help: ['עזרה', 'תפריט', 'help', 'menu', '?'],
  reset: ['חדש', 'איפוס', 'שיחה חדשה', 'reset', 'new', 'restart'],
  edit_on: ['מצב עריכה', 'עריכה', 'edit', 'edit mode'],
  edit_off: ['מצב מידע', 'מידע', 'info', 'info mode'],
  stop: ['stop', 'הסר', 'הפסק', 'עצור'],
  start: ['start', 'הפעל', 'התחל'],
  whoami: ['מי אני', 'whoami'],
};

const LOOKUP = new Map(
  Object.entries(COMMANDS).flatMap(([cmd, words]) => words.map((w) => [normalize(w), cmd])),
);

function normalize(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/^[/!]+/, '')
    .replace(/[.!?\s]+$/, '')
    .replace(/\s+/g, ' ');
}

/**
 * @param {string} text
 * @returns {AgentCommand | null}
 */
export function parseCommand(text) {
  const n = normalize(text);
  if (!n) return null;
  if (n === '?' || String(text).trim() === '?') return 'help';
  return /** @type {AgentCommand | null} */ (LOOKUP.get(n) || null);
}

/**
 * "2" → second quick option, when the previous reply offered numbered options.
 * @param {string} text
 * @param {{ label: string, text: string }[]} options
 */
export function resolveQuickOption(text, options) {
  if (!Array.isArray(options) || options.length === 0) return null;
  const m = String(text || '').trim().match(/^(\d{1,2})$/);
  if (!m) return null;
  const opt = options[Number(m[1]) - 1];
  return opt?.text || null;
}
