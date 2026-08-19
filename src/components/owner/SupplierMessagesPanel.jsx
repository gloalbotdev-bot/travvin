import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Send, Truck, MessageSquare, Check, Clock, AlertCircle } from 'lucide-react';

// B2B messaging panel. Owners compose a message to a supplier contact; delivery is
// via the configured WhatsApp webhook (same channel as guest WhatsApp). A log of
// sent messages is shown underneath.
export default function SupplierMessagesPanel({ ownerId }) {
  const [contacts, setContacts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('custom');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [lastStatus, setLastStatus] = useState(null);

  useEffect(() => { load(); }, [ownerId]);

  const load = async () => {
    if (!ownerId) return;
    const [all, sent] = await Promise.all([
      api.entities.Contact.filter({ owner_id: ownerId, type: 'ספק' }, 'name'),
      api.entities.SupplierMessage.filter({ owner_id: ownerId }, '-sent_at', 60),
    ]);
    setContacts(all || []);
    setLogs(sent || []);
  };

  const selected = contacts.find(c => c.id === selectedId);

  const send = async () => {
    setError('');
    setLastStatus(null);
    if (!selected) { setError('בחר ספק'); return; }
    if (!title.trim()) { setError('כותרת חובה'); return; }
    setSending(true);
    try {
      const res = await api.functions.invoke('sendSupplierMessage', {
        contact_id: selected.id,
        contact_name: selected.name,
        contact_phone: selected.phone,
        category,
        title: title.trim(),
        body: body.trim(),
      });
      setLastStatus(res?.delivery?.whatsapp || 'sent');
      setTitle(''); setBody(''); setCategory('custom');
      load();
    } catch (e) {
      setError(e?.message || String(e));
    }
    setSending(false);
  };

  if (!contacts.length) {
    return (
      <div className="rounded-2xl p-10 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <Truck size={32} className="mx-auto mb-3" style={{ color: '#9CA3AF' }} />
        <p className="text-sm" style={{ color: '#9CA3AF' }}>אין ספקים בספר הכתובות. הוסף אנשי קשר מסוג "ספק" בכרטיסיית אנשי קשר.</p>
      </div>
    );
  }

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #E8E5E0', background: '#fff', fontSize: '14px', color: '#1A1A1A', fontFamily: 'Heebo, sans-serif', outline: 'none' };

  return (
    <div dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>הודעות לספקים</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>שליחת הודעות B2B לספקים דרך WhatsApp (חיבור ה-Webhook מגדיר את עצמו באזור ההגדרות).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Composer */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>ספק</label>
            <select style={inputStyle} value={selectedId || ''} onChange={e => setSelectedId(e.target.value)}>
              <option value="">בחר ספק...</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}{c.category ? ` · ${c.category}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>סוג</label>
            <div className="flex gap-2">
              {[{v:'order',l:'הזמנה'},{v:'reminder',l:'תזכורת'},{v:'custom',l:'חופשי'}].map(o => (
                <button key={o.v} onClick={() => setCategory(o.v)}
                  className="px-3 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={category === o.v ? { background: '#F97316', color: '#fff' } : { background: '#F8F7F4', color: '#6B7280' }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>כותרת</label>
            <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="הזמנת מגבות לתאריך..." />
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>תוכן</label>
            <textarea style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} value={body} onChange={e => setBody(e.target.value)} placeholder="כמות, תאריך, הערות..." />
          </div>

          {error && <div className="flex items-center gap-1.5 text-sm" style={{ color: '#EF4444' }}><AlertCircle size={14} /> {error}</div>}
          {lastStatus && (
            <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: lastStatus === 'not_configured' ? '#D97706' : '#16A34A' }}>
              {lastStatus === 'not_configured' ? <AlertCircle size={14} /> : <Check size={14} />}
              {lastStatus === 'sent' ? 'נשלח ב-WhatsApp' : lastStatus === 'not_configured' ? 'נשמר — WhatsApp לא מוגדר עדיין' : `סטטוס: ${lastStatus}`}
            </div>
          )}

          <button onClick={send} disabled={sending || !selected}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: '#F97316' }}>
            <Send size={16} /> {sending ? 'שולח...' : 'שלח לספק'}
          </button>
        </div>

        {/* Log */}
        <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
            <MessageSquare size={15} style={{ color: '#F97316' }} /> הודעות אחרונות
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>{logs.length}</span>
          </h3>
          {logs.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#9CA3AF' }}>אין הודעות עדיין</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-auto">
              {logs.map(m => (
                <div key={m.id} className="rounded-xl p-3" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8' }}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>{m.contact_name}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>{m.category}</span>
                    <span className="text-[11px] flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                      <Clock size={10} /> {m.sent_at ? new Date(m.sent_at).toLocaleString('he-IL') : ''}
                    </span>
                    <span className="text-[11px] mr-auto font-semibold"
                      style={{ color: m.delivery_status?.whatsapp === 'sent' ? '#16A34A' : m.delivery_status?.whatsapp === 'not_configured' ? '#D97706' : '#EF4444' }}>
                      {m.delivery_status?.whatsapp === 'sent' ? '✓ WhatsApp' : m.delivery_status?.whatsapp === 'not_configured' ? ' WhatsApp לא מוגדר' : 'WhatsApp נכשל'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{m.title}</p>
                  {m.body && <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: '#4B5563' }}>{m.body}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}