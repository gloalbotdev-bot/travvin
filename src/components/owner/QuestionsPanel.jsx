import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircleQuestion, X, BookOpen, Clock } from 'lucide-react';

const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A', borderRadius: '12px' };
const inputFocus = e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; };
const inputBlur = e => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#F8F7F4'; };

export default function QuestionsPanel({ ownerId, focusQuestionId }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answeringId, setAnsweringId] = useState(null);
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ownerId) load();
  }, [ownerId]);

  useEffect(() => {
    if (focusQuestionId) setAnsweringId(focusQuestionId);
  }, [focusQuestionId]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.UnansweredQuestion.filter({ owner_id: ownerId }, '-created_date');
    setQuestions(data);
    setLoading(false);
  };

  const handleAnswer = async (q) => {
    if (!answer.trim()) return;
    setSaving(true);
    await base44.entities.UnansweredQuestion.update(q.id, {
      status: 'נענתה',
      owner_answer: answer.trim(),
      save_to_knowledge: true,
      answered_at: new Date().toISOString().split('T')[0],
    });

    const zimmer = await base44.entities.Zimmer.get(q.zimmer_id).catch(() => null);
    if (zimmer) {
      // Rebuild the Q&A info zones from ALL answered questions on this zimmer
      const allQ = await base44.entities.UnansweredQuestion.filter({ zimmer_id: q.zimmer_id, status: 'נענתה' }, 'created_date');
      const answeredQ = allQ.filter(item => item.owner_answer);
      const qaZones = answeredQ.map(item => ({
        content: `שאלה: ${item.question}\nתשובה: ${item.owner_answer}\nמקור: לקוח (${item.customer_name || 'אנונימי'}), תאריך: ${(item.created_date || '').slice(0, 10)}`,
        source_type: 'שאלות ותשובות',
        source_label: item.customer_name || 'לקוח',
        source_date: (item.created_date || '').slice(0, 10),
      }));
      // Keep zones the owner added manually; drop old auto-generated Q&A zones
      const kept = (zimmer.data_zones || []).filter(z =>
        z.source_type !== 'שאלות ותשובות' &&
        !(z.source_type === 'טקסט חופשי' && z.source_label === 'שאלת לקוח')
      );
      await base44.entities.Zimmer.update(q.zimmer_id, { data_zones: [...kept, ...qaZones] });
    }

    setAnsweringId(null);
    setAnswer('');
    setSaving(false);
    load();
  };

  const handleDismiss = async (id) => {
    await base44.entities.UnansweredQuestion.update(id, { status: 'נדחתה' });
    load();
  };

  const pending = questions.filter(q => q.status === 'ממתינה');
  const answered = questions.filter(q => q.status !== 'ממתינה');

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>שאלות לקוחות</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>{pending.length} שאלות ממתינות למענה</p>
      </div>

      {/* Pending Questions */}
      {pending.length === 0 ? (
        <div className="rounded-2xl p-12 text-center mb-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #EAD5FF 0%, #FFD4C2 100%)' }}>
            <MessageCircleQuestion size={28} style={{ color: '#9CA3AF' }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>אין שאלות ממתינות</p>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>כשלקוח ישאל שאלה שהבוט לא יודע לענות עליה — היא תופיע כאן</p>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {pending.map(q => (
            <div key={q.id} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <div className="p-5">
                {/* Question header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#EF4444' }} title="דורש פעולה" />
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
                        {q.zimmer_name}
                      </span>
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>
                        {new Date(q.created_date).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                    <p className="font-semibold text-sm mb-2" style={{ color: '#1A1A1A' }}>❓ {q.question}</p>
                    {q.customer_search_summary && (
                      <p className="text-xs px-3 py-2 rounded-xl" style={{ background: '#F8F7F4', color: '#6B7280' }}>
                        🔍 הלקוח חיפש: {q.customer_search_summary}
                      </p>
                    )}
                  </div>
                  <button onClick={() => handleDismiss(q.id)} className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0">
                    <X size={16} />
                  </button>
                </div>

                {/* Answer area */}
                {answeringId === q.id ? (
                  <div className="space-y-3 pt-3" style={{ borderTop: '1px solid #F0EEE8' }}>
                    <textarea value={answer} onChange={e => setAnswer(e.target.value)}
                      rows={3} placeholder="כתוב את התשובה שלך..."
                      className="w-full px-4 py-3 text-sm outline-none resize-none transition-all"
                      style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                    
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
                      <BookOpen size={12} style={{ color: '#F97316' }} />
                      השאלה והתשובה יישמרו אוטומטית כאזור מידע בצימר (מקור, תאריך וכו')
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => { setAnsweringId(null); setAnswer(''); }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                        style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
                        ביטול
                      </button>
                      <button onClick={() => handleAnswer(q)} disabled={!answer.trim() || saving}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                        style={{ background: '#F97316' }}>
                        {saving ? 'שולח...' : 'שלח תשובה ללקוח'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAnsweringId(q.id); setAnswer(''); }}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 mt-2"
                    style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}>
                    ענה ללקוח
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Answered */}
      {answered.length > 0 && (
        <div>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#6B7280' }}>
            <Clock size={14} /> היסטוריה ({answered.length})
          </h2>
          <div className="space-y-2">
            {answered.map(q => (
              <div key={q.id} className="rounded-xl p-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1" style={{ color: '#4B5563' }}>❓ {q.question}</p>
                    {q.owner_answer && <p className="text-xs" style={{ color: '#9CA3AF' }}>✅ {q.owner_answer}</p>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={q.status === 'נענתה'
                      ? { background: 'rgba(34,197,94,0.1)', color: '#16A34A' }
                      : { background: '#F0EEE8', color: '#9CA3AF' }}>
                    {q.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}