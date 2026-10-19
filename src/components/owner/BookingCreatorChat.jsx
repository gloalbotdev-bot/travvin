import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/api/client';
import { X, Check, Loader2, User, Phone, Home, CalendarDays, Users, CreditCard } from 'lucide-react';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';
import { calcBookingTotalForZimmer, formatILS, checkMinNights } from '@/lib/bookingPrice';
import { buildCreatorRecentTurns, getAssistantParsed } from '@/lib/assistantCreator';
import { decideOwnerAction, findConfirmAction, ownerActionErrorText } from '@/lib/ownerActions';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';
import iconSend from '@/assets/owner/home/icon-send.svg';
import iconMic from '@/assets/owner/home/icon-mic.svg';

const formatTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

export default function BookingCreatorChat({ onClose, onSaved, zimmers, ownerId }) {
  const [messages, setMessages] = useState([{
    id: 1, role: 'bot',
    content: 'שלום! ספר לי על ההזמנה שרוצה להוסיף — שם הלקוח, טלפון, תאריכי כניסה/יציאה, שם הצימר ומספר אורחים.',
    time: formatTime()
  }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [saving, setSaving] = useState(false);
  const [collectedData, setCollectedData] = useState({}); // accumulated booking fields across turns
  const messagesEndRef = useRef(null);
  const { ref: inputRef, resize: resizeInput } = useAutoResize(input, 200);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus the input as soon as it's visible (on enter and after editing a pending booking)
  useEffect(() => {
    if (!pendingBooking) inputRef.current?.focus();
  }, [pendingBooking]);

  const addMsg = (role, content) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, content, time: formatTime() }]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addMsg('user', text);
    setIsTyping(true);

    let response;
    try {
      response = await api.assistant.chat({
        profile: 'owner_booking_creator',
        message: text,
        clientState: {
          ownerId,
          collectedData,
          recentTurns: buildCreatorRecentTurns(messages),
        },
      });
    } catch {
      setIsTyping(false);
      addMsg('bot', 'מצטער, אירעה שגיאה. נסה שוב.');
      return;
    }
    setIsTyping(false);

    const parsed = getAssistantParsed(response);
    const replyText = response?.message?.content || parsed.message;

    // Merge any booking fields the LLM returned into our accumulated state (handles partial data across turns).
    const merged = { ...collectedData, ...(parsed.booking || {}) };
    const cleanedMerged = Object.fromEntries(
      Object.entries(merged).filter(([_, v]) => v !== null && v !== undefined && v !== '')
    );
    setCollectedData(cleanedMerged);

    if (parsed.action === 'create' && parsed.booking) {
      const matchedZimmer = zimmers.find(z =>
        z.name.includes(parsed.booking.zimmer_name) ||
        parsed.booking.zimmer_name?.includes(z.name)
      ) || zimmers[0];

      const override = Number(parsed.booking.price_override);
      const hasOverride = parsed.booking.price_override != null && Number.isFinite(override) && override > 0;
      const guests = Number(parsed.booking.num_guests);
      const hasGuests = parsed.booking.num_guests != null && Number.isFinite(guests) && guests > 0;
      const booking = {
        ...parsed.booking,
        zimmer_id: matchedZimmer?.id || '',
        zimmer_name: matchedZimmer?.name || parsed.booking.zimmer_name,
        owner_id: ownerId || matchedZimmer?.owner_id || '',
        status: parsed.booking.status === 'ממתינה' ? 'ממתינה' : 'אושרה',
        ...(hasGuests ? { num_guests: Math.round(guests) } : { num_guests: null }),
        ...(hasOverride ? { price_override: Math.round(override) } : {}),
        total_price: hasOverride
          ? Math.round(override)
          : calcBookingTotalForZimmer(matchedZimmer, parsed.booking.check_in, parsed.booking.check_out),
      };
      setConfirmAction(findConfirmAction(response));
      setPendingBooking(booking);
      addMsg('bot', replyText || 'מצוין! הנה ההזמנה שאני מתכוון להוסיף:');
    } else {
      addMsg('bot', replyText || 'ספר לי עוד פרטים.');
    }
  };

  const pendingZimmer = pendingBooking ? zimmers.find(z => z.id === pendingBooking.zimmer_id) : null;
  const pendingMinNights = pendingZimmer
    ? checkMinNights(pendingZimmer, pendingBooking.check_in, pendingBooking.check_out)
    : null;

  const handleSave = async () => {
    if (!pendingBooking) return;
    setSaving(true);
    try {
      if (confirmAction) {
        await decideOwnerAction({
          profile: 'owner_booking_creator',
          actionId: confirmAction.actionId,
          confirm: true,
          ownerId,
        });
      } else {
        // Admin sessions have no owner thread — legacy direct save.
        await api.entities.BookingRequest.create(pendingBooking);
      }
    } catch (err) {
      setSaving(false);
      addMsg('bot', ownerActionErrorText(err));
      return;
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const handleEditPending = () => {
    if (confirmAction) {
      decideOwnerAction({ profile: 'owner_booking_creator', actionId: confirmAction.actionId, confirm: false, ownerId }).catch(() => {});
    }
    setConfirmAction(null);
    setPendingBooking(null);
    addMsg('bot', 'בסדר, מה צריך לשנות?');
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      dir="rtl"
      style={{ background: 'rgba(11,56,56,0.35)', fontFamily: 'Heebo, sans-serif' }}
    >
      <div
        className="bg-white rounded-[23px] w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh', boxShadow: '0px 8px 30px rgba(11,56,56,0.18)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-creator-title"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #F0EEE8' }}>
          <div className="flex-1 min-w-0 text-right">
            <h2 id="booking-creator-title" className="font-simpler leading-tight" style={{ color: '#0B3838', fontSize: 20, fontWeight: 600 }}>הוסף הזמנה בטקסט חופשי</h2>
            <p className="font-simona mt-0.5" style={{ color: '#717171', fontSize: 14 }}>שם, טלפון, תאריכים וצימר — בשפה חופשית</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
            style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto owner-hide-scrollbar px-4 sm:px-5 py-4 space-y-3">
          {messages.map(msg => {
            const isBot = msg.role === 'bot';
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isBot ? 'justify-end' : 'justify-start'}`}>
                {isBot && <OwnerAiIcon size={32} />}
                <div
                  className="max-w-[80%] px-4 py-2.5 rounded-[10px]"
                  style={isBot ? { background: '#F5F5F5', color: '#0B3838' } : { background: '#0B3838', color: '#fff' }}
                >
                  <p className="font-simona leading-relaxed whitespace-pre-wrap" style={{ fontSize: 15 }}>{msg.content}</p>
                  <div className="font-simona mt-1 text-left" style={{ fontSize: 11, color: isBot ? '#717171' : 'rgba(255,255,255,0.7)' }}>{msg.time}</div>
                </div>
              </div>
            );
          })}
          {isTyping && (
            <div className="flex items-end gap-2 justify-end" role="status" aria-label="העוזר מקליד">
              <OwnerAiIcon size={32} />
              <div className="rounded-[10px] px-4 py-3" style={{ background: '#F5F5F5' }}>
                <div className="flex gap-1 items-center h-4">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#0B3838', opacity: 0.35, animationDelay: `${d}ms` }}></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pending booking preview */}
          {pendingBooking && (
            <div className="bg-white rounded-[23px] p-4 sm:p-5" style={{ border: '1.5px solid #E4E7E5' }}>
              <p className="font-simpler mb-3" style={{ color: '#0B3838', fontSize: 16, fontWeight: 600 }}>תצוגה מקדימה</p>
              <div className="font-simona space-y-2 text-sm" style={{ color: '#0B3838' }}>
                <PreviewRow icon={User}>{pendingBooking.guest_name}</PreviewRow>
                <PreviewRow icon={Phone}><span dir="ltr">{pendingBooking.guest_phone}</span></PreviewRow>
                <PreviewRow icon={Home}>{pendingBooking.zimmer_name}</PreviewRow>
                <PreviewRow icon={CalendarDays}><span dir="ltr">{pendingBooking.check_in} → {pendingBooking.check_out}</span></PreviewRow>
                {pendingBooking.num_guests && <PreviewRow icon={Users}>{pendingBooking.num_guests} אורחים</PreviewRow>}
                {pendingBooking.total_price ? (
                  <PreviewRow icon={CreditCard}>
                    תשלום: <span className="font-simpler" style={{ fontWeight: 600 }}>{formatILS(pendingBooking.total_price)}</span>
                    {pendingBooking.price_override != null && <span style={{ color: '#717171' }}> (מחיר מוסכם)</span>}
                  </PreviewRow>
                ) : null}
                <PreviewRow icon={Check}>{pendingBooking.status === 'ממתינה' ? 'ממתינה לאישור' : 'מאושרת'}</PreviewRow>
                {pendingMinNights && !pendingMinNights.ok && (
                  <p role="status" className="rounded-[10px] px-3 py-2 text-xs leading-relaxed" style={{ background: '#FEF3C7', color: '#92400E' }}>
                    ⚠️ {pendingMinNights.message} (בהזמנה זו {pendingMinNights.nights} לילות). כבעל הצימר אפשר לשמור בכל זאת.
                  </p>
                )}
                {pendingBooking.notes && <p className="rounded-[10px] px-3 py-2 text-xs whitespace-pre-wrap" style={{ background: '#F5F5F5', color: '#717171' }}>{pendingBooking.notes}</p>}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="font-simpler flex-1 text-white py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#0B3838', fontWeight: 600 }}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {saving ? 'שומר...' : 'אשר והוסף'}
                </button>
                <button
                  type="button"
                  onClick={handleEditPending}
                  className="font-simona px-5 py-2.5 rounded-xl text-sm transition-all hover:opacity-90"
                  style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838', border: '1.5px solid rgba(11,56,56,0.12)' }}
                >
                  ערוך
                </button>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Collected-so-far chips */}
        {!pendingBooking && Object.keys(collectedData).length > 0 && (
          <div className="px-4 sm:px-5 pt-3 flex flex-wrap gap-1.5 flex-shrink-0" style={{ borderTop: '1px solid #F0EEE8' }}>
            {collectedData.guest_name && <Chip icon={User}>{collectedData.guest_name}</Chip>}
            {collectedData.guest_phone && <Chip icon={Phone}><span dir="ltr">{collectedData.guest_phone}</span></Chip>}
            {collectedData.zimmer_name && <Chip icon={Home}>{collectedData.zimmer_name}</Chip>}
            {collectedData.check_in && <Chip icon={CalendarDays}><span dir="ltr">{collectedData.check_in}→{collectedData.check_out}</span></Chip>}
            {collectedData.num_guests && <Chip icon={Users}>{collectedData.num_guests}</Chip>}
          </div>
        )}

        {/* Input — same box as the owner home ("היום") */}
        {!pendingBooking && (
          <div className="px-4 sm:px-5 py-3 flex-shrink-0">
            <div
              className="rounded-xl bg-white flex flex-col justify-between px-4 pt-3 pb-2.5"
              style={{ border: '1.5px solid #E5E5E5', boxShadow: '0px 0px 3.9px 0px rgba(0,0,0,0.14)' }}
            >
              <label htmlFor="booking-creator-input" className="font-simona text-right" style={{ color: '#535353', fontSize: 14 }}>
                תאר את ההזמנה
              </label>
              <div className="flex items-end gap-2.5 mt-1.5">
                <textarea
                  id="booking-creator-input"
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); resizeInput(); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="לדוגמה: יעקב כהן, 050-1234567, נוף כנרת, 25-27 ביולי..."
                  className="font-simona flex-1 min-w-0 bg-transparent outline-none resize-none overflow-y-auto leading-5 py-1 placeholder:text-[#9CA3AF]"
                  rows={1}
                  style={{ color: '#0B3838', fontSize: 14, direction: 'rtl' }}
                />
                <MicButton
                  tone="ghost"
                  compact
                  size={14}
                  iconWidth={14}
                  iconHeight={19}
                  iconSrc={iconMic}
                  disabled={isTyping}
                  onText={t => setInput(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  title="שלח"
                  aria-label="שלח"
                  className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-default"
                  style={{ background: '#0B3838' }}
                >
                  <img src={iconSend} alt="" width={8} height={12} className="block" style={{ width: 8, height: 12 }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewRow({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={15} className="flex-shrink-0" style={{ color: '#717171' }} aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function Chip({ icon: Icon, children }) {
  return (
    <span className="font-simona inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}>
      <Icon size={11} aria-hidden="true" />
      {children}
    </span>
  );
}