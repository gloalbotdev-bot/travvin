import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Send, Bot, X, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ConfirmActionCard from '@/components/owner/ConfirmActionCard';
import { buildCreatorRecentTurns } from '@/lib/assistantCreator';
import { decideOwnerAction, findConfirmAction, ownerActionErrorText } from '@/lib/ownerActions';

const fmtTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

/**
 * Compact inline AI assistant scoped to a single zimmer (no agents API).
 * Owner sessions: changes run on the server only after confirm_action is confirmed.
 */
export default function ZimmerInlineChat({ zimmer, initialPrompt, onClose, onApplied }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [applyingId, setApplyingId] = useState(null);
  const sentRef = useRef(false);
  const endRef = useRef(null);

  const addMsg = (role, content, extra = {}) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, content, time: fmtTime(), ...extra }]);
  };

  const setMsg = (id, patch) => setMessages(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));

  const applyChanges = async (msg) => {
    if (!msg.changes || applyingId) return;
    setApplyingId(msg.id);
    try {
      let updated;
      if (msg.confirmAction) {
        const res = await decideOwnerAction({ profile: 'admin_zimmer_editor', actionId: msg.confirmAction.actionId, confirm: true });
        updated = res?.executedActions?.[0]?.zimmer;
      } else {
        // Admin sessions have no owner thread — legacy direct save.
        updated = await api.entities.Zimmer.update(zimmer.id, msg.changes);
      }
      setMsg(msg.id, { applied: true });
      onApplied?.(updated || { ...zimmer, ...msg.changes });
    } catch (err) {
      addMsg('assistant', msg.confirmAction ? ownerActionErrorText(err) : 'לא הצלחתי לשמור את השינויים. נסה שוב.');
    } finally {
      setApplyingId(null);
    }
  };

  const dismissChanges = (msg) => {
    if (msg.confirmAction) {
      decideOwnerAction({ profile: 'admin_zimmer_editor', actionId: msg.confirmAction.actionId, confirm: false }).catch(() => {});
    }
    setMsg(msg.id, { dismissed: true });
  };

  const doSend = async (text) => {
    const t = text.trim();
    if (!t || sending) return;
    setInput('');
    setSending(true);
    addMsg('user', t);
    try {
      const response = await api.assistant.chat({
        profile: 'admin_zimmer_editor',
        message: t,
        conversationId,
        clientState: {
          zimmerId: zimmer.id,
          recentTurns: buildCreatorRecentTurns(messages),
        },
      });
      if (response?.conversationId) setConversationId(response.conversationId);
      const content = response?.message?.content || response?.message || 'לא התקבלה תשובה.';
      const preview = (response?.uiEffects || []).find(e => e?.type === 'zimmer_changes_preview');
      addMsg('assistant', typeof content === 'string' ? content : JSON.stringify(content), {
        changes: preview?.changes || null,
        confirmAction: findConfirmAction(response),
      });
    } catch {
      addMsg('assistant', 'מצטער, אירעה שגיאה. נסה שוב.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (initialPrompt && !sentRef.current) {
      sentRef.current = true;
      doSend(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #E5E7EB' }} dir="rtl">
      <div className="flex items-center justify-between px-3 py-2" style={{ background: '#1E293B' }}>
        <div className="flex items-center gap-2 text-white min-w-0">
          <Sparkles size={14} style={{ color: '#A855F7', flexShrink: 0 }} />
          <span className="text-xs font-bold truncate">עוזר AI · {zimmer.name}</span>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white flex-shrink-0"><X size={14} /></button>
      </div>

      <div className="px-3 py-3 space-y-2 overflow-y-auto" style={{ maxHeight: 280, background: '#F9FAFB' }}>
        {messages.length === 0 && !sending && (
          <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>שאל אותי משהו על הצימר...</p>
        )}
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const content = m.content || '';
          return (
            <div key={m.id} className={`flex items-end gap-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              {!isUser && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: '#F97316' }}>
                  <Bot size={12} />
                </div>
              )}
              <div className="max-w-[85%] min-w-0">
                <div className="px-3 py-2 rounded-2xl text-xs leading-relaxed"
                  style={isUser
                    ? { background: '#1E293B', color: '#fff', borderBottomLeftRadius: '4px' }
                    : { background: '#fff', color: '#1A1A1A', border: '1px solid #F0EEE8', borderBottomRightRadius: '4px' }}>
                  {isUser
                    ? <p className="whitespace-pre-wrap">{content}</p>
                    : <div className="prose prose-sm max-w-none"><ReactMarkdown>{content}</ReactMarkdown></div>}
                </div>
                {!isUser && m.changes && m.confirmAction && (
                  <div className="mt-1">
                    <ConfirmActionCard
                      compact
                      action={m.confirmAction}
                      status={m.applied ? 'done' : m.dismissed ? 'cancelled' : applyingId === m.id ? 'busy' : 'pending'}
                      onConfirm={() => applyChanges(m)}
                      onCancel={() => dismissChanges(m)}
                      confirmLabel="החל על הצימר"
                    />
                  </div>
                )}
                {!isUser && m.changes && !m.confirmAction && (
                  <button type="button" onClick={() => applyChanges(m)} disabled={m.applied || !!applyingId}
                    className="mt-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-60"
                    style={m.applied ? { background: '#ECFDF5', color: '#047857' } : { background: '#0B3838', color: '#fff' }}>
                    {m.applied ? '✓ השינויים נשמרו' : applyingId === m.id ? 'שומר...' : 'החל שינויים על הצימר'}
                  </button>
                )}
                <div className="text-[10px] mt-0.5 px-1" style={{ color: '#9CA3AF' }}>{m.time}</div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex items-end gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: '#F97316' }}><Bot size={12} /></div>
            <div className="px-3 py-2 rounded-2xl" style={{ background: '#fff', border: '1px solid #F0EEE8' }}>
              <div className="flex gap-1 items-center h-3">
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-1.5 p-2" style={{ background: '#fff', borderTop: '1px solid #F0EEE8' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') doSend(input); }}
          placeholder="כתוב פקודה לצימר..."
          className="flex-1 bg-transparent outline-none text-xs" style={{ color: '#1A1A1A' }} />
        <button onClick={() => doSend(input)} disabled={!input.trim() || sending}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white disabled:opacity-40" style={{ background: '#F97316' }}>
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );
}
