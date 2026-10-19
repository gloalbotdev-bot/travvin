import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import { buildOwnerRecentTurns, applyOwnerAssistantResponse } from '@/lib/assistantOwner';
import { decideOwnerAction, findConfirmAction, ownerActionErrorText } from '@/lib/ownerActions';

const VISIT_STARTED_KEY = 'owner_panel_visit_started_at';

/** Marks (or returns) the start of this browser-tab visit. Cleared when the tab closes. */
export function ensureOwnerPanelVisitStart() {
  try {
    let started = sessionStorage.getItem(VISIT_STARTED_KEY);
    if (!started) {
      started = new Date().toISOString();
      sessionStorage.setItem(VISIT_STARTED_KEY, started);
    }
    return started;
  } catch {
    return new Date().toISOString();
  }
}

function isFromCurrentVisit(isoTime, visitStartedAt) {
  if (!visitStartedAt) return true;
  const t = Date.parse(isoTime);
  const start = Date.parse(visitStartedAt);
  if (Number.isNaN(t) || Number.isNaN(start)) return false;
  return t >= start;
}

const formatTime = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  return (Number.isNaN(d.getTime()) ? new Date() : d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

export function composerPlaceholder(chatStarted) {
  return chatStarted
    ? 'כתבי שאלה או בקשה — לפני כל שינוי אבקש את אישורך'
    : 'איך אפשר לעזור היום? שאלי אותי משהו או תני לי משימה';
}

let localSeq = 0;
const localId = () => `local-${Date.now()}-${++localSeq}`;

/** Dedupe concurrent OwnerAssistantThread.filter calls across mounted bubbles. */
const inflightThreadLoads = new Map();

function fetchOwnerThreadMessages(ownerId) {
  const key = String(ownerId);
  const existing = inflightThreadLoads.get(key);
  if (existing) return existing;
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const promise = api.entities.OwnerAssistantThread.filter({ owner_id: ownerId }, '-created_date', 1)
    .then((rows) => {
      const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[ownerAssistantThread] loadThread', { ownerId: key, ms: Math.round(ms) });
      }
      return Array.isArray(rows?.[0]?.messages) ? rows[0].messages : [];
    })
    .finally(() => {
      inflightThreadLoads.delete(key);
    });
  inflightThreadLoads.set(key, promise);
  return promise;
}

function fromThreadMessage(m) {
  return {
    id: m.id,
    role: m.role === 'user' ? 'user' : 'bot',
    type: 'text',
    content: m.content || '',
    time: formatTime(m.time),
    surface: m.surface,
    zimmerId: m.zimmer_id || null,
    actions: Array.isArray(m.ui?.actions) ? m.ui.actions : [],
    openForm: m.ui?.open_form || null,
    pendingAction: m.pending_action || null,
  };
}

/** pending_action.status → ConfirmActionCard status */
export function confirmCardStatus(pendingAction, busyActionId) {
  if (!pendingAction) return null;
  if (busyActionId === pendingAction.id || pendingAction.status === 'executing') return 'busy';
  if (pendingAction.status === 'done') return 'done';
  if (pendingAction.status === 'cancelled') return 'cancelled';
  if (pendingAction.status === 'expired') return 'expired';
  if (pendingAction.expiresAt && Date.parse(pendingAction.expiresAt) < Date.now()) return 'expired';
  return 'pending';
}

/**
 * One owner assistant memory for every bubble: the server keeps a single thread per owner,
 * each bubble shows only its own `surface` (and zimmer, when `filterZimmer`).
 * Owners persist through the server thread; admin sessions (`persist: false`) keep a local list.
 */
export default function useOwnerAssistantThread({
  ownerId,
  surface = 'home',
  focus = null,
  persist = true,
  filterZimmer = false,
  onMutated,
  onOpenForm,
  initialPrompt,
  initialAttachments,
  onPromptConsumed,
}) {
  const [serverMessages, setServerMessages] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [busyActionId, setBusyActionId] = useState(null);
  const [ready, setReady] = useState(!persist);
  const [chatStarted, setChatStarted] = useState(false);
  const sendingRef = useRef(false);
  const sentInitialRef = useRef(false);
  const dismissedRef = useRef(false);
  const attachmentsByText = useRef(new Map());
  const focusRef = useRef(focus);
  const callbacksRef = useRef({ onMutated, onOpenForm });
  const subscribeTimerRef = useRef(null);

  useEffect(() => { focusRef.current = focus; }, [focus]);
  useEffect(() => { callbacksRef.current = { onMutated, onOpenForm }; }, [onMutated, onOpenForm]);

  const zimmerFilter = filterZimmer ? focus?.zimmerId || null : null;

  const applyThreadRows = useCallback((all) => {
    const visitStartedAt = ensureOwnerPanelVisitStart();
    const mine = all
      .filter((m) => (m.surface || 'home') === surface)
      .filter((m) => !zimmerFilter || m.zimmer_id === zimmerFilter)
      .filter((m) => isFromCurrentVisit(m.time, visitStartedAt))
      .map(fromThreadMessage)
      .map((m) => {
        const att = m.role === 'user' ? attachmentsByText.current.get(m.content) : null;
        return att ? { ...m, attachments: att } : m;
      });
    setServerMessages(mine);
    if (mine.length > 0 && !dismissedRef.current) setChatStarted(true);
  }, [surface, zimmerFilter]);

  const loadThread = useCallback(async () => {
    if (!persist || !ownerId) return;
    try {
      const all = await fetchOwnerThreadMessages(ownerId);
      applyThreadRows(all);
    } catch {
      /* keep what we have — the next send/subscription reloads */
    } finally {
      setReady(true);
    }
  }, [persist, ownerId, applyThreadRows]);

  useEffect(() => {
    setServerMessages([]);
    setLocalMessages([]);
    setChatStarted(false);
    dismissedRef.current = false;
    setReady(!persist);
    loadThread();
  }, [loadThread, persist]);

  useEffect(() => {
    if (!persist || !ownerId) return undefined;
    const unsub = api.entities.OwnerAssistantThread.subscribe((ev) => {
      if (sendingRef.current) return;
      if (ev?.data?.owner_id && ev.data.owner_id !== ownerId) return;
      if (subscribeTimerRef.current) clearTimeout(subscribeTimerRef.current);
      subscribeTimerRef.current = setTimeout(() => {
        subscribeTimerRef.current = null;
        loadThread();
      }, 120);
    });
    return () => {
      unsub();
      if (subscribeTimerRef.current) clearTimeout(subscribeTimerRef.current);
    };
  }, [persist, ownerId, loadThread]);

  const addLocal = (role, content, extra = {}) => {
    const msg = { id: localId(), role, type: 'text', content, time: formatTime(), surface, actions: [], ...extra };
    setLocalMessages((prev) => [...prev, msg]);
    return msg;
  };

  const messages = [...serverMessages, ...localMessages];
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const applyPersistTurnLocally = (optimistic, response) => {
    const confirm = findConfirmAction(response);
    const openFormEffect = (response?.uiEffects || []).find((e) => e?.type === 'open_form') || null;
    const userMsg = {
      id: optimistic.id,
      role: 'user',
      type: 'text',
      content: optimistic.content,
      time: optimistic.time,
      surface,
      zimmerId: filterZimmer ? focusRef.current?.zimmerId || null : null,
      actions: [],
      attachments: optimistic.attachments,
    };
    const botMsg = {
      id: localId(),
      role: 'bot',
      type: 'text',
      content: response?.message?.content || '…',
      time: formatTime(response?.message?.time),
      surface,
      zimmerId: userMsg.zimmerId,
      actions: [],
      openForm: openFormEffect?.form || null,
      pendingAction: confirm
        ? {
            id: confirm.actionId,
            summary: confirm.summary,
            details: confirm.details,
            opType: confirm.opType || null,
            status: 'pending',
          }
        : null,
    };
    setServerMessages((prev) => [...prev, userMsg, botMsg]);
    setLocalMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    return openFormEffect;
  };

  const send = async (rawText, attachments = []) => {
    const text = (rawText ?? '').trim();
    if (!text || !ownerId || sendingRef.current) return;
    sendingRef.current = true;
    dismissedRef.current = false;
    setChatStarted(true);
    if (attachments.length) attachmentsByText.current.set(text, attachments);
    const optimistic = addLocal('user', text, attachments.length ? { attachments } : {});
    setIsTyping(true);
    try {
      const history = messagesRef.current;
      const currentFocus = focusRef.current;
      const response = await api.assistant.chat({
        profile: 'owner_assistant',
        message: text,
        clientState: {
          ownerId,
          surface,
          ...(currentFocus ? { focus: currentFocus } : {}),
          ...(persist ? {} : { recentTurns: buildOwnerRecentTurns(history) }),
        },
        ...(attachments.length ? { attachments: attachments.map((a) => a.url) } : {}),
      });

      if (response?.meta?.timing && typeof console !== 'undefined' && console.debug) {
        console.debug('[ownerAssistantThread] chat timing', response.meta.timing);
      }

      if (persist) {
        const openFormEffect = applyPersistTurnLocally(optimistic, response);
        if (openFormEffect) callbacksRef.current.onOpenForm?.(openFormEffect);
        // Background sync for server ids / other surfaces; UI already updated.
        void loadThread();
      } else {
        const confirm = findConfirmAction(response);
        const openFormEffect = (response?.uiEffects || []).find((e) => e?.type === 'open_form') || null;
        applyOwnerAssistantResponse({
          response,
          actions: {
            onBotText: (content, actionKeys) => {
              addLocal('bot', content || '…', {
                actions: actionKeys || [],
                openForm: openFormEffect?.form || null,
                pendingAction: confirm
                  ? { id: confirm.actionId, summary: confirm.summary, details: confirm.details, status: 'pending' }
                  : null,
              });
            },
          },
        });
        if (openFormEffect) callbacksRef.current.onOpenForm?.(openFormEffect);
      }
      return response;
    } catch (e) {
      addLocal('bot', `מצטער, אירעה שגיאה. ${ownerActionErrorText(e)}`);
      return null;
    } finally {
      setIsTyping(false);
      sendingRef.current = false;
    }
  };

  const decide = async (actionId, confirm, editedFields) => {
    if (!actionId || busyActionId) return null;
    setBusyActionId(actionId);
    try {
      const res = await decideOwnerAction({ actionId, confirm, editedFields, surface, ownerId });
      for (const exec of res?.executedActions || []) {
        if (exec?.kind) callbacksRef.current.onMutated?.(exec);
      }
      if (persist) {
        const status = confirm ? 'done' : 'cancelled';
        setServerMessages((prev) =>
          prev.map((m) =>
            m.pendingAction?.id === actionId
              ? { ...m, pendingAction: { ...m.pendingAction, status } }
              : m,
          ),
        );
        if (res?.message?.content) {
          setServerMessages((prev) => [
            ...prev,
            {
              id: localId(),
              role: 'bot',
              type: 'text',
              content: res.message.content,
              time: formatTime(res.message.time),
              surface,
              actions: [],
            },
          ]);
        }
        void loadThread();
      } else {
        const status = confirm ? 'done' : 'cancelled';
        setLocalMessages((prev) =>
          prev.map((m) => (m.pendingAction?.id === actionId ? { ...m, pendingAction: { ...m.pendingAction, status } } : m)),
        );
        if (res?.message?.content) addLocal('bot', res.message.content);
      }
      return res;
    } catch (e) {
      if (persist) void loadThread();
      const serverLogged = persist && !(e?.status === 404 || e?.status === 409 || e?.status === 410);
      if (!serverLogged) addLocal('bot', `⚠️ ${ownerActionErrorText(e)}`);
      if (!persist && (e?.status === 404 || e?.status === 409 || e?.status === 410)) {
        setLocalMessages((prev) =>
          prev.map((m) => (m.pendingAction?.id === actionId ? { ...m, pendingAction: { ...m.pendingAction, status: 'expired' } } : m)),
        );
      }
      return null;
    } finally {
      setBusyActionId(null);
    }
  };

  useEffect(() => {
    if (!ready || !initialPrompt?.trim() || sentInitialRef.current) return;
    sentInitialRef.current = true;
    send(initialPrompt.trim(), initialAttachments || []);
    onPromptConsumed?.();
  }, [ready, initialPrompt]);

  useEffect(() => {
    if (!initialPrompt?.trim()) sentInitialRef.current = false;
  }, [initialPrompt]);

  return {
    messages,
    isTyping,
    ready,
    chatStarted,
    open: () => { dismissedRef.current = false; setChatStarted(true); },
    reset: () => {
      if (sendingRef.current) return;
      dismissedRef.current = true;
      setChatStarted(false);
    },
    send,
    confirm: (actionId, editedFields) => decide(actionId, true, editedFields),
    cancel: (actionId) => decide(actionId, false),
    busyActionId,
    reload: loadThread,
  };
}
