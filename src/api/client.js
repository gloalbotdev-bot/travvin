/**
 * App API client — own backend (export name `api`).
 */
import { ownEntities } from './own/entities';
import { ownAuth } from './own/auth';
import { ownUsers } from './own/users';
import { ownFunctions } from './own/functions';
import { ownIntegrationsCore } from './own/integrations';
import { setStoredToken } from './own/http';

export const ownApiBase =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OWN_API_URL) ||
  'http://localhost:3001';

export const api = {
  entities: ownEntities,
  auth: ownAuth,
  users: ownUsers,
  integrations: {
    Core: {
      InvokeLLM: ownIntegrationsCore.InvokeLLM,
      UploadFile: ownIntegrationsCore.UploadFile,
    },
  },
  functions: ownFunctions,
  setToken(newToken) {
    setStoredToken(newToken);
  },
  getConfig: () => ({ apiBase: ownApiBase }),
  cleanup: () => {},
};
