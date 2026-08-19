import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { MessageCircle, MapPin, Phone, KeyRound, Sparkles, Bell, CheckCircle2, Clock, Send } from 'lucide-react';

const CATEGORY_META = {
  search_start: { label: 'התחלת חיפוש', icon: Sparkles, color: '#0EA5E9' },
  booking_confirmation: { label: 'אישור הזמנה', icon: CheckCircle2, color: '#22C55E' },
  pre_checkin: { label: 'לפני צ׳ק-אין', icon: Clock, color: '#F97316' },
  checkin_day: { label: 'בוקר החופשה', icon: Sparkles, color: '#F97316' },
  checkin: { label: 'צ׳ק-אין', icon: CheckCircle2, color: '#22C55E' },
  post_checkin: { label: 'אחרי צ׳ק-אין', icon: Bell, color: '#22C55E' },
  morning_checkout: { label: 'בוקר צ׳ק-אאוט', icon: Clock, color: '#F97316' },
  pre_checkout: { label: 'לפני צ׳ק-אאוט', icon: Clock, color: '#F97316' },
  checkout: { label: 'צ׳ק-אאוט', icon: CheckCircle2, color: '#6B7280' },
  review_reminder: { label: 'תזכורת ביקורת', icon: Bell, color: '#EA580C' },
  ai_recommendations: { label: 'המלצות AI', icon: Sparkles, color: '#8B5CF6' },
  custom: { label: 'הודעה', icon: MessageCircle, color: '#6B7280' },
};

export default function CustomerMessagesTab({ user, focusBookingId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => { load(); }, [user]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await api.entities.GuestMessage.filter({ customer_id: user.id }, '-created_date', 60);
      setMessages(data || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  // Mark messages as read on open
  const markRead = async (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    const m = messages.find(mm => mm.id === id);
    if (m && !m.read) {
      try { await api.entities.GuestMessage.update(id, { read: true }); } catch {}
      setMessages(prev => prev.map(mm => mm.id === id ? { ...mm, read: true } : mm));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>הודעות</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>כל ההודעות שלך מהמערכת ומבעלי הצימרים — מתקבלות גם באפליקציה וגם ב-WhatsApp</p>
      </div>

      {messages.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <MessageCircle size={40} style={{ color: '#D1D5DB', margin: '0 auto 12px' }} />
          <p className="text-sm font-semibold" style={{ color: '#9CA3AF' }}>אין הודעות עדיין</p>
          <p className="text-xs mt-1" style={{ color: '#D1D5DB' }}>כאשר תזמין צימר, תקבל כאן את כל פרטי החופשה וההמלצות</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => {
            const meta = CATEGORY_META[m.category] || CATEGORY_META.custom;
            const Icon = meta.icon;
            const isOpen = expanded[m.id];
            const channels = m.channels || ['app'];
            return (
              <div key={m.id} className="rounded-2xl overflow-hidden transition-all" style={{ background: '#fff', border: isOpen ? `1.5px solid ${meta.color}40` : '1.5px solid #F0EEE8', borderRight: `3px solid ${meta.color}` }}>
                <button onClick={() => markRead(m.id)} className="w-full flex items-start gap-3 px-4 py-3 text-right">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${meta.color}1a` }}>
                    <Icon size={18} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${meta.color}1a`, color: meta.color }}>{meta.label}</span>
                      {m.zimmer_name && <span className="text-xs truncate" style={{ color: '#9CA3AF' }}>· {m.zimmer_name}</span>}
                      {!m.read && <span className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }} title="חדשה" />}
                      <span className="text-xs mr-auto" style={{ color: '#D1D5DB' }}>{new Date(m.created_date).toLocaleDateString('he-IL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{m.title}</p>
                    {m.body && <p className="text-sm mt-1 whitespace-pre-wrap line-clamp-2" style={{ color: '#4B5563' }}>{m.body}</p>}
                    {/* Channel badges */}
                    <div className="flex items-center gap-1.5 mt-2">
                      {channels.includes('app') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>
                          <MessageCircle size={9} /> אפליקציה
                        </span>
                      )}
                      {channels.includes('whatsapp') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: 'rgba(37,211,102,0.1)', color: '#22C55E' }}>
                          <Send size={9} /> WhatsApp
                          {m.delivery_status?.whatsapp === 'sent' && <CheckCircle2 size={9} />}
                          {m.delivery_status?.whatsapp === 'not_configured' && <span style={{ color: '#D1D5DB' }}>· לא מוגדר</span>}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4">
                    {m.body && (
                      <div className="rounded-xl px-4 py-3 mb-2" style={{ background: '#F8F7F4' }}>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{m.body}</p>
                      </div>
                    )}
                    <MessageMetadata meta={m.metadata} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageMetadata({ meta }) {
  if (!meta) return null;
  const blocks = [];
  if (meta.intro) blocks.push({ icon: Sparkles, color: '#8B5CF6', title: 'ברכה', text: meta.intro });
  if (meta.address) blocks.push({ icon: MapPin, color: '#0EA5E9', title: 'כתובת', text: meta.address, link: meta.nav_link, linkLabel: 'פתח ניווט' });
  if (meta.instructions) blocks.push({ icon: MessageCircle, color: '#F97316', title: 'הוראות הגעה', text: meta.instructions });
  if (meta.key_location) blocks.push({ icon: KeyRound, color: '#F97316', title: 'מיקום המפתח', text: meta.key_location });
  if (meta.entry_code) blocks.push({ icon: KeyRound, color: '#22C55E', title: 'קוד כניסה', text: meta.entry_code });
  if (meta.phones?.length) blocks.push({ icon: Phone, color: '#6B7280', title: 'טלפונים', text: meta.phones.join(', ') });

  const recs = meta.recommendations || [];
  const REC_GROUPS = [
    { key: 'restaurants', label: 'מסעדות' },
    { key: 'attractions', label: 'אטרקציות' },
    { key: 'trails', label: 'מסלולים' },
    { key: 'nightlife', label: 'בילוי' },
    { key: 'activities', label: 'פעילויות' },
  ];
  (meta.recommendations_v2 || recs || []).length;
  // If structured recommendations present (from generateAIRecommendations)
  const hasStructured = REC_GROUPS.some(g => Array.isArray(meta[g.key]) && meta[g.key].length);

  return (
    <div className="space-y-2 mt-2">
      {blocks.map((b, i) => {
        const BIcon = b.icon;
        return (
          <div key={i} className="rounded-xl px-3 py-2.5 flex items-start gap-2.5" style={{ background: '#fff', border: '1px solid #F0EEE8' }}>
            <BIcon size={15} style={{ color: b.color, marginTop: 2, flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold mb-0.5" style={{ color: '#6B7280' }}>{b.title}</p>
              <p className="text-sm" style={{ color: '#1A1A1A' }}>{b.text}</p>
              {b.link && (
                <a href={b.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold mt-1.5 px-2.5 py-1 rounded-lg" style={{ background: `${b.color}1a`, color: b.color }}>
                  <MapPin size={11} /> {b.linkLabel || 'פתח'}
                </a>
              )}
            </div>
          </div>
        );
      })}

      {/* Structured recommendations grouped by category */}
      {hasStructured && (
        <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: '#8B5CF6' }}><Sparkles size={13} /> המלצות AI לחופשה</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {REC_GROUPS.map(g => (meta[g.key] || []).map((r, j) => (
              <div key={`${g.key}-${j}`} className="rounded-lg px-3 py-2" style={{ background: '#fff', border: '1px solid #F0EEE8' }}>
                <p className="text-xs font-bold" style={{ color: '#8B5CF6' }}>{g.label}</p>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{r.title}</p>
                {r.description && <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{r.description}</p>}
              </div>
            )))}
          </div>
        </div>
      )}
    </div>
  );
}