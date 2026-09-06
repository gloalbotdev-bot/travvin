import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { BookOpen, Send, Tag } from 'lucide-react';
import AiReplySuggestion from './AiReplySuggestion';

// All of a contact's questions in one scrollable list, each with its own
// zimmer tag and answer field. Answered questions show the sent answer.
export default function MessagesMergedQuestionsWindow({ contact, zimmers = {}, onAnswered, onDismissed }) {
  if (!contact) return null;
  const questions = [...(contact.questions || [])].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderColor: '#F0EEE8' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: '#075E54' }}>
          {(contact.name || 'ל').slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ color: '#1A1A1A' }}>{contact.name || 'לקוח'}</div>
          <div className="text-xs truncate" style={{ color: '#9CA3AF' }}>{questions.length} שאלות</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {questions.map(q => (
          <QuestionCard key={q.id} question={q} zimmer={zimmers[q.zimmer_id]} onAnswered={onAnswered} onDismissed={onDismissed} />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ question, zimmer, onAnswered, onDismissed }) {
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setAnswer(''); }, [question?.id]);

  const answered = question.status !== 'ממתינה';

  const buildPrompt = () => {
    const zones = (zimmer?.data_zones || []).map(z => `[${z.source_type || 'מידע'}]: ${z.content || ''}`).join('\n');
    return `אתה עוזר של בעל צימר. ענה על שאלת הלקוח בעברית, בקצרה ובאדיבות, על סמך פרטי הנכס בלבד.
צימר: ${question.zimmer_name || ''}
שאלה: ${question.question}
${question.customer_search_summary ? `סיכום חיפוש הלקוח: ${question.customer_search_summary}` : ''}
פרטי הנכס:
${zones || '(אין מידע נוסף)'}
אם אין מידע מספיק, החזר תשובה קצרה שמזמינה את הלקוח לפנות ישירות לבעלים.
החזר JSON בלבד: {"reply":"תוכן התשובה"}`;
  };

  const submit = async () => {
    if (!answer.trim()) return;
    setSaving(true);
    try {
      await api.entities.UnansweredQuestion.update(question.id, {
        status: 'נענתה',
        answered_by: 'owner',
        owner_answer: answer.trim(),
        save_to_knowledge: true,
        answered_at: new Date().toISOString().split('T')[0],
      });
      const z = await api.entities.Zimmer.get(question.zimmer_id).catch(() => null);
      if (z) {
        const allQ = await api.entities.UnansweredQuestion.filter({ zimmer_id: question.zimmer_id, status: 'נענתה' }, 'created_date');
        const qaZones = allQ.filter(i => i.owner_answer).map(i => ({
          content: `שאלה: ${i.question}\nתשובה: ${i.owner_answer}\nמקור: לקוח (${i.customer_name || 'אנונימי'}), תאריך: ${(i.created_date || '').slice(0, 10)}`,
          source_type: 'שאלות ותשובות',
          source_label: i.customer_name || 'לקוח',
          source_date: (i.created_date || '').slice(0, 10),
        }));
        const kept = (z.data_zones || []).filter(zn => zn.source_type !== 'שאלות ותשובות' && !(zn.source_type === 'טקסט חופשי' && zn.source_label === 'שאלת לקוח'));
        await api.entities.Zimmer.update(question.zimmer_id, { data_zones: [...kept, ...qaZones] });
      }
      onAnswered?.();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #e0e0e0' }}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(67,56,202,0.08)', color: '#4338ca' }}>
          <Tag size={9} /> {question.zimmer_name}
        </span>
        <span className="text-xs" style={{ color: '#9CA3AF' }}>{new Date(question.created_date).toLocaleDateString('he-IL')}</span>
        {question.status === 'ממתינה'
          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#EF4444' }}>ממתינה</span>
          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>{question.status}</span>}
      </div>
      <p className="font-bold text-sm mb-2" style={{ color: '#1A1A1A' }}>❓ {question.question}</p>
      {question.customer_search_summary && (
        <p className="text-xs px-3 py-2 rounded-xl mb-2" style={{ background: '#F8F7F4', color: '#6B7280' }}>🔍 הלקוח חיפש: {question.customer_search_summary}</p>
      )}

      {answered && question.owner_answer ? (
        <div className="rounded-xl p-3" style={{ background: '#F8F7F4' }}>
          <p className="text-xs font-bold mb-1" style={{ color: '#16A34A' }}>תשובה שנשלחה</p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: '#374151' }}>{question.owner_answer}</p>
        </div>
      ) : (
        <>
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3} placeholder="כתוב את התשובה ללקוח..."
            className="w-full px-4 py-3 text-sm outline-none resize-none rounded-xl" style={{ background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A' }} />
          <div className="flex items-center gap-2 text-xs mt-2" style={{ color: '#6B7280' }}>
            <BookOpen size={12} style={{ color: '#F97316' }} /> השאלה והתשובה יישמרו כאזור מידע בצימר
          </div>
          <AiReplySuggestion key={question.id} contextLabel="לפי פרטי הנכס והשאלה" buildPrompt={buildPrompt} onApply={(t) => setAnswer(t)} disabled={saving} />
          <div className="flex gap-2 pt-1">
            <button onClick={() => onDismissed?.(question.id)} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>דחה</button>
            <button onClick={submit} disabled={!answer.trim() || saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: '#F97316' }}>
              <Send size={15} /> {saving ? 'שולח...' : 'שלח תשובה'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}