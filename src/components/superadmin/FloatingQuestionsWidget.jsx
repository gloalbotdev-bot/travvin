import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircleQuestion, X, Check, BookOpen, Send, ChevronUp } from 'lucide-react';

const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A', borderRadius: '12px' };
const inputFocus = e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; };
const inputBlur = e => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#F8F7F4'; };

export default function FloatingQuestionsWidget() {
  const [questions, setQuestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answeringId, setAnsweringId] = useState(null);
  const [answer, setAnswer] = useState('');
  const [saveToKnowledge, setSaveToKnowledge] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.UnansweredQuestion.filter({ status: 'ממתינה' }, '-created_date', 50);
      setQuestions(data);
    } catch (e) { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // realtime refresh when unopened so the badge count stays fresh
  useEffect(() => {
    const unsub = base44.entities.UnansweredQuestion.subscribe(() => { if (!open) load(); });
    return unsub;
  }, [open, load]);

  const pending = questions;

  const handleAnswer = async (q) => {
    if (!answer.trim()) return;
    setSaving(true);
    try {
      await base44.entities.UnansweredQuestion.update(q.id, {
        status: 'נענתה',
        owner_answer: answer.trim(),
        save_to_knowledge: saveToKnowledge,
        answered_at: new Date().toISOString().split('T')[0],
      });
      if (saveToKnowledge) {
        const zimmer = await base44.entities.Zimmer.get(q.zimmer_id).catch(() => null);
        if (zimmer) {
          const zones = zimmer.data_zones || [];
          zones.push({
            content: `שאלה: ${q.question}\nתשובה: ${answer.trim()}`,
            source_type: 'טקסט חופשי',
            source_label: 'שאלת לקוח',
            source_date: new Date().toISOString().split('T')[0],
          });
          await base44.entities.Zimmer.update(q.zimmer_id, { data_zones: zones });
        }
      }
      setAnsweringId(null);
      setAnswer('');
      setSaveToKnowledge(false);
      await load();
    } catch (e) { alert('שגיאה בשמירת התשובה. ודא הרשאות אדמין.'); }
    setSaving(false);
  };

  const handleDismiss = async (id) => {
    await base44.entities.UnansweredQuestion.update(id, { status: 'נדחתה' });
    if (answeringId === id) { setAnsweringId(null); setAnswer(''); }
    load();
  };

  if (pending.length === 0 && !open) return null;

  return (
    <>
      {open && <div className="fixed inset-0" style={{ zIndex: 39 }} onClick={() => setOpen(false)} />}
      <div dir="rtl" style={{ position: 'fixed', left: 20, bottom: 20, zIndex: 40, fontFamily: 'Heebo, sans-serif' }}>
      {/* Floating cube */}
      {!open && (
        <button onClick={() => { setOpen(true); }}
          className="relative flex flex-col items-center justify-center rounded-2xl shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', border: '2px solid #fff' }}>
          <MessageCircleQuestion size={24} color="#fff" />
          <span className="absolute -top-2 -right-2 min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: '#EF4444', border: '2px solid #fff' }}>
            {pending.length}
          </span>
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: 380, maxWidth: 'calc(100vw - 40px)', maxHeight: '70vh', background: '#fff', border: '1.5px solid #F0EEE8' }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}>
            <div className="flex items-center gap-2 text-white">
              <MessageCircleQuestion size={18} />
              <div>
                <p className="font-black text-sm">שאלות ממתינות</p>
                <p className="text-[11px] text-white/80">{pending.length} לא מעונה</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/90 hover:bg-white/10 transition-all"><ChevronUp size={16} /></button>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/90 hover:bg-white/10 transition-all"><X size={16} /></button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" /></div>
            ) : pending.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(34,197,94,0.1)' }}><Check size={22} style={{ color: '#16A34A' }} /></div>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>הכל מטופל ✅</p>
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>אין שאלות ממתינות כרגע</p>
              </div>
            ) : (
              pending.map(q => (
                <div key={q.id} className="rounded-xl p-3" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8' }}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.12)', color: '#6D28D9' }}>{q.zimmer_name || 'צימר'}</span>
                    <span className="text-[10px]" style={{ color: '#D1D5DB' }}>{new Date(q.created_date).toLocaleDateString('he-IL')}</span>
                    <button onClick={() => handleDismiss(q.id)} className="text-gray-300 hover:text-red-400 transition-colors"><X size={13} /></button>
                  </div>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#1A1A1A' }}>❓ {q.question}</p>
                  {q.customer_search_summary && <p className="text-[10px] mb-1 px-2 py-1 rounded-lg" style={{ background: '#fff', color: '#6B7280' }}>🔍 {q.customer_search_summary}</p>}

                  {answeringId === q.id ? (
                    <div className="space-y-2 pt-2" style={{ borderTop: '1px solid #E8E5E0' }}>
                      <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={2} placeholder="כתוב תשובה..."
                        className="w-full px-3 py-2 text-xs outline-none resize-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <div onClick={() => setSaveToKnowledge(v => !v)} className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: saveToKnowledge ? '#F97316' : '#E8E5E0', border: '1.5px solid', borderColor: saveToKnowledge ? '#F97316' : '#E8E5E0' }}>
                          {saveToKnowledge && <Check size={9} color="white" />}
                        </div>
                        <span className="text-[10px]" style={{ color: '#6B7280' }}><BookOpen size={10} className="inline ml-0.5" /> שמור לידע הצימר</span>
                      </label>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setAnsweringId(null); setAnswer(''); setSaveToKnowledge(false); }} className="flex-1 py-2 rounded-lg text-[11px] font-semibold" style={{ border: '1px solid #E8E5E0', color: '#6B7280' }}>ביטול</button>
                        <button onClick={() => handleAnswer(q)} disabled={!answer.trim() || saving} className="flex-1 py-2 rounded-lg text-[11px] font-bold text-white disabled:opacity-60" style={{ background: '#F97316' }}>
                          {saving ? 'שולח...' : <span className="flex items-center justify-center gap-1"><Send size={11} /> שלח</span>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setAnsweringId(q.id); setAnswer(''); setSaveToKnowledge(false); }} className="w-full py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90" style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}>ענה מכאן</button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
}