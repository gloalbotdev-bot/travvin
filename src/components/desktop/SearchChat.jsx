import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Send } from 'lucide-react';
import QuickOptions from '@/components/chat/QuickOptions';
import DateSearchWidget from '@/components/chat/DateSearchWidget';
import { formatILS } from '@/lib/bookingPrice';
import { buildRecentTurns, applyCustomerUiEffects } from '@/lib/assistantCustomer';

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
    let label = p.mode === 'exact'
      ? `${p.checkIn} עד ${p.checkOut}, ${p.numGuests} אורחים`
      : `${p.numNights} לילות בין ${p.rangeStart} ל-${p.rangeEnd}, ${p.numGuests} אורחים`;
    if (p.regions?.length) label += `, ${p.regions.join('/')}`;
    else if (p.freeText) label += `, ${p.freeText}`;
    if (p.max_budget) label += `, עד ${formatILS(p.max_budget)}`;
    const userMsg = `🔍 ${label}`;
    addMsg('user', 'text', userMsg);
    setIsTyping(true);

    try {
      const response = await api.assistant.chat({
        profile: 'customer_date_search',
        message: userMsg,
        conversationId: sessionIdRef.current,
        clientState: { searchParams: p, searchDates: p, surface: 'desktop' },
      });
      const all = await api.entities.Zimmer.filter({ approval_status: 'אושר' });

      if (response.conversationId) {
        sessionIdRef.current = response.conversationId;
      }

      await applyCustomerUiEffects({
        response,
        zimmers: all,
        searchDates: p,
        actions: {
          onBotText: (content) => addMsg('bot', 'text', content),
          onMapResults: (found, effect) => {
            onResults(found, {
              checkIn: effect.checkIn,
              checkOut: effect.checkOut,
              priceCheckIn: effect.priceCheckIn,
              priceCheckOut: effect.priceCheckOut,
              numAdults: effect.numAdults,
              numChildren: effect.numChildren,
            });
          },
          onQuickOptions: (options) => setQuickOptions(options),
          onDateSearchWidget: () => {
            setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'bot', type: 'date_search', content: null, time: formatTime() }]);
          },
        },
      });

      const topId = response.meta?.parsed?.zimmer_ids?.[0];
      if (topId) {
        const top = all.find((z) => z.id === topId);
        if (top) lastTopRef.current = top;
      }
    } catch (e) {
      addMsg('bot', 'text', 'שגיאה. נסה שוב.');
    } finally {
      setIsTyping(false);
    }
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
      const recentTurns = buildRecentTurns(messages, 6);
      const response = await api.assistant.chat({
        profile: 'customer_chat',
        message: text,
        conversationId: sessionIdRef.current,
        clientState: { searchDates, recentTurns, surface: 'desktop' },
      });
      const all = await api.entities.Zimmer.filter({ approval_status: 'אושר' });

      if (response.conversationId) {
        sessionIdRef.current = response.conversationId;
      }

      let gotQuickOptions = false;
      let mapMeta = null;
      await applyCustomerUiEffects({
        response,
        zimmers: all,
        searchDates,
        userMessage: text,
        actions: {
          onBotText: (content) => addMsg('bot', 'text', content),
          onMapResults: (found, effect) => {
            mapMeta = effect;
            onResults(found, {
              priceCheckIn: effect.priceCheckIn,
              priceCheckOut: effect.priceCheckOut,
              numAdults: effect.numAdults,
              numChildren: effect.numChildren,
              checkIn: effect.checkIn,
              checkOut: effect.checkOut,
            });
          },
          onShowZimmers: (found) => {
            onResults(found.length ? found : all, {
              priceCheckIn: mapMeta?.priceCheckIn ?? searchDates?.checkIn ?? searchDates?.rangeStart,
              priceCheckOut: mapMeta?.priceCheckOut ?? searchDates?.checkOut ?? searchDates?.rangeEnd,
              numAdults: mapMeta?.numAdults ?? searchDates?.num_adults ?? 0,
              numChildren: mapMeta?.numChildren ?? searchDates?.num_children ?? 0,
              checkIn: searchDates?.checkIn ?? searchDates?.rangeStart,
              checkOut: searchDates?.checkOut ?? searchDates?.rangeEnd,
            });
            if (found[0]) lastTopRef.current = found[0];
          },
          onShowZimmer: (z) => onSelectZimmer(z),
          onBookingForm: (z) => {
            onBookZimmer(z);
            gotQuickOptions = true;
          },
          onQuickOptions: (options) => {
            gotQuickOptions = true;
            setQuickOptions(options);
          },
          onUnansweredQuestion: async (z) => {
            const searchSummary = searchDates
              ? (searchDates.checkIn
                  ? `${searchDates.checkIn} עד ${searchDates.checkOut}, ${searchDates.numGuests} אורחים`
                  : `${searchDates.numNights} לילות בין ${searchDates.rangeStart} ל-${searchDates.rangeEnd}, ${searchDates.numGuests} אורחים`)
              : null;
            await api.entities.UnansweredQuestion.create({
              zimmer_id: z.id,
              zimmer_name: z.name,
              owner_id: z.owner_id,
              question: text,
              session_id: sessionIdRef.current || '',
              customer_search_summary: searchSummary,
              customer_name: user?.full_name || '',
              status: 'ממתינה',
            }).catch(() => {});
          },
        },
      });

      if (!gotQuickOptions) {
        setQuickOptions([
          { label: '💬 שאלה נוספת', text: 'יש לי עוד שאלה' },
          { label: '🔄 שנה תאריכים', text: 'אני רוצה לשנות תאריכים' },
        ]);
      }
    } catch (e) {
      addMsg('bot', 'text', 'שגיאה. נסה שוב.');
    } finally {
      setIsTyping(false);
    }
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
        {messages.map((msg) => (
          <React.Fragment key={msg.id}>{renderMessage(msg)}</React.Fragment>
        ))}
        {isTyping && <TypingIndicator />}
        {!isTyping && quickOptions.length > 0 && <QuickOptions options={quickOptions} onSelect={handleSend} />}
        <div ref={messagesEndRef} />
      </div>
      <div className="bg-white px-3 py-3 flex items-end gap-2 border-t border-gray-100">
        <div className="flex-1 bg-[#F5F5F5] rounded-2xl px-4 py-2.5 flex items-center min-h-[44px]">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="כתוב הודעה..." rows={1} className="w-full bg-transparent outline-none resize-none text-sm leading-5 max-h-28 text-gray-800" style={{ direction: 'rtl' }} />
        </div>
        <button onClick={() => handleSend(null)} disabled={!input.trim() || isTyping} className="w-11 h-11 bg-[#F97316] rounded-2xl flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0 hover:bg-[#EA580C] transition-colors">
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}
