import useOwnerAssistantThread, { composerPlaceholder } from '@/hooks/useOwnerAssistantThread';

export { composerPlaceholder };

/** Owner assistant on the home surface (Today + AI assistant share it). Kept for existing imports. */
export default function useOwnerAssistantChat({ ownerId, onMutated, onOpenForm, initialPrompt, initialAttachments, onPromptConsumed }) {
  return useOwnerAssistantThread({
    ownerId,
    surface: 'home',
    onMutated,
    onOpenForm,
    initialPrompt,
    initialAttachments,
    onPromptConsumed,
  });
}
