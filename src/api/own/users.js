import { ownFetch } from './http.js';

export const ownUsers = {
  inviteUser(email, role, profile = {}) {
    return ownFetch('/api/users/invite', {
      method: 'POST',
      body: {
        email,
        role,
        full_name: profile.full_name,
        phone: profile.phone,
        business_name: profile.business_name,
      },
    });
  },
};
