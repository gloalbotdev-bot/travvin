import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { MessageSquare, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';

export default function CustomerHistoryTab({ user }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.entities.ChatSession.filter({ user_id: user.id }, '-created_date', 50).then(data => {
      setSessions(data);
      setLoading(false);
    });
  }, [user.id]);

  const continueChat = (session) => {
    // Store session messages in sessionStorage so CustomerChat can pick up
    sessionStorage.setItem('resume_session_id', session.id);
    sessionStorage.setItem('resume_messages', JSON.stringify(session.messages || []));
    window.location.href = '/chat';
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-700 border-t-[#25D366] rounded-full animate-spin"></div></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">היסטוריית חיפושים</h1>
      <p className="text-gray-400 text-sm mb-8">{sessions.length} שיחות שמורות</p>

      {sessions.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">💬</div>
          <p>אין שיחות שמורות עדיין</p>
          <a href="/chat" className="inline-block mt-4 text-[#25D366] hover:underline text-sm">התחל שיחה עם הבוט →</a>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map(s => {
            const isOpen = expanded === s.id;
            const msgCount = (s.messages || []).length;
            return (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare size={16} className="text-[#25D366]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">
                        {new Date(s.created_date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-white text-sm mt-0.5">
                        {s.summary || `${msgCount} הודעות${s.zimmer_ids_shown?.length ? ` · ${s.zimmer_ids_shown.length} צימרים הוצגו` : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.booking_created && (
                      <span className="text-xs bg-green-400/10 text-green-400 px-2 py-0.5 rounded-full">✅ הזמנה</span>
                    )}
                    <button
                      onClick={() => setExpanded(isOpen ? null : s.id)}
                      className="text-gray-500 hover:text-white transition-colors p-1"
                    >
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded messages */}
                {isOpen && (
                  <div className="border-t border-gray-800 px-5 pb-5">
                    <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
                      {(s.messages || []).map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                            m.role === 'user'
                              ? 'bg-gray-800 text-gray-200'
                              : 'bg-[#25D366]/10 text-[#25D366]'
                          }`}>
                            <p className="leading-relaxed">{m.content}</p>
                            {m.time && <p className="text-xs opacity-50 mt-0.5">{m.time}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => continueChat(s)}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      <ArrowLeft size={15} /> המשך שיחה זו
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}