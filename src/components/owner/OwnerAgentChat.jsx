import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Bot, Sparkles, ShieldCheck, Eye, Pencil, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const AGENT_NAME = 'zimmer_manager';
const formatTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const MODE_PREFIX = {
  info: '[מצב: מידע]',
  edit: '[מצב: עריכה]'
};

const STATUS_META = {
  pending: { color: '#9CA3AF', label: 'ממתין' },
  running: { color: '#3B82F6', label: 'מבצע' },
  in_progress: { color: '#3B82F6', label: 'מבצע' },
  completed: { color: '#22C55E', label: 'בוצע' },
  success: { color: '#22C55E', label: 'בוצע' },
  failed: { color: '#EF4444', label: 'נכשל' },
  error: { color: '#EF4444', label: 'שגיאה' }
};

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status || 'pending';
  const meta = STATUS_META[status] || STATUS_META.pending;
  const isFailed = status === 'failed' || status === 'error';
  let results = toolCall.results;
  let parsedResults = results;
  if (typeof results === 'string') {
    try { parsedResults = JSON.parse(results); } catch { parsedResults = results; }
  }
  const failedResult = parsedResults && typeof parsedResults === 'object' && (parsedResults.success === false || /error|failed/i.test(String(results || '')));
  const showError = isFailed || failedResult;

  let args = toolCall.arguments_string;
  let parsedArgs = args;
  if (typeof args === 'string') {
    try { parsedArgs = JSON.parse(args); } catch { parsedArgs = args; }
  }

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all"
        style={{ background: showError ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', color: showError ? '#EF4444' : '#16A34A' }}
      >
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        <span className="font-semibold">{toolCall.name || 'פעולה'}</span>
        <span style={{ color: meta.color }}>· {meta.label}</span>
      </button>
      {expanded && (
        <div className="mt-1.5 rounded-lg p-2 space-y-1.5" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8' }}>
          {parsedArgs && (
            <div>
              <div className="font-semibold mb-0.5" style={{ color: '#6B7280' }}>פרמטרים:</div>
              <pre className="whitespace-pre-wrap break-words" style={{ color: '#1A1A1A' }}>{typeof parsedArgs === 'string' ? parsedArgs : JSON.stringify(parsedArgs, null, 2)}</pre>
            </div>
          )}
          {results != null && (
            <div>
              <div className="font-semibold mb-0.5" style={{ color: '#6B7280' }}>תוצאה:</div>
              <pre className="whitespace-pre-wrap break-words" style={{ color: showError ? '#EF4444' : '#1A1A1A' }}>{typeof parsedResults === 'string' ? parsedResults : JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OwnerAgentChat({ ownerId, onNavigate }) {
  const [mode, setMode] = useState('info'); // 'info' | 'edit'
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const conversationIdRef = useRef(null);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const existing = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        let conv = (existing && existing[0]) || null;
        if (!conv) {
          conv = await base44.agents.createConversation({ agent_name: AGENT_NAME, metadata: { name: 'עוזר בעל מתחם' } });
        } else {
          conv = await base44.agents.getConversation(conv.id);
        }
        conversationIdRef.current = conv.id;
        setConversation(conv);
        setMessages(conv.messages || []);
        setLoading(false);

        unsub = base44.agents.subscribeToConversation(conv.id, (data) => {
          setMessages(data.messages || []);
          const last = (data.messages || []).slice(-1)[0];
          if (last && last.role === 'assistant' && !sending) {
            // detect end of generation by assistant message presence; sending flag managed separately
          }
        });
      } catch (e) {
        setLoading(false);
      }
    })();
    return () => unsub();
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || !conversation || sending) return;
    setInput('');
    setSending(true);
    try {
      const stamped = `${MODE_PREFIX[mode]} ${trimmed}`;
      await base44.agents.addMessage(conversation, { role: 'user', content: stamped });
    } catch (e) {
      setSending(false);
    }
  }, [conversation, mode, sending]);

  // stop "sending" indicator once the latest assistant message arrives/stops streaming
  useEffect(() => {
    if (!sending) return;
    const timer = setInterval(() => {
      const last = messages.slice(-1)[0];
      if (last && last.role === 'assistant' && last.content) {
        setSending(false);
      }
    }, 800);
    return () => clearInterval(timer);
  }, [sending, messages]);

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } };

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  const modeConfig = mode === 'edit'
    ? { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.30)', color: '#EF4444', icon: Pencil, label: 'מצב עריכה', hint: 'העוזר יכול לבצע כל פעולה — ליצור, לעדכן, למחוק ולענות ללקוחות.' }
    : { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.30)', color: '#3B82F6', icon: Eye, label: 'מצב מידע', hint: 'קריאה בלבד — העוזר רק מציג נתונים ועונה על שאלות, בלי לבצע שינויים.' };
  const ModeIcon = modeConfig.icon;

  return (
    <div className="flex flex-col h-full" dir="rtl" style={{ background: '#F8F7F4', height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="px-5 py-4" style={{ background: '#fff', borderBottom: '1.5px solid #F0EEE8' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F97316' }}>
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-black text-base" style={{ color: '#1A1A1A' }}>עוזר ניהול AI</h2>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>מרכז שליטה מלא — כל פעולה במערכת, בשפה חופשית</p>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
            <button
              onClick={() => setMode('info')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={mode === 'info' ? { background: '#3B82F6', color: '#fff' } : { color: '#6B7280' }}
            >
              <Eye size={13} /> מידע
            </button>
            <button
              onClick={() => setMode('edit')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={mode === 'edit' ? { background: '#EF4444', color: '#fff' } : { color: '#6B7280' }}
            >
              <Pencil size={13} /> עריכה
            </button>
          </div>
        </div>

        {/* Mode banner */}
        <div className="mt-3 rounded-xl p-3 flex items-start gap-2.5" style={{ background: modeConfig.bg, border: `1.5px solid ${modeConfig.border}` }}>
          <ModeIcon size={16} style={{ color: modeConfig.color, flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold" style={{ color: modeConfig.color }}>{modeConfig.label}</span>
            <p className="text-xs mt-0.5" style={{ color: '#4B5563' }}>{modeConfig.hint}</p>
          </div>
          {mode === 'edit' && (
            <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: '#fff', color: '#EF4444' }}>
              <AlertTriangle size={11} /> פעולות מתבצעות מיד
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center" style={{ color: '#9CA3AF' }}>
            <ShieldCheck size={32} style={{ color: '#F97316' }} />
            <p className="text-sm mt-2">שאל אותי כל דבר — או העבר למצב עריכה כדי שאבצע פעולות בשבילך.</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const content = isUser ? String(msg.content || '').replace(/^\[מצב: [^\]]+\]\s*/, '') : (msg.content || '');
          return (
            <div key={msg.id || i} className={`flex items-end gap-2 mb-2 ${isUser ? 'flex-row-reverse' : ''}`}>
              {!isUser && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#F97316' }}>
                  <Bot size={15} />
                </div>
              )}
              <div className="max-w-sm lg:max-w-lg">
                <div
                  className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={isUser
                    ? { background: '#F97316', color: '#fff', borderBottomLeftRadius: '4px' }
                    : { background: '#fff', color: '#1A1A1A', border: '1.5px solid #F0EEE8', borderBottomRightRadius: '4px' }}
                >
                  {isUser
                    ? <p className="whitespace-pre-wrap">{content}</p>
                    : <div className="prose prose-sm max-w-none"><ReactMarkdown>{content}</ReactMarkdown></div>}
                </div>
                {!isUser && msg.tool_calls?.length > 0 && (
                  <div className="space-y-1">
                    {msg.tool_calls.map((tc, idx) => <ToolCallDisplay key={idx} toolCall={tc} />)}
                  </div>
                )}
                <div className="text-xs mt-1 px-1" style={{ color: '#9CA3AF' }}>{msg.time || formatTime()}</div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex items-end gap-2 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: '#F97316' }}><Bot size={15} /></div>
            <div className="rounded-2xl px-4 py-3" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <div className="flex gap-1 items-center h-4">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="px-5 pb-2 flex flex-wrap gap-2">
          {[
            'מה ההזמנות לשבוע הבא?',
            'כמה הזמנות ממתינות לאישור?',
            'מה הדירוג הממוצע שלי?',
            mode === 'edit' ? 'עדכן את מחיר נוף הגליל ל-650₪' : 'העבר למצב עריכה כדי לבצע פעולות',
            mode === 'edit' ? 'ענה על שאלות הלקוחות הממתינות' : 'מה ההכנסה החודש?',
          ].map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={sending}
              className="text-xs px-3 py-1.5 rounded-full transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: '#fff', border: '1.5px solid #F0EEE8', color: '#6B7280' }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 flex items-end gap-2" style={{ background: '#fff', borderTop: '1.5px solid #F0EEE8' }}>
        <div className="flex-1 rounded-2xl px-4 py-3 flex items-center min-h-[48px]" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'edit' ? 'כתוב פקודה — אעשה אותה מיד...' : 'שאל שאלה — אציג לך את הנתונים...'}
            className="w-full bg-transparent outline-none resize-none text-sm leading-5 max-h-28"
            style={{ color: '#1A1A1A', direction: 'rtl' }}
            rows={1}
          />
        </div>
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || sending}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-all disabled:opacity-40 hover:opacity-90"
          style={{ background: mode === 'edit' ? '#EF4444' : '#F97316' }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}