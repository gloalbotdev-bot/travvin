import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/api/client';
import { Send, X, Check } from 'lucide-react';
import { calcBookingTotalForZimmer, formatILS } from '@/lib/bookingPrice';
import { bookingErrorMessage } from '@/lib/bookingErrors';
import { buildCreatorRecentTurns, getAssistantParsed } from '@/lib/assistantCreator';

const formatTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

function inferBookingStatus(booking, userText) {
  const s = booking?.status;
  if (s === 'ממתינה' || s === 'אושרה') return s;
  const blob = `${userText || ''} ${booking?.notes || ''}`;
  if (/ממתינ|המתנ|לא\s*מאושר|pending/i.test(blob)) return 'ממתינה';
  if (/אושר|מאושר|approved/i.test(blob)) return 'אושרה';
  return 'אושרה';
}

function cleanBookingNotes(notes) {
  if (!notes) return '';
  return String(notes)
    .replace(/הזמנה\s*בהמתנה/gi, '')
    .replace(/ממתינה\s*לאישור/gi, '')
    .replace(/סטטוס\s*ממתינה/gi, '')
    .trim();
}

export default function BookingCreatorChat({ onClose, onSaved, zimmers, ownerId }) {
  const [messages, setMessages] = useState([{
    id: 1, role: 'bot',
    content: 'שלום! ספר לי על ההזמנה שרוצה להוסיף — שם הלקוח, טלפון, תאריכי כניסה/יציאה, שם הצימר ומספר אורחים.',
    time: formatTime()
  }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [saving, setSaving] = useState(false);
  const [collectedData, setCollectedData] = useState({}); // accumulated booking fields across turns
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addMsg = (role, content) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, content, time: formatTime() }]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addMsg('user', text);
    setIsTyping(true);

    const recentTurns = buildCreatorRecentTurns(messages, 30);

    const response = await api.assistant.chat({
      profile: 'owner_booking_creator',
      message: text,
      clientState: {
        ownerId,
        collectedData,
        recentTurns,
      },
    });
    const parsed = getAssistantParsed(response);

    setIsTyping(false);

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

      const status = inferBookingStatus(parsed.booking, text);
      const notes = cleanBookingNotes(parsed.booking.notes);

      const booking = {
        ...parsed.booking,
        notes,
        zimmer_id: matchedZimmer?.id || '',
        zimmer_name: matchedZimmer?.name || parsed.booking.zimmer_name,
        owner_id: ownerId || matchedZimmer?.owner_id || '',
        status,
        total_price: calcBookingTotalForZimmer(
          matchedZimmer,
          parsed.booking.check_in,
          parsed.booking.check_out,
          0,
          0,
        ),
      };
      setPendingBooking(booking);
      addMsg('bot', parsed.message || 'מצוין! הנה ההזמנה שאני מתכוון להוסיף:');
    } else {
      addMsg('bot', parsed.message || 'ספר לי עוד פרטים.');
    }
  };

  const handleSave = async () => {
    if (!pendingBooking) return;
    setSaving(true);
    try {
      await api.entities.BookingRequest.create(pendingBooking);
      onSaved();
      onClose();
    } catch (e) {
      addMsg('bot', `⚠️ ${bookingErrorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="font-bold text-white">הוסף הזמנה בטקסט חופשי</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${
                msg.role === 'bot' ? 'bg-[#25D366]/20 text-gray-100' : 'bg-gray-800 text-gray-100'
              }`}>
                {msg.content}
                <div className="text-xs text-gray-500 mt-1">{msg.time}</div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-end">
              <div className="bg-[#25D366]/20 px-4 py-2.5 rounded-2xl">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Pending booking preview */}
          {pendingBooking && (
            <div className="bg-gray-800 border border-[#25D366]/40 rounded-xl p-4 text-sm">
              <p className="text-[#25D366] font-semibold mb-2 text-xs">תצוגה מקדימה</p>
              <div className="space-y-1 text-gray-300">
                <p>👤 {pendingBooking.guest_name} · 📞 {pendingBooking.guest_phone}</p>
                <p>🏠 {pendingBooking.zimmer_name}</p>
                <p>📅 {pendingBooking.check_in} → {pendingBooking.check_out}</p>
                <p>סטטוס: <span className={pendingBooking.status === 'ממתינה' ? 'text-yellow-400' : 'text-green-400'}>{pendingBooking.status}</span></p>
                {pendingBooking.num_guests && <p>👥 {pendingBooking.num_guests} אורחים</p>}
                {pendingBooking.total_price ? <p className="font-semibold text-green-400">💳 תשלום: {formatILS(pendingBooking.total_price)}</p> : null}
                {pendingBooking.notes && <p className="text-gray-400 text-xs">{pendingBooking.notes}</p>}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Check size={14} /> {saving ? 'שומר...' : 'אשר והוסף'}
                </button>
                <button
                  onClick={() => { setPendingBooking(null); addMsg('bot', 'בסדר, מה צריך לשנות?'); }}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm"
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
          <div className="px-4 pt-3 flex flex-wrap gap-1.5 border-t border-gray-800">
            {collectedData.guest_name && <span className="text-[11px] bg-[#25D366]/15 text-[#25D366] px-2 py-1 rounded-full">👤 {collectedData.guest_name}</span>}
            {collectedData.guest_phone && <span className="text-[11px] bg-[#25D366]/15 text-[#25D366] px-2 py-1 rounded-full">📞 {collectedData.guest_phone}</span>}
            {collectedData.zimmer_name && <span className="text-[11px] bg-[#25D366]/15 text-[#25D366] px-2 py-1 rounded-full">🏠 {collectedData.zimmer_name}</span>}
            {collectedData.check_in && <span className="text-[11px] bg-[#25D366]/15 text-[#25D366] px-2 py-1 rounded-full">📅 {collectedData.check_in}→{collectedData.check_out}</span>}
            {collectedData.num_guests && <span className="text-[11px] bg-[#25D366]/15 text-[#25D366] px-2 py-1 rounded-full">👥 {collectedData.num_guests}</span>}
          </div>
        )}

        {/* Input */}
        {!pendingBooking && (
          <div className="px-4 py-3 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="לדוגמה: יעקב כהן, 050-1234567, נוף כנרת, 25-27 ביולי..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#25D366] placeholder-gray-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center text-white hover:bg-[#128C7E] disabled:opacity-50 flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}