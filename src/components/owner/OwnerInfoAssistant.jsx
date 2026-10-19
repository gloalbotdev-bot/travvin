import React, { useEffect } from 'react';
import useOwnerAssistantThread from '@/hooks/useOwnerAssistantThread';
import OwnerAssistantHome from '@/components/owner/OwnerAssistantHome';

export default function OwnerInfoAssistant({ ownerId, zimmers, onNavigate, onQuickAction, onMutated, onOpenForm, initialPrompt, initialAttachments, onPromptConsumed }) {
  const chat = useOwnerAssistantThread({ ownerId, surface: 'home', onMutated, onOpenForm, initialPrompt, initialAttachments, onPromptConsumed });

  // Figma frame 108 scrolls without a visible bar.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('owner-hide-scrollbar');
    return () => root.classList.remove('owner-hide-scrollbar');
  }, []);

  const waitingForInitial = !chat.chatStarted && !!initialPrompt?.trim();

  return (
    <div dir="rtl" className="relative h-full" style={{ background: '#FCFCFC' }}>
      <OwnerAssistantHome
        ownerId={ownerId}
        zimmers={zimmers || []}
        onQuickAction={onQuickAction || (() => {})}
        onNavigate={onNavigate}
        onOpenForm={onOpenForm}
        chat={chat}
        showThread={chat.chatStarted || waitingForInitial}
        waiting={waitingForInitial}
      />
    </div>
  );
}
