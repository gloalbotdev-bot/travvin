/**
 * Creator assistant UI helpers — Phase 8.
 */

export function buildCreatorRecentTurns(messages, limit = 12) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => {
      if (m.type && m.type !== 'text') return false;
      return typeof m.content === 'string' && m.content.trim();
    })
    .slice(-limit)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'bot',
      content: m.content,
    }));
}

export function getAssistantParsed(response) {
  return response?.meta?.parsed || {};
}
