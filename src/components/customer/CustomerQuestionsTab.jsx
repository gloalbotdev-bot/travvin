import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { HelpCircle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';

export default function CustomerQuestionsTab({ user }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    loadQuestions();
  }, [user]);

  const loadQuestions = async () => {
    setLoading(true);
    if (!user?.id) { setLoading(false); return; }
    const mine = await api.entities.UnansweredQuestion.filter(
      { created_by_id: user.id },
      '-created_date',
      100,
    );
    setQuestions(mine || []);
    setLoading(false);
  };

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>השאלות שלי</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>שאלות שהפנית לבעלי הצימרים דרך הצ'אט</p>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-24 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <HelpCircle size={40} className="mx-auto mb-4" style={{ color: '#E8E5E0' }} />
          <h3 className="text-lg font-black mb-2" style={{ color: '#1A1A1A' }}>אין שאלות עדיין</h3>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>כאשר תשאל שאלה שהבוט לא יכול לענות עליה, היא תופנה לבעל הצימר ותופיע כאן</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map(q => {
            const isAnswered = q.status === 'נענתה';
            const isOpen = expanded[q.id];
            return (
              <div key={q.id} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: `1.5px solid ${isAnswered ? 'rgba(34,197,94,0.25)' : '#F0EEE8'}` }}>
                <button className="w-full flex items-center gap-3 px-5 py-4 text-right" onClick={() => toggle(q.id)}>
                  <div className="flex-shrink-0">
                    {isAnswered
                      ? <CheckCircle size={20} style={{ color: '#22C55E' }} />
                      : <Clock size={20} style={{ color: '#F59E0B' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{q.question}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{q.zimmer_name || 'צימר'}</span>
                      <span className="text-xs" style={{ color: '#D1D5DB' }}>·</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={isAnswered
                          ? { background: 'rgba(34,197,94,0.1)', color: '#16A34A' }
                          : { background: 'rgba(245,158,11,0.1)', color: '#D97706' }}>
                        {isAnswered ? 'נענתה' : 'ממתינה לתשובה'}
                      </span>
                      <span className="text-xs mr-auto" style={{ color: '#D1D5DB' }}>
                        {new Date(q.created_date).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={16} style={{ color: '#9CA3AF' }} /> : <ChevronDown size={16} style={{ color: '#9CA3AF' }} />}
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 space-y-3" style={{ borderTop: '1px solid #F0EEE8' }}>
                    <div className="pt-3">
                      <p className="text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>השאלה שלך:</p>
                      <p className="text-sm" style={{ color: '#1A1A1A' }}>{q.question}</p>
                    </div>
                    {q.customer_search_summary && (
                      <div className="rounded-xl px-4 py-3" style={{ background: '#F8F7F4' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>הקשר החיפוש:</p>
                        <p className="text-xs" style={{ color: '#4B5563' }}>{q.customer_search_summary}</p>
                      </div>
                    )}
                    {isAnswered && q.owner_answer ? (
                      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: '#16A34A' }}>תשובת בעל הצימר:</p>
                        <p className="text-sm" style={{ color: '#1A1A1A' }}>{q.owner_answer}</p>
                        {q.answered_at && (
                          <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
                            נענה ב-{new Date(q.answered_at).toLocaleDateString('he-IL')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <p className="text-xs" style={{ color: '#D97706' }}>⏳ בעל הצימר טרם ענה — נעדכן אותך כשתגיע תשובה</p>
                      </div>
                    )}
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