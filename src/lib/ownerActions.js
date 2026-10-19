/**
 * Owner assistant actions — every write is proposed by the server (confirm_action uiEffect)
 * and executed only after the owner confirms it here.
 */
import { api } from '@/api/client';

export function findConfirmAction(response) {
  return (response?.uiEffects || []).find((e) => e?.type === 'confirm_action') || null;
}

/**
 * @param {{ profile?: string, actionId: string, confirm: boolean, editedFields?: object, surface?: string, ownerId?: string }} p
 */
export function decideOwnerAction({ profile = 'owner_assistant', actionId, confirm, editedFields, surface, ownerId }) {
  const clientState = { [confirm ? 'confirmActionId' : 'cancelActionId']: actionId };
  if (editedFields) clientState.editedFields = editedFields;
  if (surface) clientState.surface = surface;
  if (ownerId) clientState.ownerId = ownerId;
  return api.assistant.chat({ profile, message: confirm ? 'אישור' : 'ביטול', clientState });
}

export function ownerActionErrorText(err) {
  return err?.data?.message || err?.data?.error || err?.message || '⚠️ לא הצלחתי לבצע את הפעולה.';
}
