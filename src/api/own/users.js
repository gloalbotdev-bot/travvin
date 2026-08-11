import { ownFetch } from './http.js';

export const ownUsers = {
  inviteUser(email, role) {
    return ownFetch('/api/users/invite', {
      method: 'POST',
      body: { email, role },
    });
  },
};
