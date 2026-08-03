import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, ChevronDown, ChevronUp, MessageSquare, X, RefreshCw } from 'lucide-react';

export default function ChatHistoryPanel() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState({});
  const [expanded, setExpanded] = useState({});
  const [openChat, setOpenChat] = useState(null);

  useEffect(() => {
    base44.entities.ChatSession.list('-created_date', 200).then(data => {
      setSessions(data);
      setLoading(false);
    });
  }, []);

  const generateSummary = async (session) => {
    setSummarizing(p => ({ ...p, [session.id]: true }));
    const msgText = (session.messages || []).map(m => `${m.role === 'user' ? 'לקוח' : 'בוט'}: ${m.content}`).join('\n');
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `סכם בעברית בקצרה (3-5 שורות) את השיחה הבאה עם לקוח בצ'אט של מערכת הזמנות צימרים. ציין: מה הלקוח חיפש, אילו צימרים הוצגו, ואם נוצרה הזמנה.\n\nשיחה:\n${msgText || 'אין הודעות'}`,
    });
    await base44.entities.ChatSession.update(session.id, { summary: result });
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, summary: result } : s));
    setSummarizing(p => ({ ...p, [session.id]: false }));
  };

  // Group by user
  const byUser = sessions.reduce((acc, s) => {
    const key = s.user_id || 'unknown';
    if (!acc[key]) acc[key] = { name: s.user_name || s.user_email || 'אנונימי', email: s.user_email, sessions: [] };
    acc[key].sessions.push(s);
    return acc;
  }, {});

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-700 border-t-purple-500 rounded-full animate-spin"></div></div>;

  const userGroups = Object.entries(byUser);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">היסטוריית התכתבויות</h1>
      <p className="text-gray-400 text-sm mb-8">{userGroups.length} לקוחות · {sessions.length} שיחות</p>

      {userGroups.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #EAD5FF 0%, #FFD4C2 100%)' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 6h20a2 2 0 012 2v14a2 2 0 01-2 2H10l-6 4V8a2 2 0 012-2z" stroke="#9CA3AF" strokeWidth="1.8" strokeLinejoin="round"/><path d="M10 13h12M10 18h7" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <p style={{ color: '#9CA3AF' }}>אין שיחות שמורות עדיין</p>
        </div>
      ) : (
        <div className="space-y-4">
          {userGroups.map(([userId, group]) => (
            <div key={userId} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {/* User header */}
              <button
                onClick={() => setExpanded(p => ({ ...p, [userId]: !p[userId] }))}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-600/30 flex items-center justify-center text-purple-400 font-bold text-sm">
                    {group.name[0]}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white text-sm">{group.name}</p>
                    <p className="text-gray-500 text-xs">{group.email} · {group.sessions.length} שיחות</p>
                  </div>
                </div>
                {expanded[userId] ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {/* Sessions */}
              {expanded[userId] && (
                <div className="border-t border-gray-800 divide-y divide-gray-800">
                  {group.sessions.map(s => (
                    <div key={s.id} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">
                          {new Date(s.created_date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {' · '}{(s.messages || []).length} הודעות
                          {s.zimmer_ids_shown?.length ? ` · ${s.zimmer_ids_shown.length} צימרים הוצגו` : ''}
                        </span>
                        {s.booking_created && <span className="text-xs bg-green-400/10 text-green-400 px-2 py-0.5 rounded-full">✅ הזמנה</span>}
                      </div>

                      {/* Summary */}
                      {s.summary ? (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <Sparkles size={13} className="text-purple-400 mt-0.5 flex-shrink-0" />
                            <p className="text-gray-300 text-sm leading-relaxed">{s.summary}</p>
                          </div>
                          <button
                            onClick={() => generateSummary(s)}
                            disabled={summarizing[s.id]}
                            className="flex items-center gap-1.5 text-xs bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                          >
                            <RefreshCw size={12} className={summarizing[s.id] ? 'animate-spin' : ''} />
                            {summarizing[s.id] ? '...' : 'רענן'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <p className="text-gray-500 text-sm italic flex-1">אין סיכום</p>
                          <button
                            onClick={() => generateSummary(s)}
                            disabled={summarizing[s.id]}
                            className="flex items-center gap-1.5 text-xs bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Sparkles size={12} />
                            {summarizing[s.id] ? 'מסכם...' : 'סכם עם AI'}
                          </button>
                        </div>
                      )}

                      {/* View full conversation */}
                      <div className="mt-3 pt-3 border-t border-gray-800/50">
                        <button
                          onClick={() => setOpenChat(p => p === s.id ? null : s.id)}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          <MessageSquare size={12} />
                          {openChat === s.id ? 'סגור שיחה' : 'פתח שיחה מלאה'}
                          {openChat === s.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {openChat === s.id && (
                          <div className="mt-3 space-y-2 bg-gray-950/50 rounded-xl p-3 border border-gray-800 max-h-96 overflow-y-auto">
                            {(s.messages || []).length === 0 ? (
                              <p className="text-gray-600 text-xs text-center py-4">אין הודעות בשיחה זו</p>
                            ) : (
                              (s.messages || []).map((m, i) => {
                                const isUser = m.role === 'user';
                                return (
                                  <div key={i} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${isUser ? 'bg-gray-800 text-gray-200' : 'bg-purple-600/20 text-purple-200 border border-purple-600/30'}`}>
                                      <div className="text-[10px] mb-0.5 opacity-60">{isUser ? 'לקוח' : 'בוט'}{m.time ? ` · ${m.time}` : ''}</div>
                                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}