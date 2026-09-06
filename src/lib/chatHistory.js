// Shared constants and helpers for the multi-conversation chat history feature.
// Used by both the owner AI assistant (OwnerAgentChat) and the customer search
// chat (CustomerChat), which share the same split-at-50 + history-list model.

// Messages at which the "move to a new chat" banner appears. Soft limit only —
// the banner suggests, it does not block sending.
export const MESSAGE_LIMIT = 50;

// Page size for the history overlay initial load and each "load more".
export const HISTORY_PAGE_SIZE = 10;

// Deploy cutoff date (YYYY-MM-DD). Conversations created before this date are
// archived+locked once on first entry after deploy, so everyone starts from a
// fresh chat. Idempotent and device-independent (derived from record data, not
// a per-user flag).
export const CHAT_HISTORY_DEPLOY_DATE = '2026-09-01';

export const isArchivable = (record) => {
  if (!record || !record.created_date) return false;
  if (record.locked) return false;
  try {
    return new Date(record.created_date) < new Date(CHAT_HISTORY_DEPLOY_DATE + 'T00:00:00');
  } catch {
    return false;
  }
};

// Format a conversation's date for the history list row.
export const fmtHistoryDate = (s) => {
  try {
    return new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return '';
  }
};

// Count "real" messages for the 50-message limit (user + assistant with content).
export const countRealMessages = (messages) =>
  Array.isArray(messages)
    ? messages.filter((m) => m && m.content && (m.role === 'user' || m.role === 'assistant')).length
    : 0;