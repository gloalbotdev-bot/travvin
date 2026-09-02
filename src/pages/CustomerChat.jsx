import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Send, MoreVertical, User, Tag, PlusCircle, Search as SearchIcon, Sparkles, Bell } from 'lucide-react';
import ZimmerCard from '@/components/chat/ZimmerCard';
import ZimmerDetailDrawer from '@/components/chat/ZimmerDetailDrawer';
import BookingForm from '@/components/chat/BookingForm';
import QuickOptions from '@/components/chat/QuickOptions';
import DateSearchWidget, { getBookedZimmerIds, datesOverlap } from '@/components/chat/DateSearchWidget';
import { bookingErrorMessage } from '@/lib/bookingErrors';
import { formatILS } from '@/lib/bookingPrice';
import { buildRecentTurns, applyCustomerUiEffects } from '@/lib/assistantCustomer';
import VacationAgentChat from '@/components/chat/VacationAgentChat';
import DirectChat, { getOrCreateDirectThread } from '@/components/chat/DirectChat';
import QuestionForm from '@/components/chat/QuestionForm';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import UpdatesPopover from '@/components/chat/UpdatesPopover';

const BOT_NAME = 'ZimmerBot';
const RESET_WORD = 'טראווין';

let currentSessionId = null;
let sessionMessages = [];
let sessionZimmerIds = [];

const STORAGE_KEY = 'cc_state_v1';
const persistChat = (state) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} };
const loadPersistedChat = () => { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const clearPersistedChat = () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} };

const formatTime = () => {
  const now = new Date();
  return now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

const TypingIndicator = () => (
  <div className="flex items-end gap-2 mb-3">
    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">Z</div>
    <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-xs">
      <div className="flex gap-1 items-center h-4">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  </div>
);

export default function CustomerChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [zimmers, setZimmers] = useState([]);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [quickOptions, setQuickOptions] = useState([]);
  const [searchDates, setSearchDates] = useState(null); // { checkIn, checkOut, numGuests } or { rangeStart, rangeEnd, numNights, numGuests }
  const messagesEndRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [detailZimmer, setDetailZimmer] = useState(null);
  const [activePromo, setActivePromo] = useState(null);
  const [chatType, setChatType] = useState('search'); // 'search' | 'agent'
  const [menuOpen, setMenuOpen] = useState(false);
  const [directThread, setDirectThread] = useState(null);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const { count: notifCount } = useUnreadNotifications('customer', currentUser?.id);

  const openDirectChat = async (zimmer) => {
    if (!currentUser) return;
    setDetailZimmer(null);
    try {
      const t = await getOrCreateDirectThread({ zimmer, customer: currentUser });
      setDirectThread(t);
    } catch (e) {
      alert("לא הצלחתי לפתוח צ'אט ישיר. נסה שוב.");
    }
  };

  const handleNewSearch = () => {
    clearPersistedChat();
    setChatType('search');
    setMessages([]);
    setPendingBooking(null);
    setQuickOptions([]);
    setSearchDates(null);
    setActivePromo(null);
    currentSessionId = null;
    sessionMessages = [];
    sessionZimmerIds = [];
    setTimeout(() => { initChat(); }, 50);
  };

  const openBookingFromDrawer = (zimmer) => {
    setDetailZimmer(null);
    setPendingBooking(zimmer);
    addMessage('bot', 'booking_form', zimmer, { searchDates });
    setQuickOptions([]);
  };

  const askAboutZimmer = (zimmer) => {
    setDetailZimmer(null);
    setInput(`בנוגע לצימר "${zimmer.name}": `);
    setQuickOptions([]);
  };

  useEffect(() => {
    api.entities.Zimmer.list().then(setZimmers);
    let cancelled = false;
    (async () => {
      let user = null;
      try {
        user = await api.auth.me();
        if (!cancelled) setCurrentUser(user);
      } catch { /* guest */ }
      if (cancelled) return;
      const ownerKey = user?.id || 'guest';

      const resumeId = sessionStorage.getItem('resume_session_id');
      const resumeMessages = sessionStorage.getItem('resume_messages');
      if (resumeId && resumeMessages) {
        // History resume is only for the signed-in owner of those sessions
        if (!user) {
          sessionStorage.removeItem('resume_session_id');
          sessionStorage.removeItem('resume_messages');
        } else {
          sessionStorage.removeItem('resume_session_id');
          sessionStorage.removeItem('resume_messages');
          clearPersistedChat();
          currentSessionId = resumeId;
          try {
            const prev = JSON.parse(resumeMessages);
            const restored = prev.map((m, i) => ({
              id: Date.now() + i,
              role: m.role === 'user' ? 'user' : 'bot',
              type: 'text',
              content: m.content,
              time: m.time || '',
            }));
            const continuationMsg = {
              id: Date.now() + 9999,
              role: 'bot',
              type: 'text',
              content: '👋 ממשיכים מאיפה שעצרנו! במה אוכל לעזור?',
              time: formatTime(),
            };
            setMessages([...restored, continuationMsg]);
            return;
          } catch { /* fall through */ }
        }
      }

      const persisted = loadPersistedChat();
      if (persisted && persisted.ownerKey && persisted.ownerKey !== ownerKey) {
        clearPersistedChat();
      } else if (
        persisted &&
        persisted.ownerKey === ownerKey &&
        Array.isArray(persisted.messages) &&
        persisted.messages.length > 0
      ) {
        currentSessionId = persisted.sessionId || null;
        sessionMessages = persisted.sessionMessages || [];
        sessionZimmerIds = persisted.sessionZimmerIds || [];
        if (persisted.searchDates) setSearchDates(persisted.searchDates);
        if (Array.isArray(persisted.quickOptions) && persisted.quickOptions.length) {
          setQuickOptions(persisted.quickOptions);
        }
        setMessages(persisted.messages);
        return;
      }
      initChat();
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Persist current chat so it resumes where the customer left off (until they start a new search)
  useEffect(() => {
    if (messages.length > 0) {
      persistChat({
        ownerKey: currentUser?.id || 'guest',
        messages,
        searchDates,
        quickOptions,
        sessionMessages,
        sessionZimmerIds,
        sessionId: currentSessionId,
      });
    }
  }, [messages, searchDates, quickOptions, currentUser]);

  // Load a promotion the customer clicked from the Promotions page
  useEffect(() => {
    const ctx = sessionStorage.getItem('promo_context');
    if (!ctx) return;
    sessionStorage.removeItem('promo_context');
    (async () => {
      try {
        const { promoId, action } = JSON.parse(ctx);
        const promo = await api.entities.Promotion.get(promoId);
        if (!promo || promo.status !== 'פעיל') return;
        const zimmer = await api.entities.Zimmer.get(promo.zimmer_id);
        if (!zimmer) return;
        const nights = Math.round((new Date(promo.check_out) - new Date(promo.check_in)) / 86400000);
        const promoDates = { checkIn: promo.check_in, checkOut: promo.check_out, numGuests: 2, num_adults: 2, num_children: 0 };
        setActivePromo({ promo, zimmer });
        setSearchDates(promoDates);
        addMessage('bot', 'text', `🔥 מבצע! ${zimmer.name} — ${promo.discount_percent}% הנחה ל-${nights} לילות (${promo.check_in} עד ${promo.check_out}). המחיר כבר מעודכן בהנחה.`);
        addMessage('bot', 'zimmers', [zimmer]);
        if (action === 'book') {
          setPendingBooking(zimmer);
          addMessage('bot', 'booking_form', zimmer, { searchDates: promoDates, promo });
          setQuickOptions([{ label: '💬 שאל שאלה על המקום', text: `בנוגע לצימר "${zimmer.name}": ` }]);
        } else {
          setQuickOptions([
            { label: '💬 שאל שאלה על המקום', text: `בנוגע לצימר "${zimmer.name}": ` },
            { label: '📅 הזמן במבצע', text: 'אני רוצה להזמין את המבצע' },
          ]);
        }
      } catch (e) { /* silent */ }
    })();
  }, []);

  const initChat = () => {
    currentSessionId = null;
    sessionMessages = [];
    sessionZimmerIds = [];
    setSearchDates(null);
    // Show welcome + date picker
    setMessages([
      {
        id: Date.now(),
        role: 'bot',
        type: 'text',
        content: 'שלום! 👋 אני כאן לעזור לך למצוא את הצימר המושלם.\nבחר תאריכים כדי שאציג לך רק מקומות פנויים:',
        time: formatTime()
      },
      {
        id: Date.now() + 1,
        role: 'bot',
        type: 'date_search',
        content: null,
        time: formatTime()
      }
    ]);
  };

  const saveSession = async (msgs, zimmerIds, bookingCreated = false) => {
    try {
      const user = currentUser;
      if (!user) return;
      const sessionData = {
        user_id: user.id,
        user_name: user.full_name,
        user_email: user.email,
        messages: msgs.filter(m => m.type === 'text').map(m => ({ role: m.role, content: m.content, time: m.time })),
        zimmer_ids_shown: [...new Set(zimmerIds)],
        booking_created: bookingCreated,
      };
      if (currentSessionId) {
        await api.entities.ChatSession.update(currentSessionId, sessionData);
      } else {
        const s = await api.entities.ChatSession.create(sessionData);
        currentSessionId = s.id;
      }
    } catch (e) { /* silent */ }
  };

  const addMessage = (role, type, content, extra = {}) => {
    const msg = { id: Date.now() + Math.random(), role, type, content, time: formatTime(), ...extra };
    setMessages(prev => [...prev, msg]);
    return msg;
  };

  // Get available zimmer IDs after filtering out booked ones for given dates
  const getAvailableZimmerIds = async (checkIn, checkOut) => {
    const bookedIds = await getBookedZimmerIds(api, checkIn, checkOut);
    return bookedIds;
  };

  const handleDateSearch = async (searchParams) => {
    setSearchDates(searchParams);
    setQuickOptions([]);

    let checkIn, checkOut, priceCheckIn, priceCheckOut, label;
    const numAdults = searchParams.num_adults || 0;
    const numChildren = searchParams.num_children || 0;
    if (searchParams.mode === 'exact') {
      checkIn = searchParams.checkIn;
      checkOut = searchParams.checkOut;
      priceCheckIn = checkIn;
      priceCheckOut = checkOut;
      const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
      label = `${checkIn} עד ${checkOut} (${nights} לילות), ${searchParams.numGuests} אורחים`;
    } else {
      // For flexible search, we'll check availability across the range
      checkIn = searchParams.rangeStart;
      checkOut = searchParams.rangeEnd;
      priceCheckIn = checkIn;
      priceCheckOut = new Date(new Date(checkIn).getTime() + (searchParams.numNights * 86400000)).toISOString().split('T')[0];
      label = `${searchParams.numNights} לילות בין ${searchParams.rangeStart} ל-${searchParams.rangeEnd}, ${searchParams.numGuests} אורחים`;
    }

    let searchLabel = label;
    if (searchParams.regions?.length) searchLabel += `, אזור: ${searchParams.regions.join('/')}`;
    else if (searchParams.freeText) searchLabel += `, ${searchParams.freeText}`;
    if (searchParams.max_budget) searchLabel += `, עד ${formatILS(searchParams.max_budget)} ללילה`;
    if (searchParams.amenities?.length) searchLabel += `, ${searchParams.amenities.length} מתקנים`;
    const userMsg = `🔍 מחפש: ${searchLabel}`;
    addMessage('user', 'text', userMsg);
    setIsTyping(true);

    try {
      const response = await api.assistant.chat({
        profile: 'customer_date_search',
        message: userMsg,
        conversationId: currentSessionId,
        clientState: { searchParams, surface: 'customer' },
      });
      const freshZimmers = await api.entities.Zimmer.filter({ approval_status: 'אושר' });
      setZimmers(freshZimmers);

      if (response.conversationId) {
        currentSessionId = response.conversationId;
      }

      await applyCustomerUiEffects({
        response,
        zimmers: freshZimmers,
        searchDates: searchParams,
        actions: {
          onBotText: (content) => addMessage('bot', 'text', content),
          onShowZimmers: (found, ids) => {
            if (found.length > 0) {
              sessionZimmerIds.push(...ids);
              addMessage('bot', 'zimmers', found);
            }
          },
          onQuickOptions: (options) => setQuickOptions(options),
          onDateSearchWidget: () => {
            setMessages(prev => [...prev, {
              id: Date.now() + Math.random(),
              role: 'bot',
              type: 'date_search',
              content: null,
              time: formatTime()
            }]);
          },
        },
      });

    } catch (e) {
      addMessage('bot', 'text', 'מצטער, אירעה שגיאה. נסה שוב.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text) return;
    setInput('');
    setQuickOptions([]);

    if (text.toLowerCase().includes(RESET_WORD.toLowerCase())) {
      setMessages([]);
      setPendingBooking(null);
      setQuickOptions([]);
      setSearchDates(null);
      setTimeout(() => { initChat(); }, 100);
      return;
    }

    // If user wants to change dates
    if (text.includes('שנה תאריכים') || text.includes('תאריכים אחרים')) {
      setSearchDates(null);
      addMessage('user', 'text', text);
      addMessage('bot', 'text', 'בחר תאריכים חדשים:');
      setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', type: 'date_search', content: null, time: formatTime() }]);
      return;
    }

    // Fill the input with the question prefix only when it's the bare template (no actual question yet)
    if (/^בנוגע לצימר\s*"[^"]*"\s*:?\s*$/.test(text)) {
      setInput(text);
      return;
    }
    // Book the active promotion directly (keeps the discounted price)
    if (text.includes('הזמן במבצע') && activePromo) {
      const promoDates = { checkIn: activePromo.promo.check_in, checkOut: activePromo.promo.check_out, numGuests: 2, num_adults: 2, num_children: 0 };
      addMessage('user', 'text', text);
      setPendingBooking(activePromo.zimmer);
      setSearchDates(promoDates);
      addMessage('bot', 'booking_form', activePromo.zimmer, { searchDates: promoDates, promo: activePromo.promo });
      setQuickOptions([]);
      return;
    }

    addMessage('user', 'text', text);
    setIsTyping(true);

    try {
      const recentTurns = buildRecentTurns(messages);
      const response = await api.assistant.chat({
        profile: 'customer_chat',
        message: text,
        conversationId: currentSessionId,
        clientState: { searchDates, recentTurns, surface: 'customer' },
      });
      const freshZimmers = await api.entities.Zimmer.filter({ approval_status: 'אושר' });
      setZimmers(freshZimmers);

      if (response.conversationId) {
        currentSessionId = response.conversationId;
      }

      let gotQuickOptions = false;
      await applyCustomerUiEffects({
        response,
        zimmers: freshZimmers,
        searchDates,
        userMessage: text,
        actions: {
          onBotText: (content) => addMessage('bot', 'text', content),
          onShowZimmers: (found, ids) => {
            if (found.length > 0) {
              sessionZimmerIds.push(...ids);
              addMessage('bot', 'zimmers', found);
            }
          },
          onShowZimmer: (z) => {
            sessionZimmerIds.push(z.id);
            addMessage('bot', 'zimmers', [z]);
            setQuickOptions([
              { label: '💬 שאל שאלה', text: `בנוגע לצימר "${z.name}": ` },
              { label: '📅 הזמן', text: `אני רוצה להזמין את ${z.name}` },
            ]);
            gotQuickOptions = true;
          },
          onQuickOptions: (options) => {
            gotQuickOptions = true;
            setQuickOptions(options);
          },
          onBookingForm: (z, dates) => {
            addMessage('bot', 'zimmers', [z]);
            setPendingBooking(z);
            addMessage('bot', 'booking_form', z, { searchDates: dates || searchDates });
            setQuickOptions([]);
            gotQuickOptions = true;
          },
          onUnansweredQuestion: async (z) => {
            const searchSummary = searchDates
              ? (searchDates.checkIn
                  ? `${searchDates.checkIn} עד ${searchDates.checkOut}, ${searchDates.numGuests} אורחים`
                  : `${searchDates.numNights} לילות בין ${searchDates.rangeStart} ל-${searchDates.rangeEnd}, ${searchDates.numGuests} אורחים`)
              : null;
            addMessage('bot', 'question_form', z, { question: text, searchSummary });
          },
        },
      });

      if (!gotQuickOptions) {
        setQuickOptions([
          { label: '💬 שאלה נוספת', text: 'יש לי שאלה נוספת' },
          { label: '🔄 שנה תאריכים', text: 'אני רוצה לשנות תאריכים' },
        ]);
      }

    } catch (e) {
      addMessage('bot', 'text', 'מצטער, אירעה שגיאה. נסה שוב.');
    } finally {
      setIsTyping(false);
    }
  };


  const handleBookingSubmit = async (data, zimmer) => {
    // Final availability check before saving
    const bookedIds = await getBookedZimmerIds(api, data.check_in, data.check_out);
    if (bookedIds.includes(zimmer.id)) {
      addMessage('bot', 'text', `⚠️ הצימר *${zimmer.name}* כבר תפוס בתאריכים שבחרת. נסה תאריכים אחרים.`);
      setPendingBooking(null);
      setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', type: 'date_search', content: null, time: formatTime() }]);
      return;
    }

    try {
      await api.entities.BookingRequest.create({
        zimmer_id: zimmer.id,
        zimmer_name: zimmer.name,
        owner_id: zimmer.owner_id,
        ...data,
        status: 'ממתינה'
      });
      setPendingBooking(null);
      const newMsg = { id: Date.now() + Math.random(), role: 'bot', type: 'text', content: `✅ בקשת ההזמנה שלך לצימר *${zimmer.name}* התקבלה! בעל הצימר יצור איתך קשר בקרוב. תודה, ${data.guest_name}! 🎉`, time: formatTime() };
      setMessages(prev => {
        const updated = [...prev, newMsg];
        saveSession(updated, sessionZimmerIds, true);
        return updated;
      });
    } catch (e) {
      addMessage('bot', 'text', `⚠️ ${bookingErrorMessage(e)}`);
    }
  };

  const handleQuestionSubmit = async (qText, zimmer, searchSummary) => {
    try {
      await api.entities.UnansweredQuestion.create({
        zimmer_id: zimmer.id,
        zimmer_name: zimmer.name,
        owner_id: zimmer.owner_id,
        question: qText,
        session_id: currentSessionId || '',
        customer_search_summary: searchSummary || null,
        customer_name: currentUser?.full_name || '',
        status: 'ממתינה',
      });
      addMessage('bot', 'text', `✅ השאלה שלך הועברה לבעל ${zimmer.name}. תקבל תשובה בפאנל האישי תחת "עדכונים" ברגע שיענה 🙏`);
    } catch (e) {
      addMessage('bot', 'text', 'מצטער, לא הצלחתי לשלוח את השאלה. נסה שוב.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#ECE5DD]" dir="rtl" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c5b8ac' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
      {/* Header */}
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3 shadow-md relative">
        <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-lg">{chatType === 'search' ? 'Z' : '✈'}</div>
        <div className="flex-1">
          <div className="font-semibold text-base">{chatType === 'search' ? BOT_NAME : 'סוכן נופש אישי'}</div>
          <div className="text-xs text-green-200">{chatType === 'search' ? 'מחובר ●' : 'המלצות לחופשה ●'}</div>
        </div>
        {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
        <div className="flex items-center gap-1">
          <button onClick={() => setUpdatesOpen(true)} title="עדכונים" className="relative p-1.5 rounded-lg hover:bg-white/10">
            <Bell size={20} />
            {notifCount > 0 && (
              <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center" style={{ border: '1.5px solid #075E54' }}>{notifCount > 99 ? '99+' : notifCount}</span>
            )}
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)} className="p-1 rounded-lg hover:bg-white/10">
              <MoreVertical size={20} />
            </button>
            {menuOpen && (
              <div className="absolute left-0 mt-2 w-48 bg-white text-gray-800 rounded-xl shadow-xl z-50 overflow-hidden" dir="rtl">
                <a href="/customer-portal" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100"><User size={15}/> פאנל אישי</a>
                <a href="/promotions" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100"><Tag size={15}/> מבצעים</a>
                <button onClick={() => { setMenuOpen(false); handleNewSearch(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 text-right"><PlusCircle size={15}/> צ'אט חיפוש חדש</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat type switcher */}
      <div className="bg-[#0b6e62] px-4 py-2 flex gap-2">
        <button onClick={() => setChatType('search')} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${chatType === 'search' ? 'bg-white text-[#075E54]' : 'text-white/80 hover:bg-white/10'}`}><SearchIcon size={13} /> חיפוש והזמנות</button>
        <button onClick={() => setChatType('agent')} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${chatType === 'agent' ? 'bg-white text-[#075E54]' : 'text-white/80 hover:bg-white/10'}`}><Sparkles size={13} /> סוכן נופש אישי</button>
      </div>

      {chatType === 'search' ? (
      <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            searchDates={searchDates}
            onBookingSubmit={handleBookingSubmit}
            onDateSearch={handleDateSearch}
            onZimmerClick={setDetailZimmer}
            onQuestionSubmit={handleQuestionSubmit}
          />
        ))}
        {isTyping && <TypingIndicator />}
        {!isTyping && quickOptions.length > 0 && (
          <QuickOptions options={quickOptions} onSelect={handleSend} />
        )}
        <div ref={messagesEndRef} />
      </div>

      {detailZimmer && (
        <ZimmerDetailDrawer
          zimmer={detailZimmer}
          onClose={() => setDetailZimmer(null)}
          onBook={openBookingFromDrawer}
          onAsk={askAboutZimmer}
          onDirectChat={openDirectChat}
          searchDates={searchDates}
        />
      )}

      {directThread && (
        <DirectChat
          thread={directThread}
          isOwner={false}
          user={currentUser}
          counterpartName={directThread.owner_name}
          zimmerName={directThread.zimmer_name}
          onClose={() => setDirectThread(null)}
        />
      )}

      {/* Input */}
      <div className="bg-[#F0F0F0] px-3 py-3 flex items-end gap-2">
        <button
          onClick={() => handleSend(null)}
          disabled={!input.trim() || isTyping}
          className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-md hover:bg-[#128C7E] transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <Send size={20} />
        </button>
        <div className="flex-1 bg-white rounded-full px-4 py-3 flex items-center shadow-sm min-h-[48px]">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="כתוב הודעה..."
            className="w-full bg-transparent outline-none resize-none text-gray-800 text-sm leading-5 max-h-32"
            rows={1}
            style={{ direction: 'rtl' }}
          />
        </div>
      </div>
      </>
      ) : (
        <VacationAgentChat user={currentUser} onSwitchToSearch={() => setChatType('search')} />
      )}

      {updatesOpen && (
        <div className="fixed inset-0 z-[70]" onClick={() => setUpdatesOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.28)' }} />
          <div
            className="absolute animate-in slide-in-from-top-2 duration-200"
            style={{ top: 14, left: '50%', transform: 'translateX(-50%)' }}
            onClick={e => e.stopPropagation()}
          >
            <UpdatesPopover
              userId={currentUser?.id}
              fullUserName={currentUser?.full_name}
              onGoAll={() => { setUpdatesOpen(false); window.location.href = '/customer-portal?updates=1'; }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, searchDates, onBookingSubmit, onDateSearch, onZimmerClick, onQuestionSubmit }) {
  const isBot = msg.role === 'bot';

  if (msg.type === 'date_search') {
    return (
      <div className="flex items-end gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">Z</div>
        <div className="flex-1 max-w-sm">
          <DateSearchWidget onSearch={onDateSearch} />
          <div className="text-xs text-gray-400 mt-1 mr-1">{msg.time}</div>
        </div>
      </div>
    );
  }

  if (msg.type === 'zimmers') {
    return (
      <div className="flex items-end gap-2 mb-3">
        {isBot && <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">Z</div>}
        <div className="flex-1 max-w-sm">
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
            {msg.content.map(z => <ZimmerCard key={z.id} zimmer={z} onClick={onZimmerClick} searchDates={searchDates} />)}
          </div>
          <div className="text-xs text-gray-400 mt-1 mr-1">{msg.time}</div>
        </div>
      </div>
    );
  }

  if (msg.type === 'booking_form') {
    return (
      <div className="flex items-end gap-2 mb-3">
        {isBot && <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">Z</div>}
        <div className="flex-1 max-w-sm">
          <BookingForm zimmer={msg.content} onSubmit={onBookingSubmit} prefillDates={msg.searchDates} promo={msg.promo} />
          <div className="text-xs text-gray-400 mt-1 mr-1">{msg.time}</div>
        </div>
      </div>
    );
  }

  if (msg.type === 'question_form') {
    return (
      <div className="flex items-end gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">Z</div>
        <div className="flex-1 max-w-sm">
          <QuestionForm zimmer={msg.content} question={msg.question} onSubmit={(t) => onQuestionSubmit(t, msg.content, msg.searchSummary)} />
          <div className="text-xs text-gray-400 mt-1 mr-1">{msg.time}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 mb-1 ${!isBot ? 'flex-row-reverse' : ''}`}>
      {isBot && <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">Z</div>}
      <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl shadow-sm relative ${
        isBot
          ? 'bg-white text-gray-800 rounded-bl-sm'
          : 'bg-[#DCF8C6] text-gray-800 rounded-br-sm'
      }`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-xs text-gray-400">{msg.time}</span>
          {!isBot && <span className="text-xs text-blue-400">✓✓</span>}
        </div>
      </div>
    </div>
  );
}