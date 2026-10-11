import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { BookOpen } from 'lucide-react';
import AiReplySuggestion from './AiReplySuggestion';
import ContactAvatar from './ContactAvatar';

// All of a contact's questions in one scrollable list, each with its own
// zimmer tag and answer field. Answered questions show the sent answer.
export default function MessagesMergedQuestionsWindow({ contact, zimmers = {}, onAnswered, onDismissed }) {
  if (!contact) return null;
  const questions = [...(contact.questions || [])].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

  return (
    <div className="font-simona flex flex-col h-full bg-white" dir="rtl">
      <div className="flex items-center gap-[12px] px-[32px] py-[24px] border-b border-[#E5E5E5] flex-shrink-0">
        <ContactAvatar name={contact.name} />
        <div className="flex flex-col gap-[2px] items-start leading-normal min-w-0">
          <span className="text-[16px] truncate max-w-full" style={{ color: '#0B3838', fontWeight: 500 }}>{contact.name || 'לקוח'}</span>
          <span className="text-[13px]" style={{ color: '#6B7280' }}>{questions.length} שאלות</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto owner-hide-scrollbar p-[32px] flex flex-col gap-[16px]">
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
    <div className="rounded-[23px] p-[20px] bg-white border border-[#E5E5E5] flex flex-col gap-[12px]">
      <div className="flex items-center gap-2 flex-wrap">
        {question.zimmer_name && (
          <span className="inline-flex items-center h-[28px] px-[12px] rounded-full text-[13px]" style={{ border: '1px solid rgba(11,56,56,0.21)', color: '#0B3838' }}>
            {question.zimmer_name}
          </span>
        )}
        <span className="text-[13px]" style={{ color: '#6B7280' }}>{new Date(question.created_date).toLocaleDateString('he-IL')}</span>
        <span className="text-[13px] px-[8px] py-[3px] rounded-full" style={question.status === 'ממתינה'
          ? { background: '#FFFF00', color: '#0B3838', fontWeight: 500 }
          : { background: '#EFEFEF', color: '#0B3838', fontWeight: 500 }}>
          {question.status}
        </span>
      </div>

      <div className="max-w-[480px] p-[16px] rounded-[16px] rounded-tr-none bg-white border border-[#E5E5E5]">
        <p className="text-[15px] leading-[1.5] whitespace-pre-wrap" style={{ color: '#0B3838' }}>{question.question}</p>
      </div>
      {question.customer_search_summary && (
        <p className="text-[13px] px-[16px] py-[10px] rounded-[16px]" style={{ background: '#FAFAFA', color: '#6B7280' }}>הלקוח חיפש: {question.customer_search_summary}</p>
      )}

      {answered && question.owner_answer ? (
        <div className="self-end max-w-[480px] p-[16px] rounded-[16px] rounded-tl-none" style={{ background: '#EFEFEF' }}>
          <p className="text-[11px] mb-1" style={{ color: '#6B7280' }}>תשובה שנשלחה</p>
          <p className="text-[15px] leading-[1.5] whitespace-pre-wrap" style={{ color: '#0B3838' }}>{question.owner_answer}</p>
        </div>
      ) : (
        <>
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3} placeholder="כתיבת תשובה ללקוח..."
            aria-label="תשובה ללקוח"
            className="w-full px-[20px] py-[14px] text-[15px] leading-[1.5] outline-none resize-none rounded-[23px] bg-white border border-[#E5E5E5] focus:border-[#0B3838] placeholder:text-[#6B7280]"
            style={{ color: '#0B3838' }} />
          <div className="flex items-center gap-2 text-[13px]" style={{ color: '#6B7280' }}>
            <BookOpen size={13} style={{ color: '#0B3838' }} /> השאלה והתשובה יישמרו כאזור מידע בצימר
          </div>
          <AiReplySuggestion key={question.id} title="תשובה מוצעת" actionLabel="הוסף לתיבה" buildPrompt={buildPrompt} onApply={(t) => setAnswer(t)} disabled={saving} />
          <div className="flex gap-[12px]">
            <button type="button" onClick={() => onDismissed?.(question.id)} className="px-[20px] py-[12px] rounded-[35px] text-[14px] hover:bg-[#FAFAFA]"
              style={{ border: '1px solid rgba(11,56,56,0.21)', color: '#0B3838', fontWeight: 500 }}>דחה</button>
            <button type="button" onClick={submit} disabled={!answer.trim() || saving}
              className="font-simpler flex-1 p-[12px] rounded-[35px] text-[16px] text-white disabled:opacity-50 hover:opacity-90" style={{ background: '#0B3838' }}>
              {saving ? 'שולח...' : 'שלח תשובה'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}