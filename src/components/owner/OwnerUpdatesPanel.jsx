import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Bell, MessageCircle, MessageCircleQuestion } from 'lucide-react';
import QuestionsPanel from '@/components/owner/QuestionsPanel';
import DirectChat from '@/components/chat/DirectChat';

const RED_DOT = <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#EF4444' }} />;

const SYS_READ_KEY = 'zb_read_sysmsgs_owner';
const loadSysReadSet = () => {
  try { return new Set(JSON.parse(localStorage.getItem(SYS_READ_KEY) || '[]')); }
  catch { return new Set(); }
};
const chatLastSeen = (id) => localStorage.getItem(`zb_lastSeen_chat_${id}`) || '1970-01-01T00:00:00.000Z';
const markChatRead = (id) => localStorage.setItem(`zb_lastSeen_chat_${id}`, new Date().toISOString());

export default function OwnerUpdatesPanel({ user, onAction, focusQuestionId, focusChatId, initialSubtab, onMarkSystemRead }) {
  const [subtab, setSubtab] = useState(initialSubtab || 'questions');
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systemMsgs, setSystemMsgs] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [pendingQuestions, setPendingQuestions] = useState([]);

  const sysReadSet = loadSysReadSet();
  const chatUnreadCount = threads.filter(t => {
    const last = (t.messages || [])[t.messages.length - 1];
    return last && last.role === 'customer' && new Date(t.updated_date || t.created_date) > new Date(chatLastSeen(t.id));
  }).length;
  const systemUnreadCount = systemMsgs.filter(m => !sysReadSet.has(m.id)).length;
  const questionsUnreadCount = pendingQuestions.length;

  const switchSubtab = (id) => {
    setSubtab(id);
    if (id === 'system') {
      if (onMarkSystemRead) onMarkSystemRead();
    }
  };

  useEffect(() => {
    if (!focusChatId) return;
    setSubtab('chats');
    (async () => {
      try { const t = await api.entities.DirectChat.get(focusChatId); if (t) setActiveThread(t); } catch {}
    })();
  }, [focusChatId]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [direct, sys, qs] = await Promise.all([
        api.entities.DirectChat.filter({ owner_id: user.id }, '-updated_date'),
        api.entities.SystemMessage.filter({ audience: 'owner' }, '-created_date', 30),
        api.entities.UnansweredQuestion.filter({ owner_id: user.id, status: 'ממתינה' }, '-created_date', 50),
      ]);
      setThreads(direct || []);
      setSystemMsgs((sys || []).filter(m => !m.target_user_ids?.length || (m.target_user_ids || []).includes(user?.id)));
      setPendingQuestions(qs || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  if (activeThread) {
    return <DirectChat thread={activeThread} isOwner={true} user={user} counterpartName={activeThread.customer_name} zimmerName={activeThread.zimmer_name} onClose={() => { setActiveThread(null); load(); }} />;
  }

  const subTabs = [
    { id: 'questions', label: 'שאלות לקוחות', icon: MessageCircleQuestion, count: questionsUnreadCount },
    { id: 'chats', label: 'צ\'אטים ישירים', icon: MessageCircle, count: chatUnreadCount },
    { id: 'system', label: 'הודעות מערכת', icon: Bell, count: systemUnreadCount },
  ];

  return (
    <div dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>עדכונים והודעות</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>שאלות לקוחות, צ'אטים ישירים והודעות מערכת</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {subTabs.map(({ id, label, icon: Icon, count }) => (
          <button key={id} onClick={() => switchSubtab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all relative"
            style={subtab === id
              ? { background: '#F97316', color: '#fff', border: '1.5px solid #F97316' }
              : { background: '#fff', color: '#6B7280', border: '1.5px solid #E8E5E0' }}>
            <Icon size={14} /> {label}
            {count > 0 && <span className="mr-1">{RED_DOT}</span>}
            {count > 0 && (
              <span className="text-[10px] font-bold text-white rounded-full flex items-center justify-center" style={{ background: '#EF4444', minWidth: '16px', height: '16px', padding: '0 4px' }}>{count > 99 ? '99+' : count}</span>
            )}
          </button>
        ))}
      </div>

      {subtab === 'questions' && <QuestionsPanel ownerId={user?.id} focusQuestionId={focusQuestionId} />}

      {subtab === 'chats' && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-24 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <MessageCircle size={40} className="mx-auto mb-4" style={{ color: '#E8E5E0' }} />
              <h3 className="text-lg font-black mb-2" style={{ color: '#1A1A1A' }}>אין צ'אטים ישירים עדיין</h3>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>כשלקוח יפתח צ'אט ישיר איתך מתוך פרטי הצימר או מהאזור האישי, השיחה תופיע כאן</p>
            </div>
          ) : (
            <div className="space-y-2">
              {threads.map(t => {
                const last = (t.messages || [])[t.messages.length - 1];
                const unread = last && last.role === 'customer' && new Date(t.updated_date || t.created_date) > new Date(chatLastSeen(t.id));
                return (
                  <button key={t.id} onClick={() => { markChatRead(t.id); setActiveThread(t); }}
                    className="w-full text-right rounded-2xl p-4 flex items-center justify-between gap-3 hover:shadow-md transition-all relative"
                    style={{ background: '#fff', border: `1.5px solid ${unread ? '#FCA5A5' : '#F0EEE8'}` }}>
                    <div className="min-w-0 flex items-center gap-2">
                      {unread && RED_DOT}
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: unread ? '#1A1A1A' : '#6B7280' }}>{t.customer_name || 'לקוח'} · {t.zimmer_name}</p>
                        {last && <p className="text-xs truncate mt-0.5" style={{ color: unread ? '#4B5563' : '#9CA3AF' }}>{last.role === 'owner' ? 'אתה: ' : 'לקוח: '}{last.content}</p>}
                      </div>
                    </div>
                    <span className="text-xs whitespace-nowrap" style={{ color: '#D1D5DB' }}>{new Date(t.updated_date || t.created_date).toLocaleDateString('he-IL')}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subtab === 'system' && (
        <div className="space-y-2">
          {systemMsgs.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <Bell size={36} className="mx-auto mb-3" style={{ color: '#E8E5E0' }} />
              <p className="text-sm" style={{ color: '#9CA3AF' }}>אין הודעות מערכת כרגע</p>
            </div>
          ) : systemMsgs.map(m => {
            const clickable = m.action_type && m.action_entity_id && onAction;
            const Wrapper = clickable ? 'button' : 'div';
            const unReadSys = !sysReadSet.has(m.id);
            return (
              <Wrapper
                key={m.id}
                onClick={clickable ? () => onAction(m.action_type, m.action_entity_id) : undefined}
                className={`rounded-2xl p-4 w-full text-right transition-all ${clickable ? 'cursor-pointer hover:shadow-md' : ''}`}
                style={{ background: '#fff', border: `1.5px solid ${unReadSys ? '#FCA5A5' : '#F0EEE8'}` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  {unReadSys && RED_DOT}
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>{m.category || 'הודעה'}</span>
                  <span className="text-xs" style={{ color: '#D1D5DB' }}>{new Date(m.created_date).toLocaleDateString('he-IL')}</span>
                  {clickable && <span className="text-xs mr-auto font-semibold" style={{ color: '#F97316' }}>עבור לפעולה ←</span>}
                </div>
                <p className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{m.title}</p>
                {m.body && <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: '#4B5563' }}>{m.body}</p>}
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}