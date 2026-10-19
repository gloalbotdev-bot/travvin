/**
 * Creator assistant UI helpers — Phase 8.
 */

/** Server caps owner clientState at 64KB; leave room for collected data. */
const TURNS_CHAR_BUDGET = 40000;

export function buildCreatorRecentTurns(messages, limit = 100) {
  if (!Array.isArray(messages)) return [];
  const turns = messages
    .filter((m) => {
      if (m.type && m.type !== 'text') return false;
      return typeof m.content === 'string' && m.content.trim();
    })
    .slice(-limit)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'bot',
      content: m.content.slice(0, 4000),
    }));
  let total = 0;
  let start = turns.length;
  while (start > 0 && total + turns[start - 1].content.length <= TURNS_CHAR_BUDGET) {
    start -= 1;
    total += turns[start].content.length;
  }
  return turns.slice(start);
}

export function getAssistantParsed(response) {
  return response?.meta?.parsed || {};
}
