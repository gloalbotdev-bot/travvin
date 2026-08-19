/**
 * Own-backend functions client — invoke() shape matches Base44 SDK.
 * pushInAppNotification / finalizeReviewAutoPublish are server-internal only (M15).
 */
import { ownFetch } from './http.js';

/** @type {Record<string, { path: string, auth?: boolean }>} */
const OWN_FUNCTIONS = {
  geocodeAddresses: { path: '/api/functions/geocodeAddresses', auth: true },
  addBookingToCalendar: { path: '/api/functions/addBookingToCalendar', auth: true },
  executeOwnerAssistantOp: { path: '/api/functions/executeOwnerAssistantOp', auth: true },
  syncGoogleCalendar: { path: '/api/functions/syncGoogleCalendar', auth: true },
  performCheckout: { path: '/api/functions/performCheckout', auth: true },
  sendGuestMessage: { path: '/api/functions/sendGuestMessage', auth: true },
  sendSupplierMessage: { path: '/api/functions/sendSupplierMessage', auth: true },
  generateAIRecommendations: { path: '/api/functions/generateAIRecommendations', auth: true },
};

export const ownFunctions = {
  async invoke(name, payload) {
    const spec = OWN_FUNCTIONS[name];
    if (!spec) {
      const err = new Error(`Unknown function: ${name}`);
      err.status = 404;
      throw err;
    }
    const data = await ownFetch(spec.path, {
      method: 'POST',
      body: payload || {},
      auth: spec.auth !== false,
    });
    return { data };
  },
};

/** @deprecated use ownFunctions */
export function createOwnFunctions() {
  return ownFunctions;
}
