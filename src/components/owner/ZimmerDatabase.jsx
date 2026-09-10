import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Database, ChevronDown, ChevronUp, MapPin, BedDouble, Users, MessageSquare } from 'lucide-react';

const SOURCE_COLORS = {
  'שיחת טלפון': { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6', label: '📞' },
  'שיחת וואטסאפ': { bg: 'rgba(34,197,94,0.1)', color: '#16A34A', label: '💬' },
  'טקסט חופשי': { bg: 'rgba(249,115,22,0.1)', color: '#EA580C', label: '📝' },
};

export default function ZimmerDatabase({ ownerId }) {
  const [zimmers, setZimmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [expandedZone, setExpandedZone] = useState({});
  const [summaries, setSummaries] = useState({});
  const [summarizing, setSummarizing] = useState({});

  useEffect(() => {
    if (!ownerId) return;
    api.entities.Zimmer.filter({ owner_id: ownerId }).then(data => {
      setZimmers(data);
      const fromDb = {};
      for (const z of data) {
        if (z.knowledge_summary) fromDb[z.id] = z.knowledge_summary;
      }
      setSummaries(fromDb);
      setLoading(false);
      // auto-expand first zimmer
      if (data.length > 0) setExpanded({ [data[0].id]: true });
    });
  }, [ownerId]);

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const generateSummary = async (zimmer) => {
    setSummarizing(prev => ({ ...prev, [zimmer.id]: true }));
    try {
      const response = await api.assistant.chat({
        profile: 'owner_zimmer_knowledge_summary',
        message: 'סכם את מאגר הידע של הצימר',
        clientState: { zimmerId: zimmer.id },
      });
      const text = (response?.message?.content || '').trim();
      if (!text) return;
      const saved = await api.entities.Zimmer.update(zimmer.id, { knowledge_summary: text });
      const next = saved?.knowledge_summary || text;
      setSummaries(prev => ({ ...prev, [zimmer.id]: next }));
      setZimmers(prev => prev.map(z => (z.id === zimmer.id ? { ...z, ...saved, knowledge_summary: next } : z)));
    } catch (e) { /* ignore */ }
    setSummarizing(prev => ({ ...prev, [zimmer.id]: false }));
  };

  const totalZones = zimmers.reduce((acc, z) => acc + (z.data_zones?.length || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>דאטאבייס ידע</h1>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>כל המידע שנאסף על הצימרים שלך</p>
        </div>
        <div className="flex gap-3">
          <div className="text-center px-4 py-2 rounded-xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <p className="text-xl font-black" style={{ color: '#F97316' }}>{zimmers.length}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>צימרים</p>
          </div>
          <div className="text-center px-4 py-2 rounded-xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
            <p className="text-xl font-black" style={{ color: '#F97316' }}>{totalZones}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>אזורי מידע</p>
          </div>
        </div>
      </div>

      {zimmers.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <Database size={40} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p className="text-sm" style={{ color: '#9CA3AF' }}>אין צימרים עם מידע עדיין</p>
        </div>
      ) : (
        <div className="space-y-4">
          {zimmers.map(zimmer => (
            <div key={zimmer.id} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              {/* Zimmer Header */}
              <button
                className="w-full flex items-center justify-between p-5 text-right transition-colors hover:bg-orange-50/30"
                onClick={() => toggleExpand(zimmer.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(249,115,22,0.1)' }}>
                    <Database size={18} style={{ color: '#F97316' }} />
                  </div>
                  <div className="text-right">
                    <p className="font-bold" style={{ color: '#1A1A1A' }}>{zimmer.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {zimmer.location && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
                          <MapPin size={11} />{zimmer.location}
                        </span>
                      )}
                      {zimmer.num_rooms && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
                          <BedDouble size={11} />{zimmer.num_rooms} חדרים
                        </span>
                      )}
                      {zimmer.max_guests && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
                          <Users size={11} />עד {zimmer.max_guests}
                        </span>
                      )}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
                        {zimmer.data_zones?.length || 0} אזורי מידע
                      </span>
                    </div>
                  </div>
                </div>
                {expanded[zimmer.id] ? <ChevronUp size={18} style={{ color: '#9CA3AF' }} /> : <ChevronDown size={18} style={{ color: '#9CA3AF' }} />}
              </button>

              {/* Expanded Content */}
              {expanded[zimmer.id] && (
                <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid #F0EEE8' }}>

                  {/* Data Zones */}
                  {zimmer.data_zones?.filter(z => z.content?.trim()).length > 0 && (
                    <div className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare size={14} style={{ color: '#F97316' }} />
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#F97316' }}>נקודות מידע</span>
                      </div>
                      <div className="space-y-1.5">
                        {zimmer.data_zones.filter(z => z.content?.trim()).map((zone, idx) => {
                          const srcStyle = SOURCE_COLORS[zone.source_type] || SOURCE_COLORS['טקסט חופשי'];
                          const zoneKey = `${zimmer.id}-${idx}`;
                          const isOpen = expandedZone[zoneKey];
                          // Extract a short title: first line or first 60 chars
                          const firstLine = zone.content.split('\n')[0].trim();
                          const title = firstLine.length > 70 ? firstLine.slice(0, 70) + '...' : firstLine;
                          return (
                            <div key={idx} className="rounded-xl overflow-hidden" style={{ border: '1px solid #F0EEE8' }}>
                              <button
                                className="w-full flex items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-orange-50/40"
                                style={{ background: '#F8F7F4' }}
                                onClick={() => setExpandedZone(prev => ({ ...prev, [zoneKey]: !prev[zoneKey] }))}
                              >
                                <span className="flex-shrink-0">{srcStyle.label}</span>
                                <p className="flex-1 text-sm font-medium text-right" style={{ color: '#1A1A1A' }}>{title}</p>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {zone.source_date && <span className="text-xs" style={{ color: '#9CA3AF' }}>{zone.source_date}</span>}
                                  {isOpen ? <ChevronUp size={14} style={{ color: '#9CA3AF' }} /> : <ChevronDown size={14} style={{ color: '#9CA3AF' }} />}
                                </div>
                              </button>
                              {isOpen && (
                                <div className="px-4 py-3" style={{ background: '#fff', borderTop: '1px solid #F0EEE8' }}>
                                  {zone.source_label && (
                                    <p className="text-xs mb-2 font-semibold" style={{ color: '#9CA3AF' }}>{zone.source_label}</p>
                                  )}
                                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#374151' }}>{zone.content}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* AI Summary */}
                  <div className="rounded-xl p-4" style={{ background: 'rgba(249,115,22,0.05)', border: '1.5px dashed rgba(249,115,22,0.3)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold" style={{ color: '#EA580C' }}>✦ סיכום AI</span>
                      <button
                        onClick={() => generateSummary(zimmer)}
                        disabled={summarizing[zimmer.id]}
                        className="text-xs font-semibold px-3 py-1 rounded-lg transition-all disabled:opacity-50"
                        style={{ background: '#F97316', color: '#fff' }}>
                        {summarizing[zimmer.id] ? 'מסכם...' : summaries[zimmer.id] ? 'עדכן סיכום' : 'צור סיכום'}
                      </button>
                    </div>
                    {summaries[zimmer.id] ? (
                      <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#374151' }}>{summaries[zimmer.id]}</p>
                    ) : (
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>לחץ על "צור סיכום" כדי שה-AI יסכם את כל המידע על הצימר הזה</p>
                    )}
                  </div>

                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}