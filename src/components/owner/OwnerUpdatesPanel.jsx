import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/api/client';
import { Bell, MessageCircleQuestion, ArrowRight, MessageCircle } from 'lucide-react';
import MessagesList from './messages/MessagesList';
import MessagesMergedChatWindow from './messages/MessagesMergedChatWindow';
import MessagesMergedQuestionsWindow from './messages/MessagesMergedQuestionsWindow';
import MessagesContactPanel from './messages/MessagesContactPanel';
import ContactAvatar from './messages/ContactAvatar';
import { buildPhoneLookup, groupChatsByContact, groupQuestionsByContact } from './messages/groupContacts';
import { fmtMsgTime } from './messages/timeFormat';
import { useContactBooking } from './messages/useContactBooking';
import unreadDot from '@/assets/owner/messages/unread-dot.svg';

const SYS_READ_KEY = 'zb_read_sysmsgs_owner';
const loadSysReadSet = () => { try { return new Set(JSON.parse(localStorage.getItem(SYS_READ_KEY) || '[]')); } catch { return new Set(); } };
const chatLastSeen = (id) => localStorage.getItem(`zb_lastSeen_chat_${id}`) || '1970-01-01T00:00:00.000Z';
const markChatRead = (id) => localStorage.setItem(`zb_lastSeen_chat_${id}`, new Date().toISOString());
const markSysRead = (id) => { const s = loadSysReadSet(); s.add(id); localStorage.setItem(SYS_READ_KEY, JSON.stringify([...s])); };

export default function OwnerUpdatesPanel({ user, onAction, focusQuestionId, focusChatId, onFocusConsumed, onMarkSystemRead, onAddBooking, onNavigate }) {
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
  const consumedChatFocus = useRef(null);
  const consumedQuestionFocus = useRef(null);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const sysReadSet = loadSysReadSet();

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsLg(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Per-entity load so one failing query (e.g. SystemMessage) does not wipe questions/chats.
  const load = async ({ silent = false } = {}) => {
    const uid = userIdRef.current;
    if (!uid) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    const asArray = (v) => (Array.isArray(v) ? v : []);
    // Wrap each call so a missing entity client (undefined.filter) becomes a rejected
    // settlement instead of crashing the whole load before allSettled runs.
    const safe = (fn) => Promise.resolve().then(fn);
    const settled = await Promise.allSettled([
      safe(() => api.entities.DirectChat.filter({ owner_id: uid }, '-updated_date')),
      safe(() => api.entities.SystemMessage.filter({ audience: 'owner' }, '-created_date', 30)),
      safe(() => api.entities.UnansweredQuestion.filter({ owner_id: uid }, '-created_date')),
      safe(() => api.entities.GuestProfile?.filter({ owner_id: uid }) ?? []),
    ]);
    const [directR, sysR, qsR, profilesR] = settled;
    if (directR.status === 'fulfilled') setThreads(asArray(directR.value));
    else console.warn('[OwnerUpdatesPanel] DirectChat.load failed', directR.reason);
    if (sysR.status === 'fulfilled') {
      setSystemMsgs(asArray(sysR.value).filter(
        (m) => !m.target_user_ids?.length || (m.target_user_ids || []).includes(uid),
      ));
    } else console.warn('[OwnerUpdatesPanel] SystemMessage.load failed', sysR.reason);
    if (qsR.status === 'fulfilled') setQuestions(asArray(qsR.value));
    else console.warn('[OwnerUpdatesPanel] UnansweredQuestion.load failed', qsR.reason);
    if (profilesR.status === 'fulfilled') setGuestProfiles(asArray(profilesR.value));
    else {
      console.warn('[OwnerUpdatesPanel] GuestProfile.load failed', profilesR.reason);
      setGuestProfiles([]);
    }
    if (!silent) setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    const u1 = api.entities.DirectChat.subscribe(() => { load({ silent: true }); });
    const u2 = api.entities.UnansweredQuestion.subscribe(() => { load({ silent: true }); });
    const u3 = api.entities.SystemMessage.subscribe(() => { load({ silent: true }); });
    return () => { u1(); u2(); u3(); };
  }, [user?.id]);

  const lookup = useMemo(() => buildPhoneLookup(guestProfiles), [guestProfiles]);
  // Hide threads opened but never messaged — inbox only shows real conversations.
  const activeThreads = useMemo(
    () => (threads || []).filter((t) => (t.messages || []).length > 0),
    [threads],
  );
  const chatContacts = useMemo(() => groupChatsByContact(activeThreads, lookup), [activeThreads, lookup]);
  const questionContacts = useMemo(() => groupQuestionsByContact(questions, lookup), [questions, lookup]);

  // Notification deep-links → resolve after data loads, then clear focus in parent
  // so a stale id cannot keep locking category/subFilter on later visits.
  useEffect(() => {
    if (!focusChatId) {
      consumedChatFocus.current = null;
      return;
    }
    if (loading) return;
    if (consumedChatFocus.current === focusChatId) return;
    preferredCategoryDone.current = true;
    setCategory('chats');
    setSubFilter('all');
    const c = chatContacts.find((x) => x.threads.some((t) => t.id === focusChatId));
    if (c) setSelectedKey(c.key);
    consumedChatFocus.current = focusChatId;
    onFocusConsumed?.('chat');
  }, [focusChatId, chatContacts, loading, onFocusConsumed]);

  useEffect(() => {
    if (!focusQuestionId) {
      consumedQuestionFocus.current = null;
      return;
    }
    if (loading) return;
    if (consumedQuestionFocus.current === focusQuestionId) return;
    preferredCategoryDone.current = true;
    setCategory('questions');
    // Use "all" so an answered/dismissed focused question still appears in the list.
    setSubFilter('all');
    const c = questionContacts.find((x) => x.questions.some((q) => q.id === focusQuestionId));
    if (c) setSelectedKey(c.key);
    consumedQuestionFocus.current = focusQuestionId;
    onFocusConsumed?.('question');
  }, [focusQuestionId, questionContacts, loading, onFocusConsumed]);

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
  // Totals (not only unread) — used by empty-state hints across categories.
  const totals = { questions: questionContacts.length, chats: chatContacts.length, system: systemMsgs.length };

  const selectedChatContact = category === 'chats' ? chatContacts.find(c => c.key === selectedKey) : null;
  const selectedQContact = category === 'questions' ? questionContacts.find(c => c.key === selectedKey) : null;
  const selectedSystem = category === 'system' ? systemMsgs.find(m => m.id === selectedKey) : null;
  const selectedContact = selectedChatContact || selectedQContact || null;
  const { booking: selectedBooking, loading: loadingBooking } = useContactBooking(selectedContact);

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

  const uniqueZimmerNames = (list) => Array.from(new Set((list || []).map(x => x.zimmer_name).filter(Boolean))).join(', ');

  const renderItem = (it) => {
    if (category === 'chats') {
      const unread = chatUnread(it);
      const p = chatPreview(it);
      return (
        <InboxRow key={it.key}
          selected={selectedKey === it.key}
          onClick={() => { it.threads.forEach(t => markChatRead(t.id)); setSelectedKey(it.key); }}
          avatar={<ContactAvatar name={it.name} />}
          title={it.name}
          subtitle={uniqueZimmerNames(it.threads)}
          preview={p?.content}
          time={fmtMsgTime(chatLastActivity(it))}
          unread={unread} />
      );
    }
    if (category === 'questions') {
      const unread = qUnread(it);
      const p = qPreview(it);
      const aiAnswered = it.questions.some(q => q.status === 'נענתה' && q.answered_by === 'ai');
      const ownerAnswered = it.questions.some(q => q.status === 'נענתה' && q.answered_by !== 'ai');
      return (
        <InboxRow key={it.key}
          selected={selectedKey === it.key}
          onClick={() => setSelectedKey(it.key)}
          avatar={<ContactAvatar name={it.name} />}
          title={it.name}
          subtitle={uniqueZimmerNames(it.questions)}
          preview={p?.content}
          time={fmtMsgTime(qLastActivity(it))}
          unread={unread}
          tags={[aiAnswered && 'נענה ע"י AI', ownerAnswered && 'נענתה ע"י בעלים'].filter(Boolean)} />
      );
    }
    const unRead = !sysReadSet.has(it.id);
    return (
      <InboxRow key={it.id}
        selected={selectedKey === it.id}
        onClick={() => { markSysRead(it.id); setSelectedKey(it.id); if (onMarkSystemRead) onMarkSystemRead(it.id); }}
        avatar={<ContactAvatar><Bell size={22} /></ContactAvatar>}
        title={it.title}
        subtitle={it.category || 'הודעה'}
        preview={it.body}
        time={fmtMsgTime(it.created_date)}
        unread={unRead} />
    );
  };

  const onAnswered = () => { load(); };
  const onDismissed = async (id) => { await api.entities.UnansweredQuestion.update(id, { status: 'נדחתה' }); load(); };

  const listEl = (
    <div className="h-full min-h-0 overflow-hidden bg-white lg:border-l lg:border-[#E5E5E5]">
      <MessagesList category={category} onCategory={switchCategory} subFilter={subFilter} onSubFilter={setSubFilter} subFilters={subFilters}
        items={listItems} renderItem={renderItem} search={search} setSearch={setSearch}
        onOpenSettings={() => onNavigate?.('checkin')} counts={counts} totals={totals} />
    </div>
  );

  const centerEl = (
    <div className="h-full min-h-0 overflow-hidden bg-white">
      {category === 'chats' && selectedChatContact ? (
        <MessagesMergedChatWindow key={selectedChatContact.key} contact={selectedChatContact} zimmers={zimmerMap} booking={selectedBooking} />
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
    <div className="h-full min-h-0 overflow-hidden bg-white border-r border-[#E5E5E5]">
      {selectedContact ? (
        <MessagesContactPanel contact={selectedContact} zimmers={zimmerMap} booking={selectedBooking} loadingBooking={loadingBooking} onAddBooking={onAddBooking} />
      ) : (
        <MessagesContactPanel contact={null} zimmers={zimmerMap} />
      )}
    </div>
  );

  return (
    <div dir="rtl" className="font-simona h-full min-h-[540px] bg-white">
      {loading ? (
        <div className="h-full flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-[#E5E5E5] border-t-[#0B3838] rounded-full animate-spin" />
        </div>
      ) : isLg ? (
        <div className="h-full grid grid-rows-1 lg:grid-cols-[300px_1fr_340px] min-[1600px]:grid-cols-[370px_1fr_446px]">
          {listEl}{centerEl}{ctxEl}
        </div>
      ) : (
        <div className="h-full">
          {selectedKey ? (
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 flex items-center gap-2 bg-white border-b border-[#E5E5E5]">
                <button onClick={() => setSelectedKey(null)} className="flex items-center gap-1 text-[15px]" style={{ color: '#0B3838', fontWeight: 500 }}>
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

function InboxRow({ selected, onClick, avatar, title, subtitle, preview, time, unread, tags = [] }) {
  return (
    <button type="button" onClick={onClick} aria-current={selected ? 'true' : undefined}
      className="font-simona w-full text-right rounded-[12px] p-[16px] flex items-start gap-[12px] transition-colors hover:bg-[#FAFAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0B3838]"
      style={{ background: selected ? '#FAFAFA' : '#fff' }}>
      {avatar}
      <div className="flex-1 min-w-0 flex flex-col gap-[2px] items-start leading-normal">
        <div className="flex items-start gap-[2px] max-w-full">
          <span className="text-[15px] truncate" style={{ color: '#0B3838', fontWeight: unread ? 700 : 500 }}>{title}</span>
          {unread && <img src={unreadDot} alt="" width={8} height={8} className="flex-shrink-0" />}
        </div>
        {subtitle && <span className="text-[12px] truncate max-w-full" style={{ color: '#6B7280' }}>{subtitle}</span>}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#EFEFEF', color: '#0B3838', fontWeight: 500 }}>{t}</span>
            ))}
          </div>
        )}
        {preview && <span className="text-[13px] truncate w-full" style={{ color: unread ? '#0B3838' : '#6B7280' }}>{preview}</span>}
      </div>
      <span className="text-[11px] whitespace-nowrap flex-shrink-0" style={{ color: unread || selected ? '#6B7280' : '#9CA3AF' }}>{time}</span>
    </button>
  );
}

function SystemDetail({ message, onAction }) {
  const clickable = message.action_type && message.action_entity_id && onAction;
  return (
    <div className="font-simona h-full overflow-y-auto px-[32px] py-[24px] bg-white" dir="rtl">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[13px] px-[8px] py-[3px] rounded-full" style={{ background: '#FFFF00', color: '#0B3838', fontWeight: 500 }}>{message.category || 'הודעה'}</span>
        <span className="text-[13px]" style={{ color: '#6B7280' }}>{new Date(message.created_date).toLocaleString('he-IL')}</span>
      </div>
      <h2 className="font-simpler text-[24px] mb-3" style={{ color: '#0B3838', fontWeight: 600 }}>{message.title}</h2>
      {message.body && <p className="text-[15px] leading-[1.5] whitespace-pre-wrap" style={{ color: '#0B3838' }}>{message.body}</p>}
      {clickable && (
        <button onClick={() => onAction(message.action_type, message.action_entity_id)} className="font-simpler mt-5 px-6 py-[12px] rounded-[35px] text-[16px] text-white hover:opacity-90" style={{ background: '#0B3838' }}>עבור לפעולה ←</button>
      )}
    </div>
  );
}

function EmptyWindow({ category }) {
  const label = category === 'chats' ? 'שיחה' : category === 'questions' ? 'שאלה' : 'הודעה';
  return (
    <div className="font-simona h-full flex items-center justify-center bg-white" dir="rtl">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#FAFAFA' }}>
          {category === 'chats' ? <MessageCircle size={28} style={{ color: '#9CA3AF' }} /> : <MessageCircleQuestion size={28} style={{ color: '#9CA3AF' }} />}
        </div>
        <p className="text-[15px]" style={{ color: '#6B7280' }}>בחר {label} מימין כדי להתחיל</p>
      </div>
    </div>
  );
}