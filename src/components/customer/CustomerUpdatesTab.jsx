import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, MessageCircle, CalendarClock, CheckCircle, Clock, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import DirectChat, { getOrCreateDirectThread } from '@/components/chat/DirectChat';

export default function CustomerUpdatesTab({ user, onAction, focusQuestionId, focusChatId }) {
  const [systemMsgs, setSystemMsgs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [threads, setThreads] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [directThread, setDirectThread] = useState(null);
  const [opening, setOpenThread] = useState(null);

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!focusChatId) return;
    (async () => {
      try { const t = await base44.entities.DirectChat.get(focusChatId); if (t) setDirectThread(t); } catch {}
    })();
  }, [focusChatId]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [sys, myBookings, direct, myQ] = await Promise.all([
        base44.entities.SystemMessage.filter({ audience: 'customer' }, '-created_date', 30),
        base44.entities.BookingRequest.filter({ created_by_id: user.id }, '-created_date', 60),
        base44.entities.DirectChat.filter({ customer_id: user.id }, '-updated_date'),
        base44.entities.UnansweredQuestion.filter({ created_by_id: user.id }, '-created_date', 200),
      ]);
      setSystemMsgs((sys || []).filter(m => !m.target_user_ids?.length || (m.target_user_ids || []).includes(user.id)));
      const upcoming = (myBookings || []).filter(b => new Date(b.check_in) >= new Date()).sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
      setBookings(upcoming);
      setThreads(direct);
      setQuestions(myQ || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  const openChat = async (booking) => {
    setOpenThread(booking.id);
    try {
      let zimmer = { id: booking.zimmer_id, name: booking.zimmer_name, owner_id: booking.owner_id, owner_name: '' };
      if (booking.zimmer_id) {
        const z = await base44.entities.Zimmer.get(booking.zimmer_id);
        if (z) zimmer = { id: z.id, name: z.name, owner_id: z.owner_id, owner_name: z.owner_name || '' };
      }
      const t = await getOrCreateDirectThread({ zimmer, customer: user, bookingId: booking.id });
      setDirectThread(t);
    } catch (e) {
      console.error('DirectChat open error:', e);
      alert('לא הצלחתי לפתוח את הצ׳אט: ' + (e?.message || String(e)));
    }
    setOpenThread(null);
  };

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => { if (focusQuestionId) setExpanded(prev => ({ ...prev, [focusQuestionId]: true })); }, [focusQuestionId]);
  const answeredQuestions = questions.filter(q => q.status === 'נענתה');

  // Unified feed (not divided by category) — shows new items on top; older ones get pushed down
  const recentFeed = (() => {
    const items = [];
    systemMsgs.forEach(m => items.push({
      key: 's_' + m.id, kind: 'system', date: m.created_date,
      title: m.title, body: m.body,
      color: m.category === 'הצעה' ? '#EA580C' : m.category === 'עדכון' ? '#075E54' : '#F97316',
      badge: m.category || 'הודעה', actionType: m.action_type, actionEntityId: m.action_entity_id,
    }));
    questions.forEach(q => {
      if (q.status === 'ממתינה') {
        items.push({ key: 'pending_' + q.id, kind: 'pending', date: q.created_date, title: 'שאלה ממתינה לתשובה', body: q.question, color: '#D97706', badge: 'ממתינה', zimmerName: q.zimmer_name });
      } else if (q.status === 'נענתה') {
        items.push({ key: 'answered_' + q.id, kind: 'answered', date: q.answered_at || q.created_date, title: 'תשובה התקבלה מבעל הצימר', body: q.question, answer: q.owner_answer, color: '#22C55E', badge: 'תשובה', zimmerName: q.zimmer_name, questionId: q.id });
      } else if (q.status === 'נדחיתה') {
        items.push({ key: 'rejected_' + q.id, kind: 'rejected', date: q.created_date, title: 'שאלה נדחתה', body: q.question, color: '#9CA3AF', badge: 'נדחית', zimmerName: q.zimmer_name });
      }
    });
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    return items.slice(0, 15);
  })();

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  if (directThread) {
    return <DirectChat thread={directThread} isOwner={false} user={user} counterpartName={directThread.owner_name} zimmerName={directThread.zimmer_name} onClose={() => { setDirectThread(null); load(); }} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>עדכונים</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>הודעות מערכת, הזמנות קרובות, תשובות מבעלי צימרים והתכתבות ישירה</p>
      </div>

      {/* עדכונים אחרונים — unified feed, not categorized. Stays on top until pushed down. */}
      <div className="mb-10">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
          <Clock size={15} style={{ color: '#F97316' }} /> עדכונים אחרונים
          {recentFeed.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>{recentFeed.length}</span>}
        </h2>
        {recentFeed.length === 0 ? (
          <Empty text="אין עדכונים עדיין" />
        ) : (
          <div className="space-y-2">
            {recentFeed.map(item => (
              <FeedCard key={item.key} item={item} onAction={onAction} onOpenQuestion={(qid) => setExpanded(prev => ({ ...prev, [qid]: true }))} />
            ))}
          </div>
        )}
      </div>

      {/* System messages */}
      <Section title="הודעות מערכת" icon={Bell} count={systemMsgs.length} color="#F97316">
        {systemMsgs.length === 0 ? (
          <Empty text="אין הודעות מערכת כרגע" />
        ) : (
          <div className="space-y-2">
            {systemMsgs.map(m => {
              const clickable = m.action_type && m.action_entity_id && onAction;
              const Wrapper = clickable ? 'button' : 'div';
              return (
                <Wrapper
                  key={m.id}
                  onClick={clickable ? () => onAction(m.action_type, m.action_entity_id) : undefined}
                  className={`rounded-2xl p-4 w-full text-right transition-all ${clickable ? 'cursor-pointer hover:shadow-md' : ''}`}
                  style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>{m.category || 'הודעה'}</span>
                    <span className="text-xs" style={{ color: '#D1D5DB' }}>{new Date(m.created_date).toLocaleDateString('he-IL')}</span>
                    {clickable && <span className="text-xs mr-auto font-semibold" style={{ color: '#F97316' }}>עבור ←</span>}
                  </div>
                  <p className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{m.title}</p>
                  {m.body && <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: '#4B5563' }}>{m.body}</p>}
                </Wrapper>
              );
            })}
          </div>
        )}
      </Section>

      {/* Upcoming bookings + direct chat */}
      <Section title="הזמנות קרובות" icon={CalendarClock} count={bookings.length} color="#075E54">
        {bookings.length === 0 ? (
          <Empty text="אין הזמנות קרובות" />
        ) : (
          <div className="space-y-2">
            {bookings.map(b => (
              <div key={b.id} className="rounded-2xl p-4 flex items-center justify-between gap-3" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: '#1A1A1A' }}>{b.zimmer_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>📅 {b.check_in} → {b.check_out} · {b.num_guests || 0} אורחים</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold inline-block mt-1"
                    style={b.status === 'אושרה' ? { background: 'rgba(34,197,94,0.1)', color: '#16A34A' } : { background: 'rgba(245,158,11,0.1)', color: '#D97706' }}>
                    {b.status}
                  </span>
                </div>
                <button onClick={() => openChat(b)} disabled={opening === b.id}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap disabled:opacity-60"
                  style={{ background: '#25D366', color: '#fff' }}>
                  <MessageCircle size={14} /> {opening === b.id ? 'פותח...' : 'צ\'אט עם בעל הצימר'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Direct threads */}
      {threads.length > 0 && (
        <Section title="התכתבויות ישירות" icon={MessageCircle} count={threads.length} color="#0EA5E9">
          <div className="space-y-2">
            {threads.map(t => {
              const last = (t.messages || [])[t.messages.length - 1];
              return (
                <button key={t.id} onClick={() => setDirectThread(t)}
                  className="w-full text-right rounded-2xl p-4 flex items-center justify-between gap-3 hover:shadow-md transition-all"
                  style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1A1A1A' }}>{t.owner_name || 'בעל הצימר'} · {t.zimmer_name}</p>
                    {last && <p className="text-xs truncate mt-0.5" style={{ color: '#9CA3AF' }}>{last.role === 'customer' ? 'אתה: ' : 'בעל הצימר: '}{last.content}</p>}
                  </div>
                  <ChevronDown size={16} style={{ color: '#9CA3AF' }} />
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Owner answers */}
      <Section title="תשובות מבעלי צימרים" icon={CheckCircle} count={answeredQuestions.length} color="#22C55E">
        {answeredQuestions.length === 0 ? (
          <Empty text="אין תשובות חדשות מבעלי צימרים" />
        ) : (
          <div className="space-y-2">
            {answeredQuestions.map(q => {
              const isOpen = expanded[q.id];
              return (
                <div key={q.id} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid rgba(34,197,94,0.25)' }}>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-right" onClick={() => toggle(q.id)}>
                    <CheckCircle size={18} style={{ color: '#22C55E' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{q.question}</p>
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{q.zimmer_name}</span>
                    </div>
                    {isOpen ? <ChevronUp size={15} style={{ color: '#9CA3AF' }} /> : <ChevronDown size={15} style={{ color: '#9CA3AF' }} />}
                  </button>
                  {isOpen && q.owner_answer && (
                    <div className="px-4 pb-4">
                      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <p className="text-sm" style={{ color: '#1A1A1A' }}>{q.owner_answer}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function FeedCard({ item, onAction, onOpenQuestion }) {
  const { kind, title, body, badge, color, actionType, actionEntityId, answer, zimmerName, date, questionId } = item;
  const clickable = kind === 'system' && actionType && actionEntityId && onAction;
  const Wrapper = clickable ? 'button' : 'div';
  return (
    <Wrapper
      onClick={clickable ? () => onAction(actionType, actionEntityId) : (kind === 'answered' && questionId && onOpenQuestion ? () => onOpenQuestion(questionId) : undefined)}
      className={`rounded-2xl p-4 w-full text-right transition-all ${clickable || (kind === 'answered' && questionId) ? 'cursor-pointer hover:shadow-md' : ''}`}
      style={{ background: '#fff', border: '1.5px solid #F0EEE8', borderRight: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}1a`, color }}>{badge}</span>
        {zimmerName && <span className="text-xs truncate" style={{ color: '#9CA3AF' }}>· {zimmerName}</span>}
        {date && <span className="text-xs mr-auto" style={{ color: '#D1D5DB' }}>{new Date(date).toLocaleDateString('he-IL', { day: '2-digit', month: 'short' })}</span>}
        {clickable && <span className="text-sm font-semibold" style={{ color }}>←</span>}
      </div>
      <p className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{title}</p>
      {body && <p className="text-sm mt-1 whitespace-pre-wrap line-clamp-2" style={{ color: '#4B5563' }}>{body}</p>}
      {kind === 'answered' && answer && (
        <div className="mt-2 rounded-xl px-3 py-2" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <p className="text-sm line-clamp-2" style={{ color: '#16A34A' }}>✅ {answer}</p>
          <p className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>הקלק לראות הכל בתשובות מבעלי צימרים ↓</p>
        </div>
      )}
    </Wrapper>
  );
}

function Section({ title, icon: Icon, count, color, children }) {
  return (
    <div className="mb-8">
      <h2 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
        <Icon size={15} style={{ color }} /> {title}
        {count > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${color}1a`, color }}>{count}</span>}
      </h2>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
      <p className="text-sm" style={{ color: '#9CA3AF' }}>{text}</p>
    </div>
  );
}