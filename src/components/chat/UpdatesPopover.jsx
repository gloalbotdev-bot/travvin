import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Bell, ChevronLeft } from 'lucide-react';

export default function UpdatesPopover({ userId, fullUserName, onGoAll }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sys, allQ] = await Promise.all([
          api.entities.SystemMessage.filter({ audience: 'customer' }, '-created_date', 30),
          api.entities.UnansweredQuestion.filter({ created_by_id: userId }, '-created_date', 100),
        ]);
        if (!alive) return;
        const mineSys = (sys || []).filter(m => !m.target_user_ids?.length || (m.target_user_ids || []).includes(userId));
        const mineQ = allQ || [];
        const feed = [];
        mineSys.forEach(m => feed.push({
          key: 's_' + m.id, kind: 'system', date: m.created_date, title: m.title, body: m.body,
          color: m.category === 'הצעה' ? '#EA580C' : m.category === 'עדכון' ? '#075E54' : '#F97316',
          badge: m.category || 'הודעה',
        }));
        mineQ.forEach(q => {
          if (q.status === 'ממתינה') feed.push({ key: 'p_' + q.id, kind: 'pending', date: q.created_date, title: 'שאלה ממתינה לתשובה', body: q.question, color: '#D97706', badge: 'ממתינה', zimmerName: q.zimmer_name });
          else if (q.status === 'נענתה') feed.push({ key: 'a_' + q.id, kind: 'answered', date: q.answered_at || q.created_date, title: 'תשובה התקבלה מבעל הצימר', body: q.question, answer: q.owner_answer, color: '#22C55E', badge: 'תשובה', zimmerName: q.zimmer_name });
          else if (q.status === 'נדחתה') feed.push({ key: 'r_' + q.id, kind: 'rejected', date: q.created_date, title: 'שאלה נדחתה', body: q.question, color: '#9CA3AF', badge: 'נדחית', zimmerName: q.zimmer_name });
        });
        feed.sort((a, b) => new Date(b.date) - new Date(a.date));
        setItems(feed.slice(0, 6));
      } catch (e) { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId]);

  return (
    <div dir="rtl" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: '1px solid #F0EEE8', width: '340px', maxWidth: '90vw', maxHeight: '70vh', display: 'flex', flexDirection: 'column', fontFamily: 'Heebo, sans-serif', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0EEE8', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bell size={16} style={{ color: '#F97316' }} />
        <span style={{ fontWeight: 800, fontSize: 14, color: '#1A1A1A' }}>עדכונים אחרונים</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 28 }}>
            <div style={{ width: 26, height: 26, border: '2.5px solid #FED7AA', borderTopColor: '#F97316', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 28, color: '#9CA3AF', fontSize: 13 }}>אין עדכונים עדיין</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(it => (
              <div key={it.key} style={{ background: '#F8F7F4', border: '1px solid #F0EEE8', borderRight: `3px solid ${it.color}`, borderRadius: '12px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: `${it.color}1a`, color: it.color }}>{it.badge}</span>
                  {it.zimmerName && <span style={{ fontSize: 10, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>· {it.zimmerName}</span>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A1A', marginBottom: 2 }}>{it.title}</div>
                {it.body && <div style={{ fontSize: 12, color: '#4B5563', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.body}</div>}
                {it.kind === 'answered' && it.answer && (
                  <div style={{ marginTop: 6, background: 'rgba(34,197,94,0.08)', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: '#16A34A' }}>✅ {it.answer}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: 10, borderTop: '1px solid #F0EEE8' }}>
        <button onClick={onGoAll} style={{ width: '100%', background: '#F97316', color: '#fff', fontWeight: 700, fontSize: 13, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          עבור לעדכונים <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  );
}