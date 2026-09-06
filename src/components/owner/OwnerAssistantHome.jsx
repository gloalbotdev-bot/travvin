import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Plus, Send, ChevronUp, Calendar, Lock, Tag, Sparkles, Loader2 } from 'lucide-react';
import TypewriterPlaceholder from './TypewriterPlaceholder';

function Illustration() {
  return (
    <div className="relative w-56 h-44 mx-auto">
      <svg viewBox="0 0 224 176" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* ground */}
        <ellipse cx="112" cy="160" rx="92" ry="12" fill="#E8F0EE" />
        {/* palm trunk */}
        <path d="M150 158 C 146 120 152 90 148 64" stroke="#A37C4B" strokeWidth="6" strokeLinecap="round" />
        {/* palm leaves */}
        <path d="M148 64 C 120 50 96 56 80 70" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" />
        <path d="M148 64 C 170 48 196 52 212 66" stroke="#22C55E" strokeWidth="5" strokeLinecap="round" />
        <path d="M148 64 C 132 40 120 30 110 22" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" />
        <path d="M148 64 C 168 42 184 34 200 30" stroke="#22C55E" strokeWidth="5" strokeLinecap="round" />
        <path d="M148 64 C 150 44 150 28 150 16" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" />
        {/* table */}
        <rect x="40" y="128" width="86" height="6" rx="3" fill="#7C5E3C" />
        <rect x="44" y="134" width="4" height="22" fill="#7C5E3C" />
        <rect x="118" y="134" width="4" height="22" fill="#7C5E3C" />
        {/* laptop */}
        <rect x="58" y="108" width="52" height="32" rx="3" fill="#1F2937" />
        <rect x="62" y="112" width="44" height="24" rx="2" fill="#0B3838" />
        <path d="M52 140 L 116 140 L 122 146 L 46 146 Z" fill="#374151" />
        {/* person */}
        <circle cx="40" cy="100" r="11" fill="#F0C9A8" />
        <path d="M40 111 C 30 111 26 120 26 130 L 26 134 L 54 134 L 54 130 C 54 120 50 111 40 111 Z" fill="#7C3AED" />
        {/* check speech bubble */}
        <path d="M150 18 L 196 18 C 200 18 204 22 204 26 L 204 46 C 204 50 200 54 196 54 L 168 54 L 158 62 L 160 54 L 150 54 C 146 54 142 50 142 46 L 142 26 C 142 22 146 18 150 18 Z" fill="#FDE047" stroke="#1F2937" strokeWidth="1.5" />
        <path d="M156 36 L 164 44 L 178 28" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function nextFridayStr() {
  const d = new Date();
  const dow = d.getDay();
  const offset = (5 - dow + 7) % 7; // days until Friday
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function OwnerAssistantHome({ ownerId, zimmers, loading, onChat, onQuickAction, onNavigate, onAddBooking }) {
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(true);
  const [showSugg, setShowSugg] = useState(true);
  const firedRef = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (firedRef.current || !ownerId) return;
    firedRef.current = true;
    (async () => {
      try {
        const [bookings, questions] = await Promise.all([
          api.entities.BookingRequest.filter({ owner_id: ownerId }),
          api.entities.UnansweredQuestion.filter({ owner_id: ownerId, status: 'ממתינה' }),
        ]);
        const fri = nextFridayStr();
        const freeWeekend = bookings.filter(b => b.status === 'אושרה' && b.check_in <= fri && b.check_out > fri).length < Math.max(1, zimmers.length);

        let llm = null;
        try {
          llm = await api.integrations.Core.InvokeLLM({
            prompt: `אתה יועץ לבעל צימרים בישראל. נתונים: ${questions.length} שאלות לקוחות ממתינות${questions[0] ? `, למשל: "${(questions[0].question || '').slice(0, 80)}"` : ''}. ${zimmers.length} צימרים בבעלות. ${freeWeekend ? 'יש לילות פנויות בסוף השבוע הקרוב' : 'אין לילות פנויות בסוף השבוע הקרוב'}.
החזר בדיוק 2 הצעות לשיפור בעברית, כל אחת עם: title (כותרת קצרה), body (משפט אחד), action_label (טקסט כפתור), action_type ("add_info" להוספת מידע לנכס או "create_offer" ליצירת מבצע). JSON בלבד.`,
            response_json_schema: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      body: { type: 'string' },
                      action_label: { type: 'string' },
                      action_type: { type: 'string', enum: ['add_info', 'create_offer'] },
                    },
                  },
                },
              },
            },
          });
        } catch {}

        const list = (llm && Array.isArray(llm.suggestions) && llm.suggestions.length) ? llm.suggestions : fallbackSuggestions(questions, zimmers, freeWeekend);
        setSuggestions(list.slice(0, 2));
      } catch {
        setSuggestions(fallbackSuggestions([], zimmers, false));
      }
      setLoadingSugg(false);
    })();
  }, [ownerId, zimmers]);

  const fallbackSuggestions = (questions, zimmers, freeWeekend) => {
    const s = [];
    if (questions.length > 0) {
      s.push({ title: `לקוחות שואלים על ${questions[0].zimmer_name || 'הנכס'}`, body: 'שאלה חוזרת: ' + (questions[0].question || '').slice(0, 70), action_label: 'הוסף מידע', action_type: 'add_info' });
    } else {
      s.push({ title: 'השלם מידע בנכסים', body: 'כדאי להוסיף פרטים על חניה, צ\'ק-אין ומתקנים לכל הצימרים.', action_label: 'הוסף מידע', action_type: 'add_info' });
    }
    if (freeWeekend) {
      s.push({ title: 'הסופ"ש הקרוב פנוי', body: 'יש לילות פנויות בסוף השבוע — כדאי ליצור הצעה מיידית.', action_label: 'צור הצעה', action_type: 'create_offer' });
    } else {
      s.push({ title: 'צור מבצע לתפוס תפוסה', body: 'תן הנחה קטנה לתאריכים פנויים כדי למלא לילות ריקים.', action_label: 'צור הצעה', action_type: 'create_offer' });
    }
    return s;
  };

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    onChat(t);
    setDraft('');
  };

  const onSuggestionAction = (s) => {
    if (s.action_type === 'add_info') onNavigate('zimmers');
    else if (s.action_type === 'create_offer') onNavigate('promotions');
  };

  const quickActions = [
    { type: 'add_booking', label: 'הוספת הזמנה', icon: Calendar },
    { type: 'block_date', label: 'חסום תאריך', icon: Lock },
    { type: 'update_price', label: 'עדכון מחיר', icon: Tag },
  ];

  return (
    <div dir="rtl" className="max-w-3xl mx-auto w-full" style={{ fontFamily: 'Heebo, sans-serif' }}>
      {/* Hero */}
      <div className="text-center pt-6 pb-4">
        <Illustration />
      </div>

      <div className="text-center mb-6">
        <h1 className="text-3xl font-black mb-2" style={{ color: '#1F2937' }}>בואו נסמן V על היום</h1>
        <p className="text-sm leading-relaxed mx-auto max-w-md" style={{ color: '#6B7280' }}>
          היי, אני כאן כדי לעזור לך לנהל את הנכסים שלך. שאל אותי כל דבר שקשור להזמנות, יומן, מחירים ולקוחות.
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap justify-center gap-2.5 mb-6">
        {quickActions.map(({ type, label, icon: Icon }) => (
          <button key={type} onClick={() => onQuickAction(type)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-md"
            style={{ background: '#fff', border: '1.5px solid #F0EEE8', color: '#1F2937' }}>
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.1)' }}>
              <Icon size={15} style={{ color: '#F97316' }} />
            </span>
            {label}
          </button>
        ))}
      </div>

      {/* Chat input with yellow glow */}
      <div className="mb-8">
        <div className="flex items-center gap-2 rounded-full px-2 py-2"
          style={{ background: '#fff', border: '1.5px solid #FDE047', boxShadow: '0 0 0 4px rgba(253,224,71,0.22), 0 6px 24px rgba(253,224,71,0.18)' }}>
          <button onClick={onAddBooking} title="הוספת הזמנה"
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105"
            style={{ background: '#FDE047', color: '#1A1A1A' }}>
            <Plus size={20} />
          </button>
          <div className="relative flex-1 min-w-0">
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
              placeholder=" "
              className="w-full bg-transparent outline-none text-sm min-w-0 relative z-10"
              style={{ color: '#1F2937' }}
            />
            {!draft.trim() && (
              <span className="absolute inset-0 flex items-center text-sm pointer-events-none truncate">
                <TypewriterPlaceholder active={!draft.trim()} />
              </span>
            )}
          </div>
          <button onClick={submit} disabled={!draft.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-all disabled:opacity-40 hover:opacity-90"
            style={{ background: '#0B3838' }}>
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Suggestions */}
      <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <button onClick={() => setShowSugg(s => !s)}
          className="flex items-center gap-2 w-full text-right mb-4">
          <Sparkles size={16} style={{ color: '#F59E0B' }} />
          <span className="text-sm font-bold flex-1" style={{ color: '#1F2937' }}>הצעות לשיפור</span>
          <ChevronUp size={16} style={{ color: '#9CA3AF', transform: showSugg ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
        </button>

        {showSugg && (
          <div className="space-y-3">
            {loadingSugg ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={18} className="animate-spin" style={{ color: '#9CA3AF' }} />
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: '#9CA3AF' }}>אין הצעות כרגע.</p>
            ) : (
              suggestions.map((s, i) => (
                <div key={i} className="rounded-xl p-4 flex items-start gap-3" style={{ background: '#F9FAFB', border: '1px solid #F0EEE8' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold mb-1" style={{ color: '#1F2937' }}>{s.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{s.body}</p>
                  </div>
                  <button onClick={() => onSuggestionAction(s)}
                    className="flex-shrink-0 text-xs font-bold px-3 py-2 rounded-lg text-white transition-all hover:opacity-90"
                    style={{ background: s.action_type === 'create_offer' ? '#7C3AED' : '#0B3838' }}>
                    {s.action_label}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}