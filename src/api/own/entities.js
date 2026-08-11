/**
 * Own-backend entities client — same method shapes as Base44 SDK entities.
 */
import { ownFetch } from './http.js';
import { createSubscribe } from './realtime.js';

const ENTITY_NAMES = [
  'AdminPermission',
  'BookingRequest',
  'ChatSession',
  'Contact',
  'CustomerProfile',
  'DirectChat',
  'OwnerRequest',
  'Promotion',
  'Review',
  'SyncState',
  'SystemMessage',
  'UnansweredQuestion',
  'User',
  'Zimmer',
];

function createEntityApi(name) {
  const api = {
    list(sort, limit) {
      const qs = new URLSearchParams();
      if (sort) qs.set('sort', sort);
      if (limit != null) qs.set('limit', String(limit));
      const q = qs.toString();
      return ownFetch(`/api/entities/${name}${q ? `?${q}` : ''}`);
    },

    filter(query, sort, limit) {
      return ownFetch(`/api/entities/${name}/filter`, {
        method: 'POST',
        body: { query: query || {}, sort, limit },
      });
    },

    get(id) {
      return ownFetch(`/api/entities/${name}/${id}`);
    },

    create(data) {
      return ownFetch(`/api/entities/${name}`, { method: 'POST', body: data || {} });
    },

    update(id, data) {
      return ownFetch(`/api/entities/${name}/${id}`, { method: 'PATCH', body: data || {} });
    },

    delete(id) {
      return ownFetch(`/api/entities/${name}/${id}`, { method: 'DELETE' });
    },
  };

  api.subscribe = createSubscribe(name, api.list.bind(api));
  return api;
}

export const ownEntities = Object.fromEntries(
  ENTITY_NAMES.map((name) => [name, createEntityApi(name)]),
);
