import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { MapPin, Waves, BedDouble, Sparkles, Loader2 } from 'lucide-react';

const ICON_BY_KEYWORD = {
  location: MapPin,
  pool: Waves,
  suites: BedDouble,
  leisure: Sparkles,
};

const iconFor = (kw) => ICON_BY_KEYWORD[(kw || '').toLowerCase()] || Sparkles;

// AI-split of the free-text description into 4 themed cards.
// Cached on the entity (description_cards + description_cards_snapshot) so repeat
// views don't burn LLM credits. When the description changes, the owner's save
// clears the cache and we regenerate once.
export default function DescriptionCardsSection({ zimmer }) {
  const description = zimmer.description || '';
  const cached = Array.isArray(zimmer.description_cards) ? zimmer.description_cards : [];
  const snapshot = zimmer.description_cards_snapshot || '';
  const [cards, setCards] = useState(cached);
  const [loading, setLoading] = useState(false);

  const needsGen = !!description && (cached.length !== 4 || snapshot !== description);

  useEffect(() => {
    if (!needsGen) { setCards(cached); return; }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api.integrations.Core.InvokeLLM({
          prompt: `אתה כותב כרטיסי תיאור לדף צימר. קח את התיאור החופשי הבא ופצל אותו ל-4 כרטיסים קצרים, כל אחד בקטגוריה אחת מהרשימה: location (מיקום וסביבה), pool (בריכה/ג'קוזי/מים), suites (חדרים/מיטות/פנים), leisure (פנאי/חוויה). לכל כרטיס החזר: category (אחד מ-location/pool/suites/leisure), icon_keyword (כנ"ל), title (כותרת קצרה בעברית), paragraph (2-3 משפטים בעברית). אם אין מידע לקטגוריה מסוימת, כתוב כותרת כללית ופסקה קצרה שמתבססת על התיאור. תיאור: """${description}"""`,
          response_json_schema: {
            type: 'object',
            properties: {
              cards: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string' },
                    icon_keyword: { type: 'string' },
                    title: { type: 'string' },
                    paragraph: { type: 'string' },
                  },
                },
              },
            },
          },
        });
        const generated = (res && Array.isArray(res.cards) ? res.cards : []).slice(0, 4);
        if (!active) return;
        setCards(generated);
        // persist cache
        try {
          await api.entities.Zimmer.update(zimmer.id, {
            description_cards: generated,
            description_cards_snapshot: description,
          });
        } catch { /* cache save is best-effort */ }
      } catch {
        // fall back to rendering the raw description below
        setCards([]);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zimmer.id, description]);

  if (!description) return null;

  if (loading) {
    return (
      <div className="rounded-2xl p-4" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }} dir="rtl">
        <div className="flex items-center gap-2 text-xs" style={{ color: '#9CA3AF' }}>
          <Loader2 size={14} className="animate-spin" /> מכין כרטיסי תיאור…
        </div>
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div dir="rtl">
        <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: '#0B3838' }}>תיאור</h3>
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#4B5563' }}>{description}</p>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: '#0B3838' }}>בקצרה</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {cards.map((c, i) => {
          const Icon = iconFor(c.icon_keyword || c.category);
          return (
            <div key={i} className="rounded-2xl p-3.5" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(11,56,56,0.1)' }}>
                  <Icon size={14} style={{ color: '#0B3838' }} />
                </div>
                <h4 className="font-bold text-sm" style={{ color: '#1A1A1A' }}>{c.title}</h4>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#4B5563' }}>{c.paragraph}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}