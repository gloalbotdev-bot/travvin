import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/api/client';
import { Send, MoreVertical, User, Tag, PlusCircle, Search as SearchIcon, Sparkles, Bell, History as HistoryIcon, Plus, AlertTriangle } from 'lucide-react';
import ZimmerCard from '@/components/chat/ZimmerCard';
import ZimmerDetailDrawer from '@/components/chat/ZimmerDetailDrawer';
import BookingForm from '@/components/chat/BookingForm';
import QuickOptions from '@/components/chat/QuickOptions';
import DateSearchWidget, { getBookedZimmerIds, datesOverlap } from '@/components/chat/DateSearchWidget';
import { rankZimmersByFit, zimmerPriceSummary, formatILS } from '@/lib/bookingPrice';
import { REGION_KEYWORDS } from '@/lib/regions';
import VacationAgentChat from '@/components/chat/VacationAgentChat';
import DirectChat, { getOrCreateDirectThread } from '@/components/chat/DirectChat';
import QuestionForm from '@/components/chat/QuestionForm';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import UpdatesPopover from '@/components/chat/UpdatesPopover';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';
import CustomerBottomNav from '@/components/customer/CustomerBottomNav';
import ChatHistoryOverlay from '@/components/chat/ChatHistoryOverlay';
import { MESSAGE_LIMIT, HISTORY_PAGE_SIZE, isArchivable, fmtHistoryDate, countRealMessages } from '@/lib/chatHistory';

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
  const { ref: inputRef, resize: resizeInput } = useAutoResize(input, 140);
  const { count: notifCount } = useUnreadNotifications('customer', currentUser?.id);
  // Multi-conversation chat history state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAll, setHistoryAll] = useState([]);
  const [historyVisible, setHistoryVisible] = useState(HISTORY_PAGE_SIZE);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [lockedView, setLockedView] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [activeSession, setActiveSession] = useState(null);

  const openDirectChat = async (zimmer) => {
    if (!currentUser) return;
    setDetailZimmer(null);
    try {
      const t = await getOrCreateDirectThread({ zimmer, customer: currentUser });
      setDirectThread(t);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('openDirectChat failed:', e);
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
    setLockedView(false);
    setActiveSession(null);
    setInput('');
    currentSessionId = null;
    sessionMessages = [];
    sessionZimmerIds = [];
    setTimeout(() => { initChat(); }, 50);
  };

  // Load the full ChatSession history (sorted newest-first) for the history overlay.
  const loadCustomerHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const list = await api.entities.ChatSession.filter({}, '-created_date', 100);
      setHistoryAll(Array.isArray(list) ? list : []);
    } catch {
      setHistoryAll([]);
    }
    setHistoryLoading(false);
  }, []);

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryVisible(HISTORY_PAGE_SIZE);
    await loadCustomerHistory();
  }, [loadCustomerHistory]);

  // Render a past ChatSession's text messages into the chat. Locked sessions
  // are shown read-only (input hidden, banner shown); a non-locked one becomes
  // the active session the customer can continue in.
  const handleHistorySelect = useCallback(async (item) => {
    setHistoryOpen(false);
    if (item && item.id && item.id === currentSessionId) return;
    clearPersistedChat();
    setPendingBooking(null);
    setQuickOptions([]);
    setSearchDates(null);
    setActivePromo(null);
    setInput('');
    sessionZimmerIds = [];
    sessionMessages = [];
    try {
      const sess = await api.entities.ChatSession.get(item.id);
      const msgs = Array.isArray(sess.messages) ? sess.messages : [];
      const restored = msgs.map((m, i) => ({
        id: Date.now() + i,
        role: m.role === 'user' ? 'user' : 'bot',
        type: 'text',
        content: m.content || '',
        time: m.time || '',
      }));
      setMessages(restored);
      currentSessionId = sess.id;
      setActiveSession({ id: sess.id, locked: !!sess.locked });
      setLockedView(!!sess.locked);
    } catch {
      setLockedView(false);
    }
  }, []);

  // Split the current session at the message limit: summarize, lock the old
  // ChatSession, create a new one whose opening message presents the summary,
  // and switch the chat to it.
  const handleCustomerSplit = useCallback(async () => {
    if (splitting || !currentSessionId) return;
    setSplitting(true);
    try {
      const res = await api.functions.invoke('splitCustomerChat', { session_id: currentSessionId });
      const data = res && res.data ? res.data : res;
      const newId = data && data.new_session_id;
      if (!newId) { setSplitting(false); return; }
      clearPersistedChat();
      setPendingBooking(null);
      setQuickOptions([]);
      setSearchDates(null);
      setActivePromo(null);
      setInput('');
      sessionZimmerIds = [];
      sessionMessages = [];
      currentSessionId = newId;
      setActiveSession({ id: newId, locked: false });
      setLockedView(false);
      const openingContent = (data && data.opening_content) || 'המשך מאיפה שעצרנו — הנה מה שכבר ידוע מהשיחה הקודמת.';
      setMessages([{ id: Date.now(), role: 'bot', type: 'text', content: openingContent, time: formatTime() }]);
      await loadCustomerHistory();
    } catch (e) {
      // never block the user on a failed split
    }
    setSplitting(false);
  }, [splitting, loadCustomerHistory]);

  // Populate the history list on mount so the history-dot + overlay have data.
  useEffect(() => {
    if (currentUser) loadCustomerHistory();
  }, [currentUser, loadCustomerHistory]);

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
    (async () => {
      api.entities.Zimmer.list().then(setZimmers);
      let meUser = null;
      try { meUser = await api.auth.me(); setCurrentUser(meUser); } catch {}

      // --- One-time archive block (idempotent, device-independent) ---
      let lastSession = null;
      try {
        const lastList = await api.entities.ChatSession.filter({}, '-created_date', 1);
        lastSession = lastList && lastList[0];
      } catch {}
      if (lastSession && isArchivable(lastSession)) {
        try {
          await api.entities.ChatSession.update(lastSession.id, { archived: true, locked: true });
          clearPersistedChat();
          currentSessionId = null;
          sessionMessages = [];
          sessionZimmerIds = [];
          initChat();
          return;
        } catch {}
      }

      const resumeId = sessionStorage.getItem('resume_session_id');
      const resumeMessages = sessionStorage.getItem('resume_messages');
      if (resumeId && resumeMessages) {
        sessionStorage.removeItem('resume_session_id');
        sessionStorage.removeItem('resume_messages');
        clearPersistedChat();
        currentSessionId = resumeId;
        try { setActiveSession({ id: resumeId, locked: false }); } catch {}
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
      const persisted = loadPersistedChat();
      if (persisted && Array.isArray(persisted.messages) && persisted.messages.length > 0) {
        const pid = persisted.sessionId || null;
        // If the persisted session is now locked (e.g. split on another device),
        // start fresh instead of restoring a read-only session into the live chat.
        if (lastSession && pid && lastSession.id === pid && lastSession.locked) {
          clearPersistedChat();
          currentSessionId = null;
          sessionMessages = [];
          sessionZimmerIds = [];
          initChat();
          return;
        }
        currentSessionId = pid;
        try { setActiveSession(pid ? { id: pid, locked: false } : null); } catch {}
        sessionMessages = persisted.sessionMessages || [];
        sessionZimmerIds = persisted.sessionZimmerIds || [];
        if (persisted.searchDates) setSearchDates(persisted.searchDates);
        if (Array.isArray(persisted.quickOptions) && persisted.quickOptions.length) setQuickOptions(persisted.quickOptions);
        setMessages(persisted.messages);
        return;
      }
      initChat();
    })();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus the input on load and whenever the customer is in the search chat
  useEffect(() => {
    if (chatType === 'search') inputRef.current?.focus();
  }, [chatType]);

  // Persist current chat so it resumes where the customer left off (until they start a new search)
  useEffect(() => {
    if (messages.length > 0) {
      persistChat({
        messages,
        searchDates,
        quickOptions,
        sessionMessages,
        sessionZimmerIds,
        sessionId: currentSessionId,
      });
    }
  }, [messages, searchDates, quickOptions]);

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

  // All writes go through the appendChatMessage backend function, which
  // enforces the locked flag server-side — a locked (read-only) session can
  // no longer be written to, even from a tampered client.
  const saveSession = async (msgs, zimmerIds, bookingCreated = false) => {
    try {
      const user = currentUser;
      if (!user) return;
      const textMsgs = msgs
        .filter(m => m.type === 'text')
        .map(m => ({ role: m.role === 'bot' ? 'assistant' : m.role, content: m.content, time: m.time || '' }));
      const res = await api.functions.invoke('appendChatMessage', {
        session_id: currentSessionId || null,
        messages: textMsgs,
        zimmer_ids: [...new Set(zimmerIds)],
        booking_created: bookingCreated,
        user_name: user.full_name,
        user_email: user.email,
      });
      const data = res && res.data ? res.data : res;
      if (data && data.session_id && !currentSessionId) {
        currentSessionId = data.session_id;
        try { setActiveSession({ id: data.session_id, locked: false }); } catch {}
      }
    } catch (e) { /* silent — locked/rejected writes are non-fatal */ }
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
    addMessage('user', 'text', `🔍 מחפש: ${searchLabel}`);
    setIsTyping(true);

    try {
      const freshZimmers = await api.entities.Zimmer.filter({ approval_status: 'אושר' });
      setZimmers(freshZimmers);

      // Get booked zimmer IDs for the date range
      const bookedIds = await getAvailableZimmerIds(checkIn, checkOut);

      // Filter: not booked + enough capacity
      let availableZimmers = freshZimmers.filter(z =>
        !bookedIds.includes(z.id) &&
        (!z.max_guests || z.max_guests >= searchParams.numGuests)
      );

      // Budget filter (per-night avg, partial-aware)
      if (searchParams.max_budget) {
        availableZimmers = availableZimmers.filter(z => {
          const price = zimmerPriceSummary(z, priceCheckIn, priceCheckOut, numAdults, numChildren);
          return price.avg <= searchParams.max_budget;
        });
      }

      // Region filter (macro-region keywords + free text)
      if (searchParams.regions?.length || searchParams.freeText) {
        availableZimmers = availableZimmers.filter(z => {
          const loc = (z.location || '').trim();
          if (!loc) return false;
          const regionMatch = (searchParams.regions || []).some(region =>
            (REGION_KEYWORDS[region] || []).some(kw => loc.includes(kw))
          );
          const freeMatch = searchParams.freeText && (loc.includes(searchParams.freeText) || searchParams.freeText.includes(loc));
          return regionMatch || freeMatch;
        });
      }

      // Rank: closest fill to the group first, then bigger places
      availableZimmers = rankZimmersByFit(availableZimmers, numAdults, numChildren);

      setIsTyping(false);

      if (availableZimmers.length === 0) {
        addMessage('bot', 'text', `😔 לא מצאתי צימרים פנויים לתאריכים האלו עבור ${searchParams.numGuests} אורחים. נסה תאריכים אחרים!`);
        setMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          role: 'bot',
          type: 'date_search',
          content: null,
          time: formatTime()
        }]);
        return;
      }

      let contextText = searchParams.mode === 'flexible'
        ? `מחפש ${searchParams.numNights} לילות בין ${searchParams.rangeStart} ל-${searchParams.rangeEnd}, ${numAdults} מבוגרים ו-${numChildren} ילדים`
        : `מחפש מ-${checkIn} עד ${checkOut}, ${numAdults} מבוגרים ו-${numChildren} ילדים`;
      let amensText = '';
      if (searchParams.max_budget) contextText += `, תקציב עד ${formatILS(searchParams.max_budget)} ללילה`;
      if (searchParams.regions?.length) contextText += `, אזור: ${searchParams.regions.join(' / ')}`;
      if (searchParams.freeText) contextText += `, חיפוש חופשי: "${searchParams.freeText}"`;
      if (searchParams.amenities?.length) {
        amensText = `\nמתקנים מבוקשים: ${searchParams.amenities.join(', ')}`;
        contextText += amensText;
      }

      const zimmerContext = availableZimmers.map(z => {
        const zones = (z.data_zones || []).map((dz, i) =>
          `[${dz.source_type || 'מידע'}]: ${dz.content || ''}`
        ).join('\n');
        const price = zimmerPriceSummary(z, priceCheckIn, priceCheckOut, numAdults, numChildren);
        const priceLine = price.isPartial
          ? `מחיר ללילה: ${formatILS(price.avg)} (תמחור חלקי לפי אדם, סה"כ ${formatILS(price.total)} ל-${price.nights} לילות)`
          : `מחיר ללילה: ${formatILS(price.avg)} (מחיר מלא, סה"כ ${formatILS(price.total)} ל-${price.nights} לילות)`;
        return `--- ${z.name} (ID: ${z.id}) --- מיקום: ${z.location || 'לא צוין'} | ${priceLine} | חדרים: ${z.num_rooms || '?'} | אורחים מקס: ${z.max_guests || '?'} | תפוסה לקבוצה: ${Math.max(0, (z.max_guests||0) - searchParams.numGuests)} מקומות עודפים | ${zones}`;
      }).join('\n');

      const prompt = `אתה בוט צימרים. ענה בעברית בלבד.
${contextText}, ${searchParams.numGuests} אורחים.
הצימרים הפנויים הזמינים:
${zimmerContext}

דרג ובחר עד 5 הצימרים המתאימים ביותר. החזר JSON: {"action":"search","zimmer_ids":[...],"message":"..."}
חשוב מאוד: הצימרים להלן מסודרים מראש לפי התאמת קיבולת לכמות האורחים — מקומות שמתאימים בדיוק לכמות (לזוג: מקומות זוגיים, max_guests קרוב למספר האורחים) מופיעים ראשונים. החזר קודם את המתאימים בדיוק לכמות, בסדר הנתון. רק אם פחות מ-5 כאלה — השלם מהסוף עם צימרים גדולים יותר, גם בסדר הנתון. אל תעדיף צימר גדול על פני מתאים-בדיוק גם אם יש לו מתקנים.
${searchParams.amenities?.length ? 'אם יש מתקנים מבוקשים ועדיין נותרו מקומות פנויים באותה קיבולת מדויקת, העדף מביניהם את אלה שכוללים את המתקנים.' : ''}
message: הסבר קצר על התוצאות בעברית. JSON בלבד.`;

      const response = await api.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            message: { type: 'string' },
            zimmer_ids: { type: 'array', items: { type: 'string' } },
          }
        }
      });

      if (response.zimmer_ids?.length > 0) {
        if (response.message) addMessage('bot', 'text', response.message);
        const found = response.zimmer_ids.map(id => availableZimmers.find(z => z.id === id)).filter(Boolean);
        if (found.length > 0) {
          sessionZimmerIds.push(...response.zimmer_ids);
          addMessage('bot', 'zimmers', found);
          setQuickOptions([
            { label: '🔍 בחר צימר ושאל שאלות', text: 'אני רוצה לשאול שאלות על אחד מהצימרים' },
            { label: '📅 הזמן אונליין', text: 'אני רוצה להזמין אחד מהצימרים' },
            { label: '🔄 שנה תאריכים', text: 'אני רוצה לשנות תאריכים' },
          ]);
        }
      } else {
        addMessage('bot', 'text', response.message || `😔 לא מצאתי צימרים פנויים לתאריכים אלו. נסה תאריכים אחרים.`);
        setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', type: 'date_search', content: null, time: formatTime() }]);
      }

      setMessages(prev => { saveSession(prev, sessionZimmerIds); return prev; });
    } catch (e) {
      setIsTyping(false);
      addMessage('bot', 'text', 'מצטער, אירעה שגיאה. נסה שוב.');
    }
  };

  const handleSend = async (overrideText) => {
    if (lockedView) return;
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
      const freshZimmers = await api.entities.Zimmer.filter({ approval_status: 'אושר' });
      setZimmers(freshZimmers);

      // Filter by availability if we have dates
      let availableZimmers = freshZimmers;
      let datesInfo = '';
      let numAdults = 0, numChildren = 0, priceCheckIn = null, priceCheckOut = null;
      if (searchDates) {
        const checkIn = searchDates.checkIn || searchDates.rangeStart;
        const checkOut = searchDates.checkOut || searchDates.rangeEnd;
        const bookedIds = await getBookedZimmerIds(api, checkIn, checkOut);
        availableZimmers = freshZimmers.filter(z =>
          !bookedIds.includes(z.id) &&
          (!z.max_guests || z.max_guests >= (searchDates.numGuests || 1))
        );
        numAdults = searchDates.num_adults || 0;
        numChildren = searchDates.num_children || 0;
        if (searchDates.checkIn) {
          priceCheckIn = searchDates.checkIn;
          priceCheckOut = searchDates.checkOut;
          datesInfo = `תאריכי חיפוש: ${searchDates.checkIn} עד ${searchDates.checkOut}, ${numAdults} מבוגרים ו-${numChildren} ילדים.`;
        } else {
          priceCheckIn = searchDates.rangeStart;
          priceCheckOut = new Date(new Date(searchDates.rangeStart).getTime() + ((searchDates.numNights || 2) * 86400000)).toISOString().split('T')[0];
          datesInfo = `חיפוש גמיש: ${searchDates.numNights} לילות בין ${searchDates.rangeStart} ל-${searchDates.rangeEnd}, ${numAdults} מבוגרים ו-${numChildren} ילדים.`;
        }
        availableZimmers = rankZimmersByFit(availableZimmers, numAdults, numChildren);
      }

      const zimmerContext = availableZimmers.map(z => {
        const zones = (z.data_zones || []).map(dz => `[${dz.source_type || 'מידע'}]: ${dz.content || ''}`).join('\n');
        let priceStr = `מחיר: ${z.price_per_night ? z.price_per_night + '₪/לילה' : 'לא צוין'}`;
        if (priceCheckIn && priceCheckOut) {
          const price = zimmerPriceSummary(z, priceCheckIn, priceCheckOut, numAdults, numChildren);
          priceStr = price.isPartial
            ? `מחיר ללילה: ${formatILS(price.avg)} (תמחור חלקי, סה"כ ${formatILS(price.total)})`
            : `מחיר ללילה: ${formatILS(price.avg)} (מחיר מלא, סה"כ ${formatILS(price.total)})`;
        }
        return `--- ${z.name} (ID: ${z.id}) --- מיקום: ${z.location || 'לא צוין'} | ${priceStr} | חדרים: ${z.num_rooms || '?'} | אורחים מקס: ${z.max_guests || '?'}\n${zones}`;
      }).join('\n\n');

      const historyText = messages.slice(-20).map(m =>
        m.role === 'user' ? `לקוח: ${m.content}` : `בוט: ${typeof m.content === 'string' ? m.content : '[תוצאות]'}`
      ).join('\n');

      // Build customer context only on the first user turn, or when the user explicitly
      // asks about their bookings/profile — re-injecting it every turn makes the bot
      // "forget" the conversation and re-announce upcoming bookings unprompted.
      let customerContext = '';
      const priorUserTurns = messages.filter(m => m.role === 'user' && m.type === 'text').length;
      const asksAboutProfile = /הזמנ|היסטור|פרופיל|הבאה|קרובה|הבא שלי|ההזמנות שלי/.test(text);
      if (currentUser && (priorUserTurns === 0 || asksAboutProfile)) {
        try {
          // Fetch all bookings and match by email OR name (since guest submits name in form)
          const [bookings, sessions] = await Promise.all([
            api.entities.BookingRequest.filter({ created_by_id: currentUser.id }, '-created_date', 50),
            api.entities.ChatSession.filter({ user_id: currentUser.id }, '-created_date', 3),
          ]);
          const now = new Date();
          const upcoming = bookings
            .filter(b => new Date(b.check_in) >= now)
            .sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
          const past = bookings
            .filter(b => new Date(b.check_out) < now)
            .sort((a, b) => new Date(b.check_out) - new Date(a.check_out));
          const lastSearch = sessions[0];

          customerContext = `\nמידע על הלקוח המחובר (${currentUser.full_name}, ${currentUser.email}):`;
          if (upcoming.length > 0) {
            customerContext += `\n- הזמנות קרובות (${upcoming.length}):`;
            upcoming.slice(0, 3).forEach(u => {
              customerContext += `\n  • ${u.zimmer_name} מ-${u.check_in} עד ${u.check_out} (סטטוס: ${u.status})`;
            });
          } else {
            customerContext += `\n- אין הזמנות קרובות`;
          }
          if (past.length > 0) {
            const p = past[0];
            customerContext += `\n- הזמנה אחרונה שהסתיימה: ${p.zimmer_name} מ-${p.check_in} עד ${p.check_out} (${p.status})`;
          }
          if (bookings.length > 0) {
            customerContext += `\n- סה"כ ${bookings.length} הזמנות בהיסטוריה`;
          }
          if (lastSearch) {
            customerContext += `\n- חיפוש אחרון: ${new Date(lastSearch.created_date).toLocaleDateString('he-IL')}`;
          }
        } catch (e) { /* silent */ }
      }

      const today = new Date().toISOString().split('T')[0];
      const prompt = `אתה בוט צימרים. ענה בעברית בלבד. תאריך היום: ${today}. ${datesInfo}${customerContext}
נתוני צימרים פנויים:
${zimmerContext}

היסטוריה: ${historyText}
הודעה: "${text}"

הנחיות חובה:
- חובה מוחלטת: אתה בוט צימרים בלבד. אם בקשת הלקוח אינה קשורה לחיפוש צימר, חופשה, לינה, נופש, אזורי טיול או הזמנת הזמנה — לרבות אוכל, מתכונים, מוצרי מזון (כגון "חזה עוף"), מוצרים, חדשות, חידות או כל נושא זר — החזר action="answer" בלבד, עם zimmer_ids=[], zimmer_id=null, ו-message=הסבר קצר ונעים שאתה בוט צימרים ויכול לעזור רק בחיפוש והזמנת צימרים. אסור בשום אופן להחזיר zimmer_ids או להציע צימר כלשהו לבקשה שאינה רלוונטית למציאת צימר.
- רצף שיחה (חובה): כל עוד לא התבצע חיפוש חדש או צ'אט חדש, המשך את השיחה הנוכחית לפי ההיסטוריה למעלה. אל תתחיל מחדש, אל תציג שוב את אותם צימרים שכבר הוצגו, ואל תתנדב מידע על הזמנות/היסטוריה של הלקוח אלא אם הוא שואל עליהן ישירות. זרום עם השיחה הקיימת באופן חלק.
- סדר הצימרים הפנויים להלן מסודר מראש לפי התאמת קיבולת לכמות האורחים (כשיש תאריכים). העדף קודם צימרים שמתאימים בדיוק לכמות המבוקשת (לזוג — מקומות זוגיים); רק אם פחות מ-5 כאלה, השלם עם צימרים גדולים יותר מהסוף.
- ברירת מחדל: כשהלקוח שואל שאלת המשך על צימר שכבר מוזכר בשיחה (למשל "יש מקלחת פרטית?", "יש ארוחת בוקר?", "יש 4 חדרים?", "כמה מיטות?") — ענה טקסטואלית ב-action="answer" בלבד. אל תחזיר action="search" ואל תחזיר zimmer_ids כל עוד הלקוח נשאר על אותו צימר. המשך את אותה שיחה.
- החזר action="search" עם zimmer_ids רק כשהלקוח מבקש מפורשות: לראות תוצאות/אפשרויות חיפוש, לחפש מחדש, לעבור לצימר אחר, או לראות לראשונה את הדף של צימר חדש שטרם הוזכר. לעולם אל תחזיר שוב את אותו צימר שכבר מוזכר דרך action="search" אלא אם הלקוח מבקש מפורשות לראות את הדף שוב.
- לעולם אל תתחיל מידע לא קשור, פרופיל אישי או חיפוש מחדש כשהלקוח שואל שאלת המשך — הישאר בנושא של הצימר הנוכחי.
- בקשה לראות צימר ספציפי / "אני רוצה את צימר X" / "תראה לי את צימר X" / ראיית דף צימר / תמונות / פרטים מלאים / "תן לי לראות את הצימר" / "תראה לי את הדף" / "פרטים מלאים" / "פתח דף צימר" → action="search" עם zimmer_ids=[<id של הצימר>], message="...". לעולם אל תחזיר action="view". הצגת הצימר תיעשה תמיד ככרטיס תוצאה בתוך הצאט, והלקוח יוכל ללחוץ עליו כדי לפתוח את הדף.
      - בקשה להזמין צימר שמוזכר בשיחה → action="booking", zimmer_id="...", message="...", וכן החזר check_in ו-check_out בפורמט YYYY-MM-DD לפי תאריך היום למעלה. פתור ביטויי זמן יחסיים (כגון "היום","מחר","יום שישי הקרוב","סוף השבוע","בעוד שבוע") לתאריכים ברי-תוקף וודא ש-check_out מאוחר מ-check_in. אם התאריכים נמסרו דרך ווידג'ט החיפוש כבר (מופיעים ב-datesInfo) — החזר את אותם תאריכים. בנוסף החזר num_adults ו-num_children כפי שצוינו בשיחה (אם לא צוינו — החזר null). שדות אלו ישמשו לקדם-מילוי טופס ההזמנה באופן אוטומטי אך עריך.
      - חילוץ תאריכים/אורחים בכל תגובה: גם כש-action="search" או "answer", אם הלקוח ציין תאריכים ו/או כמות אורחים בטקסט החופשי — פתור אותם לתאריכים קונקרטיים (YYYY-MM-DD לפי תאריך היום) והחזר את check_in/check_out/num_adults/num_children, כדי שטופס ההזמנה יוכל להתמלא מראש גם כשנפתח מתוך כרטיס הצימר. אם לא צוינו תאריכים/אורחים — החזר null/השמט.
${customerContext ? '- שאלה על הפרופיל/הזמנות/היסטוריה של הלקוח (ללא צימרים ספציפיים כלל) → action="answer" וענה לפי "מידע על הלקוח" למעלה.' : ''}
- שאלה ספציפית על צימר שאין לך מידע עליה → action="answer", unanswered_question=true, zimmer_id="<id>", message="אין לי מידע על כך כרגע, אעביר את שאלתך לבעל הצימר".
- רק תשובות שאינן כוללות שום צימר ספציפי (שאלות כלליות, פרופיל, היסטוריה) → action="answer", message="...".
JSON בלבד.`;

      const response = await api.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            message: { type: 'string' },
            zimmer_ids: { type: 'array', items: { type: 'string' } },
            zimmer_id: { type: 'string' },
            unanswered_question: { type: 'boolean' },
            check_in: { type: 'string' },
            check_out: { type: 'string' },
            num_adults: { type: 'number' },
            num_children: { type: 'number' }
          }
        }
      });

      setIsTyping(false);

      if (response.action === 'search' && response.zimmer_ids?.length > 0) {
        if (response.message) addMessage('bot', 'text', response.message);
        const found = response.zimmer_ids.map(id => availableZimmers.find(z => z.id === id)).filter(Boolean);
        // Capture any dates/guests the customer mentioned in free text so the booking
        // form pre-fills even when opened later from the zimmer card / detail page.
        if (response.check_in || response.check_out || typeof response.num_adults === 'number' || typeof response.num_children === 'number') {
          setSearchDates(prev => {
            const prevA = (typeof prev?.num_adults === 'number') ? prev.num_adults : (prev?.num_adults ?? 2);
            const prevC = (typeof prev?.num_children === 'number') ? prev.num_children : (prev?.num_children ?? 0);
            const a = (typeof response.num_adults === 'number') ? response.num_adults : prevA;
            const c = (typeof response.num_children === 'number') ? response.num_children : prevC;
            return {
              ...(prev || {}),
              mode: 'exact',
              checkIn: response.check_in || prev?.checkIn || prev?.rangeStart || '',
              checkOut: response.check_out || prev?.checkOut || prev?.rangeEnd || '',
              num_adults: a,
              num_children: c,
              numGuests: (a + c) || prev?.numGuests || 1,
            };
          });
        }
        if (found.length > 0) {
          sessionZimmerIds.push(...response.zimmer_ids);
          addMessage('bot', 'zimmers', found);
          setQuickOptions([
            { label: '🔍 בחר צימר ושאל שאלות', text: 'אני רוצה לשאול שאלות על אחד מהצימרים' },
            { label: '📅 הזמן אונליין', text: 'אני רוצה להזמין אחד מהצימרים' },
            { label: '🔄 שנה תאריכים', text: 'אני רוצה לשנות תאריכים' },
          ]);
        }
      } else if (response.action === 'view') {
        // Show the requested zimmer as a search-result card in the chat (not auto-opened).
        if (response.message) addMessage('bot', 'text', response.message);
        let targetZimmer = availableZimmers.find(z => z.id === response.zimmer_id);
        if (!targetZimmer && response.zimmer_id) {
          try { targetZimmer = await api.entities.Zimmer.get(response.zimmer_id); } catch {}
        }
        if (targetZimmer) {
          sessionZimmerIds.push(targetZimmer.id);
          if (response.check_in || response.check_out || typeof response.num_adults === 'number' || typeof response.num_children === 'number') {
            setSearchDates(prev => {
              const prevA = (typeof prev?.num_adults === 'number') ? prev.num_adults : (prev?.num_adults ?? 2);
              const prevC = (typeof prev?.num_children === 'number') ? prev.num_children : (prev?.num_children ?? 0);
              const a = (typeof response.num_adults === 'number') ? response.num_adults : prevA;
              const c = (typeof response.num_children === 'number') ? response.num_children : prevC;
              return {
                ...(prev || {}),
                mode: 'exact',
                checkIn: response.check_in || prev?.checkIn || prev?.rangeStart || '',
                checkOut: response.check_out || prev?.checkOut || prev?.rangeEnd || '',
                num_adults: a,
                num_children: c,
                numGuests: (a + c) || prev?.numGuests || 1,
              };
            });
          }
          addMessage('bot', 'zimmers', [targetZimmer]);
          setQuickOptions([
            { label: '💬 שאל שאלה', text: `בנוגע לצימר "${targetZimmer.name}": ` },
            { label: '📅 הזמן', text: `אני רוצה להזמין את ${targetZimmer.name}` },
          ]);
        }
      } else if (response.action === 'booking') {
        if (response.message) addMessage('bot', 'text', response.message);
        const targetZimmer = availableZimmers.find(z => z.id === response.zimmer_id) || availableZimmers[0];
        if (targetZimmer) {
          addMessage('bot', 'zimmers', [targetZimmer]);
          setPendingBooking(targetZimmer);
          // Build the booking form prefill: merge existing search dates with whatever the
          // LLM extracted from the free-text conversation (dates + guests). The dates/guests
          // mentioned in chat take precedence, but everything stays editable in the form.
          const baseDates = searchDates || {};
          const prefillDates = {
            ...baseDates,
            checkIn: response.check_in || baseDates.checkIn || baseDates.rangeStart || '',
            checkOut: response.check_out || baseDates.checkOut || baseDates.rangeEnd || '',
            num_adults: (typeof response.num_adults === 'number') ? response.num_adults : baseDates.num_adults,
            num_children: (typeof response.num_children === 'number') ? response.num_children : (baseDates.num_children || 0),
            numGuests: (((typeof response.num_adults === 'number' ? response.num_adults : 0) + (typeof response.num_children === 'number' ? response.num_children : 0)) || baseDates.numGuests || 1),
          };
          addMessage('bot', 'booking_form', targetZimmer, { searchDates: prefillDates });
          setQuickOptions([]);
        }
      } else {
        // Check if this was an unanswered question about a specific zimmer
        if (response.unanswered_question && response.zimmer_id) {
          const targetZimmer = availableZimmers.find(z => z.id === response.zimmer_id);
          if (targetZimmer) {
            const searchSummary = searchDates
              ? (searchDates.checkIn
                  ? `${searchDates.checkIn} עד ${searchDates.checkOut}, ${searchDates.numGuests} אורחים`
                  : `${searchDates.numNights} לילות בין ${searchDates.rangeStart} ל-${searchDates.rangeEnd}, ${searchDates.numGuests} אורחים`)
              : null;
            addMessage('bot', 'text', response.message || 'אין לי מידע על כך כרגע. מלא את הטופס ואעביר את שאלתך לבעל הצימר 🙏');
            addMessage('bot', 'question_form', targetZimmer, { question: text, searchSummary });
          } else {
            addMessage('bot', 'text', response.message || 'מצטער, לא הצלחתי לעבד את הבקשה.');
          }
        } else if (response.zimmer_ids?.length > 0) {
          // Defensive: model attached zimmer_ids even under a non-search action — render the cards.
          const found = response.zimmer_ids.map(id => availableZimmers.find(z => z.id === id)).filter(Boolean);
          if (found.length > 0) addMessage('bot', 'zimmers', found);
          addMessage('bot', 'text', response.message || 'מצטער, לא הצלחתי לעבד את הבקשה.');
        } else {
          addMessage('bot', 'text', response.message || 'מצטער, לא הצלחתי לעבד את הבקשה.');
        }
        setQuickOptions([
          { label: '💬 שאלה נוספת', text: 'יש לי שאלה נוספת' },
          { label: '🔄 שנה תאריכים', text: 'אני רוצה לשנות תאריכים' },
        ]);
      }
      setMessages(prev => { saveSession(prev, sessionZimmerIds); return prev; });
    } catch (e) {
      setIsTyping(false);
      addMessage('bot', 'text', 'מצטער, אירעה שגיאה. נסה שוב.');
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

    let sourceVideoId = null;
    try { sourceVideoId = sessionStorage.getItem('discover_source_video') || null; if (sourceVideoId) sessionStorage.removeItem('discover_source_video'); } catch {}
    try {
      await api.entities.BookingRequest.create({
        zimmer_id: zimmer.id,
        zimmer_name: zimmer.name,
        owner_id: zimmer.owner_id,
        ...data,
        source_video_id: sourceVideoId,
        status: 'ממתינה'
      });
      // Mark matching active promotions as captured so they disappear from the deals page
      try {
        const promos = await api.entities.Promotion.filter({ zimmer_id: zimmer.id, status: 'פעיל' });
        for (const p of promos) {
          if (datesOverlap(data.check_in, data.check_out, p.check_in, p.check_out)) {
            await api.entities.Promotion.update(p.id, { status: 'נתפס' });
          }
        }
      } catch (e) { /* silent */ }
      setPendingBooking(null);
      const newMsg = { id: Date.now() + Math.random(), role: 'bot', type: 'text', content: `✅ בקשת ההזמנה שלך לצימר *${zimmer.name}* התקבלה! בעל הצימר יצור איתך קשר בקרוב. תודה, ${data.guest_name}! 🎉`, time: formatTime() };
      setMessages(prev => {
        const updated = [...prev, newMsg];
        saveSession(updated, sessionZimmerIds, true);
        return updated;
      });
    } catch (e) {
      addMessage('bot', 'text', 'מצטער, לא הצלחתי לשמור את הבקשה. נסה שוב.');
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
    <div className="flex flex-col h-screen overflow-hidden bg-[#ECE5DD]" dir="rtl" style={{ height: '100dvh', backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c5b8ac' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
      {/* Header */}
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3 shadow-md relative">
        <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-lg">{chatType === 'search' ? 'Z' : '✈'}</div>
        <div className="flex-1">
          <div className="font-semibold text-base">{chatType === 'search' ? BOT_NAME : 'סוכן נופש אישי'}</div>
          <div className="text-xs text-green-200">{chatType === 'search' ? 'מחובר ●' : 'המלצות לחופשה ●'}</div>
        </div>
        {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
        <div className="flex items-center gap-1">
          <button onClick={openHistory} title="היסטוריית צ'אטים" className="relative w-11 h-11 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20">
            <HistoryIcon size={22} />
            {historyAll.length > 0 && (
              <span className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full" style={{ background: '#F97316', border: '1.5px solid #075E54' }} />
            )}
          </button>
          <button onClick={() => setUpdatesOpen(true)} title="עדכונים" className="relative w-11 h-11 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20">
            <Bell size={22} />
            {notifCount > 0 && (
              <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center" style={{ border: '1.5px solid #075E54' }}>{notifCount > 99 ? '99+' : notifCount}</span>
            )}
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)} className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20">
              <MoreVertical size={22} />
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
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-1">
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
        {lockedView && (
          <div className="my-2 rounded-2xl px-4 py-3 text-center" style={{ background: 'rgba(107,114,128,0.08)', border: '1.5px solid rgba(107,114,128,0.25)', color: '#4B5563' }}>
            <p className="text-sm font-semibold">🔒 שיחה ארוכה זו נעולה לקריאה בלבד</p>
            <button onClick={handleNewSearch} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg text-white" style={{ background: '#075E54' }}>
              <Plus size={13} /> פתח צ'אט חיפוש חדש
            </button>
          </div>
        )}
        {!lockedView && currentSessionId && messages.filter(m => m.type === 'text').length >= MESSAGE_LIMIT && activeSession && !activeSession.locked && (
          <div className="my-2 rounded-2xl px-4 py-3 flex items-center gap-2.5" style={{ background: 'rgba(249,115,22,0.08)', border: '1.5px solid rgba(249,115,22,0.25)' }}>
            <AlertTriangle size={15} style={{ color: '#EA580C', flexShrink: 0 }} />
            <p className="text-xs flex-1" style={{ color: '#9A3412' }}>הגעת למגבלת {MESSAGE_LIMIT} הודעות. עבור לצ'אט חדש — אסכם ואמשיך משם.</p>
            <button onClick={handleCustomerSplit} disabled={splitting} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg text-white transition-all disabled:opacity-60" style={{ background: '#F97316' }}>
              {splitting ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> מסכם…</> : <><Plus size={13} /> עבור לצ'אט חדש</>}
            </button>
          </div>
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

      {/* Input — hidden while viewing a locked (read-only) conversation */}
      {!lockedView && (
      <div className="bg-[#F0F0F0] px-3 pt-3 flex items-end gap-2" style={{ paddingBottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 64px))' }}>
        <button
          onClick={() => handleSend(null)}
          disabled={!input.trim() || isTyping}
          className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-md hover:bg-[#128C7E] transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <Send size={20} />
        </button>
        <div className="flex-1 bg-white rounded-full px-4 py-3 flex items-center shadow-sm min-h-[48px]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); resizeInput(); }}
            onKeyDown={handleKeyDown}
            placeholder="כתוב הודעה..."
            className="w-full bg-transparent outline-none resize-none text-gray-800 text-sm leading-5 overflow-y-auto max-h-32"
            rows={1}
            style={{ direction: 'rtl' }}
          />
        </div>
        <MicButton tone="light" disabled={isTyping} onText={t => setInput(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))} />
      </div>
      )}
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

      <ChatHistoryOverlay
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={historyAll.slice(0, historyVisible)}
        onSelect={handleHistorySelect}
        hasMore={historyVisible < historyAll.length}
        onLoadMore={() => setHistoryVisible((v) => v + HISTORY_PAGE_SIZE)}
        loadingMore={historyLoading}
        renderRow={(item) => (
          <div className="flex items-start justify-between gap-2 w-full text-right">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-bold truncate" style={{ color: '#1A1A1A' }}>{item.title || 'שיחה'}</span>
                {item.locked ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(107,114,128,0.12)', color: '#6B7280' }}>נעול</span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>פעיל</span>
                )}
                {item.booking_created && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.12)', color: '#EA580C' }}>הזמנה ✓</span>
                )}
              </div>
              <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#9CA3AF' }}>{item.summary || 'שיחת חיפוש והזמנות'}</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{fmtHistoryDate(item.created_date)}</p>
            </div>
          </div>
        )}
      />

      <CustomerBottomNav onNotifications={() => setUpdatesOpen(true)} />
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
      <div className={`max-w-[85%] lg:max-w-md px-3 py-2 rounded-2xl shadow-sm relative ${
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