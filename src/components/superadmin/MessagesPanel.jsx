import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Megaphone, Users, Home, Send, Trash2, CheckCheck } from 'lucide-react';
import RecipientPicker from '@/components/superadmin/RecipientPicker';

const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A', borderRadius: '12px', outline: 'none' };

export default function MessagesPanel() {
  const [users, setUsers] = useState([]);
  const [zimmers, setZimmers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  const [drafts, setDrafts] = useState({
    customer: { mode: 'all', category: 'הודעה', title: '', body: '', selected: new Set() },
    owner: { mode: 'all', category: 'הודעה', title: '', body: '', selected: new Set() },
  });

  useEffect(() => { loadAll(); loadMessages(); }, []);

  const loadAll = async () => {
    try {
      const [u, z] = await Promise.all([base44.entities.User.list(), base44.entities.Zimmer.list()]);
      setUsers(u);
      setZimmers(z);
    } catch (e) { /* silent */ }
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.SystemMessage.list('-created_date', 80);
      setMessages(data);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  const ownerIds = new Set(zimmers.map(z => z.owner_id).filter(Boolean));
  const customers = users.filter(u => u.role === 'user');
  const owners = users.filter(u => u.role === 'owner' || u.role === 'admin' || ownerIds.has(u.id));

  const send = async (audience) => {
    const d = drafts[audience];
    if (!d.title.trim()) return;
    if (d.mode === 'selected' && d.selected.size === 0) { alert('בחר לפחות נמען אחד או עבור למצב "כולם".'); return; }
    setSending(audience);
    try {
      const target_user_ids = d.mode === 'all' ? [] : Array.from(d.selected);
      const audienceLabel = audience === 'customer' ? 'הלקוחות' : 'בעלי המתחמים';
      const target_label = d.mode === 'all' ? `כל ${audienceLabel}` : `${d.selected.size} נבחרו מ${audienceLabel}`;
      await base44.entities.SystemMessage.create({
        audience, category: d.category, title: d.title.trim(), body: d.body.trim(),
        target_user_ids, target_label,
      });
      setDrafts(prev => ({ ...prev, [audience]: { mode: 'all', category: 'הודעה', title: '', body: '', selected: new Set() } }));
      loadMessages();
    } catch (e) {
      alert('שגיאה בשליחת ההודעה. ודא שיש לך הרשאת אדמין.\n' + (e?.message || ''));
    }
    setSending(null);
  };

  const remove = async (id) => {
    if (!confirm('למחוק את ההודעה?')) return;
    await base44.entities.SystemMessage.delete(id);
    loadMessages();
  };

  const setField = (audience, field, value) => setDrafts(prev => ({ ...prev, [audience]: { ...prev[audience], [field]: value } }));
  const toggleRecipient = (audience, uid) => setDrafts(prev => {
    const sel = new Set(prev[audience].selected);
    if (sel.has(uid)) sel.delete(uid); else sel.add(uid);
    return { ...prev, [audience]: { ...prev[audience], selected: sel } };
  });
  const clearRecipients = (audience) => setDrafts(prev => ({ ...prev, [audience]: { ...prev[audience], selected: new Set() } }));

  const customerMsgs = messages.filter(m => m.audience === 'customer');
  const ownerMsgs = messages.filter(m => m.audience === 'owner');

  return (
    <div dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: '#1A1A1A' }}><Megaphone size={22} style={{ color: '#F97316' }} /> הודעות ועדכונים</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>שליחה לכל הלקוחות/בעלי המתחמים, או בחירה מרשימת המשתמשים הרשומים</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Column
          icon={Users} title="לקוחות" accent="#F97316"
          recipientList={customers}
          draft={drafts.customer}
          setField={(f, v) => setField('customer', f, v)}
          toggleRecipient={(uid) => toggleRecipient('customer', uid)}
          clearRecipients={() => clearRecipients('customer')}
          sending={sending === 'customer'} onSend={() => send('customer')}
          messages={customerMsgs} loading={loading} onRemove={remove}
        />
        <Column
          icon={Home} title="בעלי מתחמים" accent="#075E54"
          recipientList={owners}
          draft={drafts.owner}
          setField={(f, v) => setField('owner', f, v)}
          toggleRecipient={(uid) => toggleRecipient('owner', uid)}
          clearRecipients={() => clearRecipients('owner')}
          sending={sending === 'owner'} onSend={() => send('owner')}
          messages={ownerMsgs} loading={loading} onRemove={remove}
        />
      </div>
    </div>
  );
}

function Column({ icon: Icon, title, accent, recipientList, draft, setField, toggleRecipient, clearRecipients, sending, onSend, messages, loading, onRemove }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: `1.5px solid ${accent}22` }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: `${accent}0d`, borderBottom: `1.5px solid ${accent}22` }}>
        <Icon size={18} style={{ color: accent }} />
        <h2 className="font-black text-sm" style={{ color: accent }}>{title}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full mr-auto" style={{ background: `${accent}1a`, color: accent }}>{recipientList.length} רשומים</span>
      </div>

      <div className="p-5 space-y-3">
        {/* Recipient mode */}
        <div className="flex gap-2">
          <button type="button" onClick={() => setField('mode', 'all')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
            style={draft.mode === 'all' ? { background: accent, color: '#fff', border: `1.5px solid ${accent}` } : { background: '#F8F7F4', color: '#6B7280', border: '1.5px solid #E8E5E0' }}>
            <CheckCheck size={13} /> כל {title}
          </button>
          <button type="button" onClick={() => setField('mode', 'selected')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
            style={draft.mode === 'selected' ? { background: accent, color: '#fff', border: `1.5px solid ${accent}` } : { background: '#F8F7F4', color: '#6B7280', border: '1.5px solid #E8E5E0' }}>
            <Users size={13} /> נמענים נבחרים
          </button>
        </div>

        {draft.mode === 'selected' && (
          <RecipientPicker users={recipientList} selected={draft.selected} accent={accent}
            onToggle={toggleRecipient} onClear={clearRecipients} />
        )}

        {/* Category */}
        <label className="text-xs font-semibold block" style={{ color: '#6B7280' }}>סוג</label>
        <div className="flex gap-2">
          {['הודעה', 'עדכון', 'הצעה'].map(c => (
            <button key={c} type="button" onClick={() => setField('category', c)}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
              style={draft.category === c
                ? { background: `${accent}14`, color: accent, border: `1.5px solid ${accent}55` }
                : { background: '#F8F7F4', color: '#6B7280', border: '1.5px solid #E8E5E0' }}>
              {c}
            </button>
          ))}
        </div>

        <input value={draft.title} onChange={e => setField('title', e.target.value)} placeholder="כותרת..."
          className="w-full px-4 py-2.5 text-sm" style={inputStyle} />
        <textarea value={draft.body} onChange={e => setField('body', e.target.value)} rows={3} placeholder="גוף ההודעה..."
          className="w-full px-4 py-2.5 text-sm resize-none" style={inputStyle} />

        <button onClick={onSend} disabled={!draft.title.trim() || sending}
          className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 hover:opacity-90"
          style={{ background: accent }}>
          <Send size={15} /> {sending ? 'שולח...' : `שלח ל${title}`}
        </button>
      </div>

      {/* History */}
      <div className="px-5 pb-5">
        <h3 className="text-xs font-bold mb-2" style={{ color: '#9CA3AF' }}>היסטוריה</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: `${accent}33`, borderTopColor: accent }} /></div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: '#9CA3AF' }}>אין הודעות עדיין</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {messages.map(m => (
              <div key={m.id} className="rounded-xl p-3 flex items-start justify-between gap-2" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${accent}14`, color: accent }}>{m.category || 'הודעה'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#E8E5E0', color: '#6B7280' }}>{m.target_label || `כל ${title}`}</span>
                    <span className="text-[10px]" style={{ color: '#D1D5DB' }}>{new Date(m.created_date).toLocaleDateString('he-IL')}</span>
                  </div>
                  <p className="font-semibold text-xs" style={{ color: '#1A1A1A' }}>{m.title}</p>
                  {m.body && <p className="text-[11px] mt-0.5 whitespace-pre-wrap" style={{ color: '#4B5563' }}>{m.body}</p>}
                </div>
                <button onClick={() => onRemove(m.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}