/**
 * Own-backend assistant API — Phase 4.
 */
import { ownFetch } from './http.js';

export const ownAssistant = {
  /**
   * @param {{ profile: string, message: string, conversationId?: string|null, clientState?: object|null }} payload
   */
  async chat(payload) {
    return ownFetch('/api/assistant/chat', {
      method: 'POST',
      body: payload || {},
      auth: true,
    });
  },
};
