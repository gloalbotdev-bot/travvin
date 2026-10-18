import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Sparkles, ChevronDown, ChevronUp, MessageSquare, RefreshCw } from 'lucide-react';

const cardStyle = { background: '#fff', border: '1.5px solid #F0EEE8' };

export default function ChatHistoryPanel() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState({});
  const [expanded, setExpanded] = useState({});
  const [openChat, setOpenChat] = useState(null);

  useEffect(() => {
    api.entities.ChatSession.list('-created_date', 200).then(data => {
      setSessions(data);
      setLoading(false);
    });
  }, []);

  const generateSummary = async (session) => {
    setSummarizing(p => ({ ...p, [session.id]: true }));
    try {
      const response = await api.assistant.chat({
        profile: 'admin_session_summary',
        message: 'סכם את השיחה',
        clientState: { sessionId: session.id },
      });
      const summary = response?.message?.content || response?.executedActions?.[0]?.summary || '';
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, summary } : s));
    } catch (e) { /* ignore */ }
    setSummarizing(p => ({ ...p, [session.id]: false }));
  };

  // Group by user
  const byUser = sessions.reduce((acc, s) => {
    const key = s.user_id || 'unknown';
    if (!acc[key]) acc[key] = { name: s.user_name || s.user_email || 'אנונימי', email: s.user_email, sessions: [] };
    acc[key].sessions.push(s);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const userGroups = Object.entries(byUser);

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-black mb-1" style={{ color: '#1A1A1A' }}>היסטוריית התכתבויות</h1>
      <p className="text-sm mb-8" style={{ color: '#6B7280' }}>{userGroups.length} משתמשים · {sessions.length} שיחות</p>

      {userGroups.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={cardStyle}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #EAD5FF 0%, #FFD4C2 100%)' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 6h20a2 2 0 012 2v14a2 2 0 01-2 2H10l-6 4V8a2 2 0 012-2z" stroke="#9CA3AF" strokeWidth="1.8" strokeLinejoin="round"/><path d="M10 13h12M10 18h7" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <p style={{ color: '#9CA3AF' }}>אין שיחות שמורות עדיין</p>
        </div>
      ) : (
        <div className="space-y-4">
          {userGroups.map(([userId, group]) => (
            <div key={userId} className="rounded-2xl overflow-hidden" style={cardStyle}>
              <button
                onClick={() => setExpanded(p => ({ ...p, [userId]: !p[userId] }))}
                className="w-full flex items-center justify-between px-5 py-4 transition-colors"
                style={{ background: expanded[userId] ? '#F8F7F4' : 'transparent' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: 'rgba(249,115,22,0.12)', color: '#EA580C' }}>
                    {group.name[0]}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>{group.name}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{group.email} · {group.sessions.length} שיחות</p>
                  </div>
                </div>
                {expanded[userId] ? <ChevronUp size={16} style={{ color: '#9CA3AF' }} /> : <ChevronDown size={16} style={{ color: '#9CA3AF' }} />}
              </button>

              {expanded[userId] && (
                <div style={{ borderTop: '1px solid #F0EEE8' }}>
                  {group.sessions.map(s => (
                    <div key={s.id} className="px-5 py-4" style={{ borderTop: '1px solid #F0EEE8' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>
                          {new Date(s.created_date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {' · '}{(s.messages || []).length} הודעות
                          {s.zimmer_ids_shown?.length ? ` · ${s.zimmer_ids_shown.length} צימרים הוצגו` : ''}
                        </span>
                        {s.booking_created && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}>✅ הזמנה</span>}
                      </div>

                      {s.summary ? (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <Sparkles size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#F97316' }} />
                            <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>{s.summary}</p>
                          </div>
                          <button
                            onClick={() => generateSummary(s)}
                            disabled={summarizing[s.id]}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50 flex-shrink-0"
                            style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}
                          >
                            <RefreshCw size={12} className={summarizing[s.id] ? 'animate-spin' : ''} />
                            {summarizing[s.id] ? '...' : 'רענן'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <p className="text-sm italic flex-1" style={{ color: '#9CA3AF' }}>אין סיכום</p>
                          <button
                            onClick={() => generateSummary(s)}
                            disabled={summarizing[s.id]}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                            style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}
                          >
                            <Sparkles size={12} />
                            {summarizing[s.id] ? 'מסכם...' : 'סכם עם AI'}
                          </button>
                        </div>
                      )}

                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F0EEE8' }}>
                        <button
                          onClick={() => setOpenChat(p => p === s.id ? null : s.id)}
                          className="flex items-center gap-1.5 text-xs transition-colors"
                          style={{ color: '#6B7280' }}
                        >
                          <MessageSquare size={12} />
                          {openChat === s.id ? 'סגור שיחה' : 'פתח שיחה מלאה'}
                          {openChat === s.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {openChat === s.id && (
                          <div className="mt-3 space-y-2 rounded-xl p-3 max-h-96 overflow-y-auto" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0' }}>
                            {(s.messages || []).length === 0 ? (
                              <p className="text-xs text-center py-4" style={{ color: '#9CA3AF' }}>אין הודעות בשיחה זו</p>
                            ) : (
                              (s.messages || []).map((m, i) => {
                                const isUser = m.role === 'user';
                                return (
                                  <div key={i} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                                    <div
                                      className="max-w-[80%] rounded-xl px-3 py-2 text-sm"
                                      style={isUser
                                        ? { background: '#fff', color: '#1A1A1A', border: '1.5px solid #E8E5E0' }
                                        : { background: 'rgba(249,115,22,0.1)', color: '#9A3412', border: '1.5px solid rgba(249,115,22,0.25)' }}
                                    >
                                      <div className="text-[10px] mb-0.5 opacity-60">{isUser ? 'משתמש' : 'בוט'}{m.time ? ` · ${m.time}` : ''}</div>
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
