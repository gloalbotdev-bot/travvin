/**
 * Owner assistant UI — apply server uiEffects + executedActions (Phase 6).
 */

const ACTION_LINKS = {
  bookings: { label: '📋 עבור להזמנות', tab: 'bookings' },
  calendar: { label: '📅 פתח יומן', tab: 'calendar' },
  questions: { label: '❓ שאלות לקוחות', tab: 'questions' },
  reviews: { label: '⭐ ביקורות', tab: 'reviews' },
};

export function buildOwnerRecentTurns(messages, limit = 8) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m.type === 'text' && typeof m.content === 'string')
    .slice(-limit)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'bot',
      content: m.content,
    }));
}

/**
 * @param {object} params
 * @param {object} params.response
 * @param {object} params.actions
 */
export function applyOwnerAssistantResponse({ response, actions }) {
  const { message, uiEffects = [], executedActions = [], meta = {} } = response || {};

  if (executedActions.length > 0) {
    for (const exec of executedActions) {
      if (exec.message && actions.onExecutedMessage) {
        actions.onExecutedMessage(exec.message, exec);
      }
      if (exec.kind && actions.onMutated) {
        actions.onMutated(exec);
      }
    }
    return meta;
  }

  const actionsFromEffects = [];
  for (const effect of uiEffects) {
    if (effect.type === 'owner_action_links' && Array.isArray(effect.actions)) {
      actionsFromEffects.push(...effect.actions);
    }
    if (effect.type === 'edit_mode_required' && actions.onEditModeRequired) {
      actions.onEditModeRequired();
    }
  }

  const content = message?.content || '';
  if (content && actions.onBotText) {
    actions.onBotText(content, actionsFromEffects);
  }

  return meta;
}

export function resolveOwnerActionLinks(actionKeys) {
  return (Array.isArray(actionKeys) ? actionKeys : [])
    .map((key) => ACTION_LINKS[key])
    .filter(Boolean);
}

export { ACTION_LINKS };
