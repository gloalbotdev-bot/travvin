import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/api/client';
import { Bell, MessageCircleQuestion, ArrowRight, MessageCircle } from 'lucide-react';
import MessagesList from './messages/MessagesList';
import MessagesMergedChatWindow from './messages/MessagesMergedChatWindow';
import MessagesMergedQuestionsWindow from './messages/MessagesMergedQuestionsWindow';
import MessagesContactPanel from './messages/MessagesContactPanel';
import { buildPhoneLookup, groupChatsByContact, groupQuestionsByContact } from './messages/groupContacts';
import { fmtMsgTime } from './messages/timeFormat';

const SYS_READ_KEY = 'zb_read_sysmsgs_owner';
const loadSysReadSet = () => { try { return new Set(JSON.parse(localStorage.getItem(SYS_READ_KEY) || '[]')); } catch { return new Set(); } };
const chatLastSeen = (id) => localStorage.getItem(`zb_lastSeen_chat_${id}`) || '1970-01-01T00:00:00.000Z';
const markChatRead = (id) => localStorage.setItem(`zb_lastSeen_chat_${id}`, new Date().toISOString());
const markSysRead = (id) => { const s = loadSysReadSet(); s.add(id); localStorage.setItem(SYS_READ_KEY, JSON.stringify([...s])); };

export default function OwnerUpdatesPanel({ user, onAction, focusQuestionId, focusChatId, onMarkSystemRead, onAddBooking, onNavigate }) {
  const [category, setCategory] = useState('chats');
  const [threads, setThreads] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [systemMsgs, setSystemMsgs] = useState([]);
  const [guestProfiles, setGuestProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);
  const [zimmerMap, setZimmerMap] = useState({});
  const [search, setSearch] = useState('');
  const [subFilter, setSubFilter] = useState('all');
  const [isLg, setIsLg] = useState(false);
  const preferredCategoryDone = useRef(false);

  const sysReadSet = loadSysReadSet();

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsLg(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [direct, sys, qs, profiles] = await Promise.all([
        api.entities.DirectChat.filter({ owner_id: user.id }, '-updated_date'),
        api.entities.SystemMessage.filter({ audience: 'owner' }, '-created_date', 30),
        api.entities.UnansweredQuestion.filter({ owner_id: user.id }, '-created_date'),
        api.entities.GuestProfile.filter({ owner_id: user.id }).catch(() => []),
      ]);
      setThreads(direct || []);
      setSystemMsgs((sys || []).filter(m => !m.target_user_ids?.length || (m.target_user_ids || []).includes(user.id)));
      setQuestions(qs || []);
      setGuestProfiles(profiles || []);
    } catch { /* silent */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    const u1 = api.entities.DirectChat.subscribe(() => { load(); });
    const u2 = api.entities.UnansweredQuestion.subscribe(() => { load(); });
    const u3 = api.entities.SystemMessage.subscribe(() => { load(); });
    return () => { u1(); u2(); u3(); };
  }, [user]);

  const lookup = useMemo(() => buildPhoneLookup(guestProfiles), [guestProfiles]);
  const chatContacts = useMemo(() => groupChatsByContact(threads, lookup), [threads, lookup]);
  const questionContacts = useMemo(() => groupQuestionsByContact(questions, lookup), [questions, lookup]);

  // Notification deep-links → resolve after data loads (OwnerPanel used to clear
  // focus after 200ms, before this panel finished loading).
  useEffect(() => {
    if (!focusChatId || loading) return;
    preferredCategoryDone.current = true;
    setCategory('chats');
    setSubFilter('all');
    const c = chatContacts.find((x) => x.threads.some((t) => t.id === focusChatId));
    if (c) setSelectedKey(c.key);
  }, [focusChatId, chatContacts, loading]);

  useEffect(() => {
    if (!focusQuestionId || loading) return;
    preferredCategoryDone.current = true;
    setCategory('questions');
    setSubFilter('pending');
    const c = questionContacts.find((x) => x.questions.some((q) => q.id === focusQuestionId));
    if (c) setSelectedKey(c.key);
  }, [focusQuestionId, questionContacts, loading]);

  // Questions live under "שאלות לקוחות", not "צ'אטים ישירים". When the owner opens
  // Messages with pending questions (and no chat deep-link), land on questions.
  useEffect(() => {
    if (loading || preferredCategoryDone.current || focusChatId || focusQuestionId) return;
    const hasPendingQ = questionContacts.some((c) => c.questions.some((q) => q.status === 'ממתינה'));
    if (!hasPendingQ) return;
    preferredCategoryDone.current = true;
    setCategory('questions');
    setSubFilter('pending');
  }, [loading, questionContacts, focusChatId, focusQuestionId]);

  const switchCategory = (id) => {
    setCategory(id);
    setSelectedKey(null);
    setSubFilter('all');
    setSearch('');
    if (id === 'system' && onMarkSystemRead) onMarkSystemRead();
  };

  // Aggregate unread + last activity for a contact.
  const chatUnread = (c) => c.threads.some(t => {
    const last = (t.messages || [])[t.messages.length - 1];
    return last && last.role === 'customer' && new Date(t.updated_date || t.created_date) > new Date(chatLastSeen(t.id));
  });
  const chatLastActivity = (c) => c.threads.reduce((m, t) => {
    const d = new Date(t.updated_date || t.created_date); return d > m ? d : m;
  }, new Date(0));
  const chatPreview = (c) => {
    let best = null;
    for (const t of c.threads) {
      const last = (t.messages || [])[t.messages.length - 1];
      if (last && (!best || new Date(t.updated_date || t.created_date) > best.ts)) best = { ts: new Date(t.updated_date || t.created_date), content: last.content, zimmer: t.zimmer_name };
    }
    return best;
  };
  const qUnread = (c) => c.questions.some(q => q.status === 'ממתינה');
  const qLastActivity = (c) => c.questions.reduce((m, q) => { const d = new Date(q.created_date); return d > m ? d : m; }, new Date(0));
  const qPreview = (c) => {
    if (!c.questions.length) return null;
    const last = [...c.questions].sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    return { ts: new Date(last.created_date), content: last.question, zimmer: last.zimmer_name };
  };

  const chatUnreadCount = chatContacts.filter(chatUnread).length;
  const systemUnreadCount = systemMsgs.filter(m => !sysReadSet.has(m.id)).length;
  const questionsUnreadCount = questionContacts.filter(qUnread).length;
  const counts = { questions: questionsUnreadCount, chats: chatUnreadCount, system: systemUnreadCount };

  const selectedChatContact = category === 'chats' ? chatContacts.find(c => c.key === selectedKey) : null;
  const selectedQContact = category === 'questions' ? questionContacts.find(c => c.key === selectedKey) : null;
  const selectedSystem = category === 'system' ? systemMsgs.find(m => m.id === selectedKey) : null;

  // Fetch zimmer context for the selected contact (all zimmers it touched).
  useEffect(() => {
    let alive = true;
    (async () => {
      setZimmerMap({});
      const c = category === 'chats' ? selectedChatContact : selectedQContact;
      if (!c) return;
      const ids = Array.from(new Set(
        (c.threads || []).map(t => t.zimmer_id).filter(Boolean)
          .concat((c.questions || []).map(q => q.zimmer_id).filter(Boolean))
      ));
      const entries = await Promise.all(ids.map(id => api.entities.Zimmer.get(id).catch(() => null)));
      if (!alive) return;
      const m = {};
      entries.forEach(z => { if (z) m[z.id] = z; });
      setZimmerMap(m);
    })();
    return () => { alive = false; };
  }, [selectedKey, category]);

  const subFilters = useMemo(() => {
    if (category === 'questions') return [{ id: 'all', label: 'הכל' }, { id: 'pending', label: 'ממתינות' }, { id: 'answered', label: 'נענו' }];
    if (category === 'chats') return [{ id: 'all', label: 'הכל' }, { id: 'unread', label: 'דורש טיפול' }];
    if (category === 'system') return [{ id: 'all', label: 'הכל' }, { id: 'unread', label: 'לא נקרא' }];
    return [];
  }, [category]);

  const listItems = useMemo(() => {
    let arr = category === 'chats' ? chatContacts : category === 'questions' ? questionContacts : systemMsgs;
    if (category === 'questions') {
      if (subFilter === 'pending') arr = arr.filter(qUnread);
      if (subFilter === 'answered') arr = arr.filter(c => !qUnread(c));
    } else if (category === 'chats') {
      if (subFilter === 'unread') arr = arr.filter(chatUnread);
    } else if (category === 'system') {
      if (subFilter === 'unread') arr = arr.filter(m => !sysReadSet.has(m.id));
    }
    if (search.trim()) {
      const s = search.trim();
      arr = arr.filter(it => {
        if (category === 'chats') { const p = chatPreview(it); return (it.name || '').includes(s) || (p?.content || '').includes(s) || (it.threads || []).some(t => (t.zimmer_name || '').includes(s)); }
        if (category === 'questions') { const p = qPreview(it); return (it.name || '').includes(s) || (p?.content || '').includes(s) || (it.questions || []).some(q => (q.zimmer_name || '').includes(s)); }
        return (it.title || '').includes(s) || (it.body || '').includes(s);
      });
    }
    return arr;
  }, [category, chatContacts, questionContacts, systemMsgs, subFilter, search]);

  const renderItem = (it) => {
    if (category === 'chats') {
      const unread = chatUnread(it);
      const p = chatPreview(it);
      const ts = chatLastActivity(it);
      return (
        <button key={it.key} onClick={() => { it.threads.forEach(t => markChatRead(t.id)); setSelectedKey(it.key); }}
          className="w-full text-right rounded-2xl p-3 flex items-start gap-3 transition-all"
          style={{ background: selectedKey === it.key ? '#F8F7F4' : 'transparent' }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: '#075E54' }}>{(it.name || 'ל').slice(0, 1)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm truncate" style={{ color: '#1A1A1A' }}>{it.name}</span>
              <span className="text-[11px] flex-shrink-0" style={{ color: '#9CA3AF' }}>{fmtMsgTime(ts)}</span>
            </div>
            <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{it.threads.length} צימרים</p>
            {it.threads.some(t => { const m = (t.messages || [])[(t.messages || []).length - 1]; return m && m.role === 'assistant'; }) && (
              <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5" style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>טופל ע"י AI</span>
            )}
            {p && <p className="text-xs truncate mt-0.5" style={{ color: unread ? '#4B5563' : '#9CA3AF' }}>{p.content}</p>}
          </div>
          {unread && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: '#EF4444' }} />}
        </button>
      );
    }
    if (category === 'questions') {
      const unread = qUnread(it);
      const p = qPreview(it);
      const ts = qLastActivity(it);
      return (
        <button key={it.key} onClick={() => setSelectedKey(it.key)}
          className="w-full text-right rounded-2xl p-3 flex items-start gap-3 transition-all"
          style={{ background: selectedKey === it.key ? '#F8F7F4' : 'transparent' }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: unread ? '#F97316' : '#9CA3AF' }}><MessageCircleQuestion size={18} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm truncate" style={{ color: '#1A1A1A' }}>{it.name}</span>
              <span className="text-[11px] flex-shrink-0" style={{ color: '#9CA3AF' }}>{fmtMsgTime(ts)}</span>
            </div>
            <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{it.questions.length} שאלות</p>
            {it.questions.some(q => q.status === 'נענתה' && q.answered_by === 'ai') && (
              <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5" style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>נענה ע"י AI</span>
            )}
            {it.questions.some(q => q.status === 'נענתה' && q.answered_by !== 'ai') && (
              <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5" style={{ background: '#F3F4F6', color: '#6B7280' }}>נענתה ע"י בעלים</span>
            )}
            {p && <p className="text-xs truncate mt-0.5" style={{ color: unread ? '#4B5563' : '#9CA3AF' }}>{p.content}</p>}
          </div>
          {unread && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: '#EF4444' }} />}
        </button>
      );
    }
    const unRead = !sysReadSet.has(it.id);
    return (
      <button key={it.id} onClick={() => { markSysRead(it.id); setSelectedKey(it.id); if (onMarkSystemRead) onMarkSystemRead(); }}
        className="w-full text-right rounded-2xl p-3 flex items-start gap-3 transition-all"
        style={{ background: selectedKey === it.id ? '#F8F7F4' : 'transparent' }}>
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: '#6B7280' }}><Bell size={18} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm truncate" style={{ color: '#1A1A1A' }}>{it.title}</span>
            <span className="text-[11px] flex-shrink-0" style={{ color: '#9CA3AF' }}>{fmtMsgTime(it.created_date)}</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>{it.category || 'הודעה'}</span>
          <p className="text-xs truncate mt-1" style={{ color: '#9CA3AF' }}>{it.body}</p>
        </div>
        {unRead && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: '#EF4444' }} />}
      </button>
    );
  };

  const onAnswered = () => { load(); };
  const onDismissed = async (id) => { await api.entities.UnansweredQuestion.update(id, { status: 'נדחתה' }); load(); };

  const listEl = (
    <div className="h-full min-h-0 rounded-2xl overflow-hidden" style={{ border: '1.5px solid #F0EEE8' }}>
      <MessagesList category={category} onCategory={switchCategory} subFilter={subFilter} onSubFilter={setSubFilter} subFilters={subFilters}
        items={listItems} renderItem={renderItem} search={search} setSearch={setSearch}
        onOpenSettings={() => onNavigate?.('checkin')} counts={counts} />
    </div>
  );

  const centerEl = (
    <div className="h-full min-h-0 rounded-2xl overflow-hidden" style={{ border: '1.5px solid #F0EEE8' }}>
      {category === 'chats' && selectedChatContact ? (
        <MessagesMergedChatWindow key={selectedChatContact.key} contact={selectedChatContact} zimmers={zimmerMap} user={user} />
      ) : category === 'questions' && selectedQContact ? (
        <MessagesMergedQuestionsWindow key={selectedQContact.key} contact={selectedQContact} zimmers={zimmerMap} onAnswered={onAnswered} onDismissed={onDismissed} />
      ) : category === 'system' && selectedSystem ? (
        <SystemDetail message={selectedSystem} onAction={onAction} />
      ) : (
        <EmptyWindow category={category} />
      )}
    </div>
  );

  const ctxEl = (
    <div className="h-full min-h-0 rounded-2xl overflow-hidden" style={{ border: '1.5px solid #F0EEE8' }}>
      {category === 'chats' && selectedChatContact ? (
        <MessagesContactPanel contact={selectedChatContact} zimmers={zimmerMap} onAddBooking={onAddBooking} />
      ) : category === 'questions' && selectedQContact ? (
        <MessagesContactPanel contact={selectedQContact} zimmers={zimmerMap} onAddBooking={onAddBooking} />
      ) : (
        <MessagesContactPanel contact={null} zimmers={zimmerMap} />
      )}
    </div>
  );

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }} className="h-[calc(100dvh-130px)] min-h-[540px]">
      {loading ? (
        <div className="h-full flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : isLg ? (
        <div className="h-full grid gap-3 lg:grid-cols-[300px_1fr_320px] lg:grid-rows-1">
          {listEl}{centerEl}{ctxEl}
        </div>
      ) : (
        <div className="h-full">
          {selectedKey ? (
            <div className="h-full flex flex-col">
              <div className="px-3 py-2 flex items-center gap-2 bg-white rounded-2xl mb-2" style={{ border: '1.5px solid #F0EEE8' }}>
                <button onClick={() => setSelectedKey(null)} className="flex items-center gap-1 text-sm font-bold" style={{ color: '#1A1A1A' }}>
                  <ArrowRight size={18} /> חזרה לרשימה
                </button>
              </div>
              <div className="flex-1 min-h-0">{centerEl}</div>
            </div>
          ) : listEl}
        </div>
      )}
    </div>
  );
}

function SystemDetail({ message, onAction }) {
  const clickable = message.action_type && message.action_entity_id && onAction;
  return (
    <div className="h-full overflow-y-auto p-5 bg-white" dir="rtl">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>{message.category || 'הודעה'}</span>
        <span className="text-xs" style={{ color: '#9CA3AF' }}>{new Date(message.created_date).toLocaleString('he-IL')}</span>
      </div>
      <h2 className="text-lg font-black mb-2" style={{ color: '#1A1A1A' }}>{message.title}</h2>
      {message.body && <p className="text-sm whitespace-pre-wrap" style={{ color: '#4B5563' }}>{message.body}</p>}
      {clickable && (
        <button onClick={() => onAction(message.action_type, message.action_entity_id)} className="mt-4 px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#F97316' }}>עבור לפעולה ←</button>
      )}
    </div>
  );
}

function EmptyWindow({ category }) {
  const label = category === 'chats' ? 'שיחה' : category === 'questions' ? 'שאלה' : 'הודעה';
  return (
    <div className="h-full flex items-center justify-center bg-white" dir="rtl">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#F8F7F4' }}>
          {category === 'chats' ? <MessageCircle size={28} style={{ color: '#D1D5DB' }} /> : <MessageCircleQuestion size={28} style={{ color: '#D1D5DB' }} />}
        </div>
        <p className="text-sm" style={{ color: '#9CA3AF' }}>בחר {label} מימין כדי להתחיל</p>
      </div>
    </div>
  );
}