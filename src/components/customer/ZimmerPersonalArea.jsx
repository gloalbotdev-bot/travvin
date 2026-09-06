import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import { MessageCircleQuestion, CalendarClock, Bell, ChevronDown, Calendar } from 'lucide-react';

// Personal area shown below the zimmer-page side chat — only for the logged-in
// customer, only when there is activity on THIS zimmer. Live-updated via subscribe.
// The page itself stays identical for everyone; this box is the customer's private view.
const STATUS_BADGE = {
  'ממתינה': { bg: 'rgba(245,158,11,0.14)', color: '#D97706' },
  'אושרה': { bg: 'rgba(34,197,94,0.14)', color: '#16A34A' },
  'נדחתה': { bg: 'rgba(239,68,68,0.14)', color: '#EF4444' },
  'חסום': { bg: '#F0EEE8', color: '#9CA3AF' },
};

const fmtDate = (s) => s ? new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

export default function ZimmerPersonalArea({ zimmer, user }) {
  const [open, setOpen] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id || !zimmer?.id) { setLoading(false); return; }
    try {
      const [q, b, m] = await Promise.all([
        api.entities.UnansweredQuestion.filter({ created_by_id: user.id, zimmer_id: zimmer.id }, '-created_date', 20).catch(() => []),
        api.entities.BookingRequest.filter({ created_by_id: user.id, zimmer_id: zimmer.id }, '-created_date', 20).catch(() => []),
        api.entities.GuestMessage.filter({ customer_id: user.id, zimmer_id: zimmer.id }, '-created_date', 20).catch(() => []),
      ]);
      setQuestions(q || []);
      setBookings(b || []);
      setMessages(m || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  }, [user?.id, zimmer?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.id || !zimmer?.id) return;
    const uq = api.entities.UnansweredQuestion.subscribe(() => load());
    const ub = api.entities.BookingRequest.subscribe(() => load());
    const um = api.entities.GuestMessage.subscribe(() => load());
    return () => { try { uq(); ub(); um(); } catch (e) {} };
  }, [load]);

  if (loading) return null;
  const total = questions.length + bookings.length + messages.length;
  if (total === 0) return null;

  return (
    <div dir="rtl" style={{ background: '#fff' }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3 py-2.5" style={{ background: '#0B3838' }}>
        <span className="flex items-center gap-1.5 text-xs font-bold text-white">
          <CalendarClock size={14} /> האזור האישי שלך · {zimmer.name}
        </span>
        <ChevronDown size={15} className="text-white/70" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div className="px-3 py-3 space-y-3 max-h-[42vh] overflow-y-auto" style={{ background: '#F8F7F4' }}>
          {questions.length > 0 && (
            <Block icon={MessageCircleQuestion} title={`השאלות שלי (${questions.length})`}>
              {questions.map((q) => (
                <div key={q.id} className="rounded-xl p-2.5" style={{ background: '#fff', border: '1px solid #E8E5E0' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: '#1A1A1A' }}>❓ {q.question}</p>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={STATUS_BADGE[q.status] || { bg: '#F0EEE8', color: '#9CA3AF' }}>{q.status}</span>
                    <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{fmtDate(q.created_date)}</span>
                  </div>
                  {q.status === 'נענתה' && q.owner_answer && (
                    <p className="text-xs leading-relaxed mt-1.5 pt-1.5" style={{ color: '#16A34A', borderTop: '1px dashed #E8E5E0' }}>✅ {q.owner_answer}</p>
                  )}
                </div>
              ))}
            </Block>
          )}

          {bookings.length > 0 && (
            <Block icon={Calendar} title={`ההזמנות שלי (${bookings.length})`}>
              {bookings.map((b) => {
                const st = STATUS_BADGE[b.status] || { bg: '#F0EEE8', color: '#9CA3AF' };
                const nights = b.check_in && b.check_out ? Math.round((new Date(b.check_out) - new Date(b.check_in)) / 86400000) : null;
                return (
                  <div key={b.id} className="rounded-xl p-2.5" style={{ background: '#fff', border: '1px solid #E8E5E0' }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={st}>{b.status}</span>
                    </div>
                    <p className="text-xs" style={{ color: '#4B5563' }}>{fmtDate(b.check_in)} → {fmtDate(b.check_out)}{nights ? ` · ${nights} לילות` : ''}</p>
                  </div>
                );
              })}
            </Block>
          )}

          {messages.length > 0 && (
            <Block icon={Bell} title={`עדכונים והודעות (${messages.length})`}>
              {messages.map((m) => (
                <div key={m.id} className="rounded-xl p-2.5" style={{ background: '#fff', border: '1px solid #E8E5E0' }}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-xs font-bold" style={{ color: '#1A1A1A' }}>{m.title}</p>
                    <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{fmtDate(m.created_date)}</span>
                  </div>
                  {m.body && <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{m.body}</p>}
                </div>
              ))}
            </Block>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ icon: Icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={12} style={{ color: '#0B3838' }} />
        <span className="text-[11px] font-bold" style={{ color: '#0B3838' }}>{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}