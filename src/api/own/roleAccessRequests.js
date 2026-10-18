import { ownFetch } from './http.js';

export const ownRoleAccessRequests = {
  /** Create via OAuth mismatch token or authenticated session. */
  create({ request_token, to_role } = {}) {
    return ownFetch('/api/role-access-requests', {
      method: 'POST',
      body: {
        ...(request_token ? { request_token } : {}),
        ...(to_role ? { to_role } : {}),
      },
      auth: !request_token,
    });
  },

  list(status = 'pending') {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return ownFetch(`/api/role-access-requests${qs}`);
  },

  decide(id, decision) {
    return ownFetch(`/api/role-access-requests/${id}`, {
      method: 'PATCH',
      body: { decision },
    });
  },
};
