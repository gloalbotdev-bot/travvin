/**
 * Service-role actor for internal functions (faithful asServiceRole restore).
 * Used by hooks / delayed jobs — not via public HTTP (M15 #4 #22 #24).
 */
export const SERVICE_ACTOR = {
  id: '__service__',
  email: 'service@internal',
  role: 'admin',
};
