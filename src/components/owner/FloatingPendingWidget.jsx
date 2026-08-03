import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircleQuestion, X, ChevronUp, ArrowLeft, ClipboardList, CalendarX, MessageSquare, Check } from 'lucide-react';

export default function FloatingPendingWidget({ ownerId, onAction }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [chats, setChats] = useState([]);

  const load = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const [b, q, c] = await Promise.all([
        base44.entities.BookingRequest.filter({ owner_id: ownerId }),
        base44.entities.UnansweredQuestion.filter({ owner_id: ownerId, status: 'ממתינה' }, '-created_date', 50),
        base44.entities.DirectChat.filter({ owner_id: ownerId }, '-updated_date'),
      ]);
      setBookings(b || []);
      setQuestions(q || []);
      setChats(c || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  }, [ownerId]);

  useEffect(() => { load(); }, [load]);

  // realtime refresh while closed so the badge stays fresh
  useEffect(() => {
    const u1 = base44.entities.BookingRequest.subscribe(() => { if (!open) load(); });
    const u2 = base44.entities.UnansweredQuestion.subscribe(() => { if (!open) load(); });
    const u3 = base44.entities.DirectChat.subscribe(() => { if (!open) load(); });
    return () => { u1(); u2(); u3(); };
  }, [open, load]);

  const pendingApprovals = bookings.filter(b => b.status === 'ממתינה' && !b.cancel_request_reason);
  const cancelRequests = bookings.filter(b => b.cancel_request_reason);
  const chatAwait = chats.filter(t => (t.messages || []).length > 0 && (t.messages || []).slice(-1)[0]?.role === 'customer');

  const total = pendingApprovals.length + cancelRequests.length + questions.length + chatAwait.length;

  if (total === 0 && !open) return null;

  return (
    <>
      {open && <div className="fixed inset-0" style={{ zIndex: 39 }} onClick={() => setOpen(false)} />}
      <div dir="rtl" style={{ position: 'fixed', left: 20, bottom: 20, zIndex: 40, fontFamily: 'Heebo, sans-serif' }}>
      {!open && (
        <button onClick={() => { setOpen(true); }}
          className="relative flex flex-col items-center justify-center rounded-2xl shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #7B3FE4 0%, #5B21B6 100%)', border: '2px solid #fff' }}
          title="ממתין לטיפול">
          <MessageCircleQuestion size={26} color="#fff" />
          <span className="absolute -top-2 -right-2 min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: '#F05050', border: '2px solid #fff' }}>
            {total}
          </span>
        </button>
      )}

      {open && (
        <div className="rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: 400, maxWidth: 'calc(100vw - 40px)', maxHeight: '75vh', background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #7B3FE4 0%, #5B21B6 100%)' }}>
            <div className="flex items-center gap-2 text-white">
              <MessageCircleQuestion size={18} />
              <div>
                <p className="font-black text-sm">ממתין לטיפול</p>
                <p className="text-[11px] text-white/80">{total} פריטים דורשים טיפול</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/90 hover:bg-white/10 transition-all"><ChevronUp size={16} /></button>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/90 hover:bg-white/10 transition-all"><X size={16} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {loading ? (
              <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" /></div>
            ) : total === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(34,197,94,0.1)' }}><Check size={22} style={{ color: '#16A34A' }} /></div>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>הכל מטופל ✅</p>
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>אין פריטים ממתינים כרגע</p>
              </div>
            ) : (
              <>
                {questions.map(q => (
                  <PendingRow key={`q${q.id}`} color="#7B3FE4" icon={MessageCircleQuestion}
                    title={`שאלה מלקוח — ${q.zimmer_name}`}
                    sub={q.question}
                    cta="ענה"
                    onClick={() => { setOpen(false); onAction?.('answer_question', q.id); }} />
                ))}
                {pendingApprovals.map(b => (
                  <PendingRow key={`a${b.id}`} color="#F97316" icon={ClipboardList}
                    title={`אישור הזמנה — ${b.guest_name}`}
                    sub={`${b.zimmer_name} · ${b.check_in} → ${b.check_out}`}
                    cta="טפל"
                    onClick={() => { setOpen(false); onAction?.('approve_booking', b.id); }} />
                ))}
                {cancelRequests.map(b => (
                  <PendingRow key={`c${b.id}`} color="#D97706" icon={CalendarX}
                    title={`בקשת ביטול — ${b.guest_name}`}
                    sub={`${b.zimmer_name} · ${b.cancel_request_reason}`}
                    cta="טפל"
                    onClick={() => { setOpen(false); onAction?.('cancel_booking', b.id); }} />
                ))}
                {chatAwait.map(t => (
                  <PendingRow key={`t${t.id}`} color="#0EA5E9" icon={MessageSquare}
                    title={`צ'אט ממתין למענה — ${t.customer_name || 'לקוח'}`}
                    sub={`${t.zimmer_name} · ${(t.messages || []).slice(-1)[0]?.content || ''}`}
                    cta="ענה"
                    onClick={() => { setOpen(false); onAction?.('open_chat', t.id); }} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
}

function PendingRow({ color, icon: Icon, title, sub, cta, onClick }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8', borderRight: `3px solid ${color}` }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} style={{ color, flexShrink: 0 }} />
        <span className="text-[11px] font-semibold truncate" style={{ color }}>{title}</span>
      </div>
      <p className="text-xs mb-2.5 whitespace-pre-wrap" style={{ color: '#4B5563', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{sub}</p>
      <button onClick={onClick} className="w-full py-2 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1 hover:opacity-90 transition-all" style={{ background: color }}>
        {cta} <ArrowLeft size={12} />
      </button>
    </div>
  );
}