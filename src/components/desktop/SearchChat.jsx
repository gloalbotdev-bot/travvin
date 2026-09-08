import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Send } from 'lucide-react';
import QuickOptions from '@/components/chat/QuickOptions';
import DateSearchWidget, { getBookedZimmerIds, datesOverlap } from '@/components/chat/DateSearchWidget';
import { rankZimmersByFit, zimmerPriceSummary, formatILS } from '@/lib/bookingPrice';
import { REGION_KEYWORDS } from '@/lib/regions';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';

const BOT_NAME = 'ZimmerBot';

const formatTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const TypingIndicator = () => (
  <div className="flex items-end gap-2 mb-3">
    <div className="w-7 h-7 rounded-full bg-[#F97316] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">Z</div>
    <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100">
      <div className="flex gap-1 items-center h-4">
        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  </div>
);

export default function SearchChat({ user, onResults, onSelectZimmer, onBookZimmer, askPrefill, onAskPrefillConsumed, bookingMessage, onBookingMessageShown }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [quickOptions, setQuickOptions] = useState([]);
  const [searchDates, setSearchDates] = useState(null);
  const messagesEndRef = useRef(null);
  const sessionIdRef = useRef(null);
  const lastTopRef = useRef(null);
  const { ref: inputRef, resize: resizeInput } = useAutoResize(input, 220);

  useEffect(() => {
    if (askPrefill) { setInput(askPrefill); onAskPrefillConsumed?.(); }
  }, [askPrefill]);

  useEffect(() => {
    if (bookingMessage) {
      setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'bot', type: 'text', content: bookingMessage, time: formatTime() }]);
      onBookingMessageShown?.();
    }
  }, [bookingMessage]);

  useEffect(() => {
    setMessages([
      {
        id: Date.now(),
        role: 'bot',
        type: 'text',
        content: 'שלום! 👋 בחר תאריכים ואורחים כדי שאציג צימרים פנויים על המפה וברשימה.',
        time: formatTime(),
      },
      { id: Date.now() + 1, role: 'bot', type: 'date_search', content: null, time: formatTime() },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addMsg = (role, type, content, extra = {}) =>
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, type, content, time: formatTime(), ...extra }]);

  const handleDateSearch = async (p) => {
    setSearchDates(p);
    setQuickOptions([]);
    let checkIn, checkOut, priceCheckIn, priceCheckOut, numAdults, numChildren;
    numAdults = p.num_adults || 0;
    numChildren = p.num_children || 0;
    if (p.mode === 'exact') {
      checkIn = p.checkIn; checkOut = p.checkOut;
      priceCheckIn = checkIn; priceCheckOut = checkOut;
    } else {
      checkIn = p.rangeStart; checkOut = p.rangeEnd;
      priceCheckIn = checkIn;
      priceCheckOut = new Date(new Date(checkIn).getTime() + (p.numNights * 86400000)).toISOString().split('T')[0];
    }
    let label = p.mode === 'exact'
      ? `${checkIn} עד ${checkOut}, ${p.numGuests} אורחים`
      : `${p.numNights} לילות בין ${p.rangeStart} ל-${p.rangeEnd}, ${p.numGuests} אורחים`;
    if (p.regions?.length) label += `, ${p.regions.join('/')}`;
    else if (p.freeText) label += `, ${p.freeText}`;
    if (p.max_budget) label += `, עד ${formatILS(p.max_budget)}`;
    addMsg('user', 'text', `🔍 ${label}`);
    setIsTyping(true);
    try {
      const all = await api.entities.Zimmer.filter({ approval_status: 'אושר' });
      const bookedIds = await getBookedZimmerIds(api, checkIn, checkOut);
      let avail = all.filter((z) => !bookedIds.includes(z.id) && (!z.max_guests || z.max_guests >= p.numGuests));
      if (p.max_budget) avail = avail.filter((z) => zimmerPriceSummary(z, priceCheckIn, priceCheckOut, numAdults, numChildren).avg <= p.max_budget);
      if (p.regions?.length || p.freeText) {
        avail = avail.filter((z) => {
          const loc = (z.location || '').trim();
          if (!loc) return false;
          const r = (p.regions || []).some((reg) => (REGION_KEYWORDS[reg] || []).some((kw) => loc.includes(kw)));
          const f = p.freeText && (loc.includes(p.freeText) || p.freeText.includes(loc));
          return r || f;
        });
      }
      avail = rankZimmersByFit(avail, numAdults, numChildren);
      // emit ALL available to map + list
      onResults(avail, { checkIn, checkOut, priceCheckIn, priceCheckOut, numAdults, numChildren });

      if (avail.length === 0) {
        addMsg('bot', 'text', '😔 לא מצאתי צימרים פנויים. נסה תאריכים/אזור אחר.');
        setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'bot', type: 'date_search', content: null, time: formatTime() }]);
        setIsTyping(false);
        return;
      }

      // LLM picks top 5 for the chat
      const ctx = avail.map((z) => {
        const zones = (z.data_zones || []).map((dz) => `[${dz.source_type || 'מידע'}]: ${dz.content || ''}`).join('\n');
        const pr = zimmerPriceSummary(z, priceCheckIn, priceCheckOut, numAdults, numChildren);
        const priceLine = pr.isPartial
          ? `${formatILS(pr.avg)}/לילה (חלקי, סה"כ ${formatILS(pr.total)})`
          : `${formatILS(pr.avg)}/לילה (מלא, סה"כ ${formatILS(pr.total)})`;
        return `--- ${z.name} (ID: ${z.id}) --- מיקום: ${z.location || '—'} | ${priceLine} | חדרים: ${z.num_rooms || '?'} | מקס אורחים: ${z.max_guests || '?'}\n${zones}`;
      }).join('\n');
      const prompt = `אתה בוט צימרים. ענה בעברית. מחפש ${label}, ${numAdults} מבוגרים ו-${numChildren} ילדים.\nצימרים פנויים (מסודרים לפי התאמת קיבולת):\n${ctx}\nבחר עד 5 מועמדים מתאימים. החזר JSON {"action":"search","zimmer_ids":[...],"message":"..."}.\nmessage: הסבר קצר. JSON בלבד.`;
      const res = await api.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: { type: 'object', properties: { action: { type: 'string' }, message: { type: 'string' }, zimmer_ids: { type: 'array', items: { type: 'string' } } } },
      });
      addMsg('bot', 'text', res.message || `מצאתי ${avail.length} צימרים פנויים עבורך — הם מופיעים ברשימה ועל המפה. 🗺️`);
      let topName = '';
      if (res.zimmer_ids?.length) {
        const top = res.zimmer_ids.map((id) => avail.find((z) => z.id === id)).filter(Boolean);
        if (top.length) { lastTopRef.current = top[0]; topName = top[0].name; }
      }
      setQuickOptions([
        { label: '💬 שאל שאלה על צימר', text: `בנוגע לצימר "${topName}": ` },
        { label: '📅 הזמן אונליין', text: `אני רוצה להזמין את "${topName}"` },
        { label: '🔄 שנה תאריכים', text: 'אני רוצה לשנות תאריכים' },
      ]);
    } catch (e) {
      addMsg('bot', 'text', 'שגיאה. נסה שוב.');
    }
    setIsTyping(false);
  };

  const handleSend = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text) return;
    setInput('');
    setQuickOptions([]);
    if (text.includes('שנה תאריכים') || text.includes('תאריכים אחרים')) {
      setSearchDates(null);
      addMsg('user', 'text', text);
      addMsg('bot', 'text', 'בחר תאריכים חדשים:');
      setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'bot', type: 'date_search', content: null, time: formatTime() }]);
      return;
    }
    if (/^בנוגע לצימר\s*"[^"]*"\s*:?\s*$/.test(text)) { setInput(text); return; }

    addMsg('user', 'text', text);
    setIsTyping(true);
    try {
      const all = await api.entities.Zimmer.filter({ approval_status: 'אושר' });
      let avail = all;
      let datesInfo = '';
      let numAdults = 0, numChildren = 0, priceCheckIn = null, priceCheckOut = null;
      if (searchDates) {
        const ci = searchDates.checkIn || searchDates.rangeStart;
        const co = searchDates.checkOut || searchDates.rangeEnd;
        const bookedIds = await getBookedZimmerIds(api, ci, co);
        avail = all.filter((z) => !bookedIds.includes(z.id) && (!z.max_guests || z.max_guests >= (searchDates.numGuests || 1)));
        numAdults = searchDates.num_adults || 0; numChildren = searchDates.num_children || 0;
        if (searchDates.checkIn) { priceCheckIn = searchDates.checkIn; priceCheckOut = searchDates.checkOut; datesInfo = `תאריכים: ${searchDates.checkIn} עד ${searchDates.checkOut}, ${numAdults} מבוגרים ו-${numChildren} ילדים.`; }
        else { priceCheckIn = searchDates.rangeStart; priceCheckOut = new Date(new Date(searchDates.rangeStart).getTime() + ((searchDates.numNights || 2) * 86400000)).toISOString().split('T')[0]; datesInfo = `גמיש: ${searchDates.numNights} לילות בין ${searchDates.rangeStart} ל-${searchDates.rangeEnd}.`; }
        avail = rankZimmersByFit(avail, numAdults, numChildren);
      }

      const zctx = avail.map((z) => {
        const zones = (z.data_zones || []).map((dz) => `[${dz.source_type || 'מידע'}]: ${dz.content || ''}`).join('\n');
        let priceStr = `מחיר: ${z.price_per_night ? z.price_per_night + '₪/לילה' : '—'}`;
        if (priceCheckIn && priceCheckOut) {
          const pr = zimmerPriceSummary(z, priceCheckIn, priceCheckOut, numAdults, numChildren);
          priceStr = pr.isPartial ? `${formatILS(pr.avg)}/לילה (חלקי)` : `${formatILS(pr.avg)}/לילה (מלא, סה"כ ${formatILS(pr.total)})`;
        }
        return `--- ${z.name} (ID: ${z.id}) --- מיקום: ${z.location || '—'} | ${priceStr} | מקס אורחים: ${z.max_guests || '?'}\n${zones}`;
      }).join('\n\n');
      const hist = messages.slice(-6).map((m) => (m.role === 'user' ? `לקוח: ${m.content}` : `בוט: ${typeof m.content === 'string' ? m.content : '[תוצאות]'}`)).join('\n');
      const prompt = `אתה בוט צימרים, ענה בעברית. ${datesInfo}\nצימרים פנויים:\n${zctx}\nהיסטוריה: ${hist}\nהודעה: "${text}"\nהחזר JSON: {"action":"search"|"answer"|"booking"|"view","zimmer_ids":[...],"zimmer_id":"...","message":"...","unanswered_question":bool}.\nחוקי חובה:\n- כל אילוץ שהלקוח הזכיר בשיחה (אזור, כמות אורחים, מתקנים, תקציב) מצטבר — החזר ב-zimmer_ids רק צימרים העונים לכל האילוצים גם יחד. לדוגמה: אם קודם אמר "צפון" ועכשיו הוסיף "זוג" — החזר רק צימרים בצפון שמתאימים לזוג.\n- החזר zimmer_ids מתוך רשימת הצימרים הפנויים למעלה בלבד. החזר עד 20 תוצאות רלוונטיות.\n- בקשה להזמין צימר מוזכר → action="booking", zimmer_id.\n- בקשה לראות דף צימר / תמונות / פרטים מלאים / "תן לי לראות את" / "פתח דף צימר" / "אני רוצה לראות תמונות" → action="view", zimmer_id.\n- שאלת המשך על צימר שמוזכר → action="answer" בלבד.\n- לראות תוצאות/חיפוש מחדש → action="search". JSON בלבד.`;
      const res = await api.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: { type: 'object', properties: { action: { type: 'string' }, message: { type: 'string' }, zimmer_ids: { type: 'array', items: { type: 'string' } }, zimmer_id: { type: 'string' }, unanswered_question: { type: 'boolean' } } },
      });
      if (res.action === 'search' && res.zimmer_ids?.length) {
        const found = res.zimmer_ids.map((id) => avail.find((z) => z.id === id)).filter(Boolean);
        const relevant = found.length ? found : avail;
        onResults(relevant, { priceCheckIn, priceCheckOut, numAdults, numChildren, checkIn: searchDates?.checkIn, checkOut: searchDates?.checkOut });
        addMsg('bot', 'text', res.message || `מצאתי ${relevant.length} צימרים רלוונטיים — מופיעים ברשימה ועל המפה. 🗺️`);
        if (found.length) { lastTopRef.current = found[0]; }
        setQuickOptions([
          { label: '💬 שאל שאלה על הצימר', text: `בנוגע לצימר "${found[0]?.name || ''}": ` },
          { label: '📅 הזמן אונליין', text: `אני רוצה להזמין את "${found[0]?.name || ''}"` },
          { label: '🔄 שנה תאריכים', text: 'אני רוצה לשנות תאריכים' },
        ]);
      } else if (res.action === 'view' && res.zimmer_id) {
        const z = avail.find((x) => x.id === res.zimmer_id) || (lastTopRef.current && avail.find((x) => x.id === lastTopRef.current.id)) || avail[0];
        if (res.message) addMsg('bot', 'text', res.message);
        if (z) onSelectZimmer(z);
      } else if (res.action === 'booking' && res.zimmer_id) {
        const z = avail.find((x) => x.id === res.zimmer_id) || avail[0];
        if (res.message) addMsg('bot', 'text', res.message);
        if (z) onBookZimmer(z);
      } else {
        if (res.unanswered_question && res.zimmer_id) {
          const z = avail.find((x) => x.id === res.zimmer_id);
          if (z) {
            if (!user?.id) {
              addMsg('bot', 'text', 'כדי לשלוח שאלה לבעל הצימר צריך להתחבר קודם.');
            } else {
              const searchSummary = searchDates
                ? (searchDates.checkIn
                    ? `${searchDates.checkIn} עד ${searchDates.checkOut}, ${searchDates.numGuests} אורחים`
                    : `${searchDates.numNights} לילות בין ${searchDates.rangeStart} ל-${searchDates.rangeEnd}, ${searchDates.numGuests} אורחים`)
                : null;
              try {
                await api.entities.UnansweredQuestion.create({
                  zimmer_id: z.id,
                  zimmer_name: z.name,
                  owner_id: z.owner_id,
                  question: text,
                  session_id: sessionIdRef.current || '',
                  customer_search_summary: searchSummary,
                  customer_name: user?.full_name || '',
                  status: 'ממתינה',
                });
                addMsg('bot', 'text', res.message || `השאלה הועברה לבעל ${z.name}. תקבל תשובה בעדכונים.`);
              } catch {
                addMsg('bot', 'text', 'לא הצלחתי לשלוח את השאלה לבעל הצימר. נסה שוב אחרי התחברות.');
              }
            }
          } else {
            addMsg('bot', 'text', res.message || 'מצטער, לא הצלחתי לעבד את הבקשה.');
          }
        } else {
          addMsg('bot', 'text', res.message || 'מצטער, לא הצלחתי לעבד את הבקשה.');
        }
        setQuickOptions([
          { label: '💬 שאלה נוספת', text: 'יש לי עוד שאלה' },
          { label: '🔄 שנה תאריכים', text: 'אני רוצה לשנות תאריכים' },
        ]);
      }
    } catch (e) {
      addMsg('bot', 'text', 'שגיאה. נסה שוב.');
    }
    setIsTyping(false);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(null); } };

  const renderMessage = (msg) => {
    if (msg.type === 'date_search') {
      return (
        <div className="flex items-end gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-[#F97316] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">Z</div>
          <div className="flex-1 min-w-0">
            <DateSearchWidget onSearch={handleDateSearch} />
          </div>
        </div>
      );
    }
    const isBot = msg.role === 'bot';
    return (
      <div className={`flex items-end gap-2 mb-1 ${!isBot ? 'flex-row-reverse' : ''}`}>
        {isBot && <div className="w-7 h-7 rounded-full bg-[#F97316] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">Z</div>}
        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${isBot ? 'bg-white text-gray-800 border border-gray-100' : 'bg-[#F97316] text-white'}`}>
          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          <div className={`text-[10px] mt-0.5 text-left ${isBot ? 'text-gray-400' : 'text-white/70'}`}>{msg.time}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent" dir="rtl">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {messages.map(renderMessage)}
        {isTyping && <TypingIndicator />}
        {!isTyping && quickOptions.length > 0 && <QuickOptions options={quickOptions} onSelect={handleSend} />}
        <div ref={messagesEndRef} />
      </div>
      <div className="bg-white px-3 py-3 flex items-end gap-2 border-t border-gray-100">
        <div className="flex-1 bg-[#F5F5F5] rounded-2xl px-4 py-2.5 flex items-center min-h-[44px]">
          <textarea ref={inputRef} value={input} onChange={(e) => { setInput(e.target.value); resizeInput(); }} onKeyDown={handleKeyDown} placeholder="כתוב הודעה..." rows={1} className="w-full bg-transparent outline-none resize-none overflow-y-auto text-sm leading-5 text-gray-800" style={{ direction: 'rtl' }} />
        </div>
        <MicButton tone="light" disabled={isTyping} onText={t => setInput(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))} />
        <button onClick={() => handleSend(null)} disabled={!input.trim() || isTyping} className="w-11 h-11 bg-[#F97316] rounded-2xl flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0 hover:bg-[#EA580C] transition-colors">
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}