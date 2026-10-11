import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/api/client';
import { Send, X, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';
import { extractAmenitiesFromText, normalizeRoomForSave } from '@/lib/rooms';
import RoomsDetailEditor from '@/components/chat/RoomsDetailEditor';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';
import iconPlus from '@/assets/owner/home/icon-plus.svg';
import iconSend from '@/assets/owner/home/icon-send.svg';
import iconMic from '@/assets/owner/home/icon-mic.svg';

const formatTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const TypingIndicator = () => (
  <div className="flex items-end gap-2 mb-3" role="status" aria-label="העוזר מקליד">
    <OwnerAiIcon size={32} />
    <div className="rounded-[10px] px-4 py-3" style={{ background: '#F5F5F5' }}>
      <div className="flex gap-1 items-center h-4">
        {[0, 150, 300].map(d => (
          <div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#0B3838', opacity: 0.35, animationDelay: `${d}ms` }}></div>
        ))}
      </div>
    </div>
  </div>
);

const fieldInputClass = 'font-simona w-full bg-white border-[1.5px] border-[#E4E7E5] hover:border-[#C9CFCC] focus:border-[#0B3838] rounded-xl px-3 py-2 text-sm outline-none transition-colors';

export default function ZimmerCreatorChat({ onSave, onCancel, embedded = false }) {
  const [messages, setMessages] = useState([{
    id: 1, role: 'bot', type: 'text',
    content: 'שלום! אני אעזור לך ליצור את הצימר שלך. ספר לי הכל — שם הצימר, מיקום, מספר חדרים, כמה אורחים, מחיר לאמצע שבוע (א\'-ה\'), מחיר לסוף שבוע (ה\'-ש\'), ומה מיוחד בו. כתוב בחופשיות!',
    time: formatTime()
  }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [builtZimmer, setBuiltZimmer] = useState(null);
  const [chatMode, setChatMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conversationData, setConversationData] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null); 
  const { ref: inputRef, resize: resizeInput } = useAutoResize(input, 240);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus the input as soon as it's visible (on enter and after "הוסף פרטים בצ׳אט")
  useEffect(() => {
    if (!builtZimmer || chatMode) inputRef.current?.focus();
  }, [builtZimmer, chatMode]);

  const addMsg = (role, type, content, extra = {}) => {
    const msg = { id: Date.now() + Math.random(), role, type, content, time: formatTime(), ...extra };
    setMessages(prev => [...prev, msg]);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingImg(true);
    const newUrls = [];
    for (const file of files) {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      newUrls.push(file_url);
    }
    const updated = [...uploadedImages, ...newUrls];
    setUploadedImages(updated);
    setUploadingImg(false);
    addMsg('user', 'images', newUrls);
    addMsg('bot', 'text', `העלית ${newUrls.length} תמונות! סה"כ ${updated.length} תמונות. יש עוד מידע שרוצה להוסיף, או שנסכם ונבנה את הצימר?`);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addMsg('user', 'text', text);
    setIsTyping(true);

    const historyText = messages.map(m =>
      m.role === 'user' ? `בעל הצימר: ${typeof m.content === 'string' ? m.content : '[תמונות]'}` :
        `מערכת: ${typeof m.content === 'string' ? m.content : ''}`
    ).join('\n');

    const currentData = JSON.stringify(conversationData);

    // All owner text so far — used for automatic amenity detection (keyword-based, no AI guessing).
    const ownerFullText = messages
      .filter(m => m.role === 'user' && m.type === 'text')
      .map(m => m.content)
      .join('\n');

    const prompt = `אתה עוזר לבעל צימר ליצור את פרופיל הצימר שלו במערכת.
היסטוריית השיחה:
${historyText}

הודעה נוכחית: "${text}"

נתונים שנאספו עד כה: ${currentData}

המשימה שלך:
1. עדכן/השלם את נתוני הצימר לפי ההודעה החדשה
2. אם יש מספיק נתונים (לפחות שם), הצע לסכם ולבנות
3. אם חסר מידע חשוב — שאל שאלה ספציפית אחת
4. אם הבעל אומר "בנה", "סיים", "אוקיי", "תן לי לראות", "יצור" — עבור למצב BUILD

ענה JSON בלבד:
{
  "action": "collect" | "build",
  "message": "...",
  "zimmer_data": {
    "name": "...",
    "location": "...",
    "price_per_night": number or null,
    "weekday_price": number or null,
    "weekend_price": number or null,
    "num_rooms": number or null,
    "max_guests": number or null,
    "max_guests_event": number or null,
    "description": "...",
    "data_zones": [],
    "contact_phone": "...",
    "expose_availability_calendar": boolean,
    "additional_bathrooms_count": number,
    "rooms_detail": [
      { "room_name": "...", "beds": [{"bed_type": "king|queen|single|bunk|sofa_bed|other", "count": number}], "has_bathroom": boolean, "amenities": ["..."] }
    ]
  }
}

אם action=build, מלא את zimmer_data בצורה מלאה ומפורטת לפי כל מה שנאמר בשיחה.
חובה לבקש מהבעל מחיר נפרד לאמצע השבוע (א'-ה', weekday_price) ולסוף השבוע (ה'-ש', weekend_price). אם הבעל נתן רק מחיר אחד ולא ציין חלוקה — הגדר את אותו מחיר גם ל-weekday_price וגם ל-weekend_price (ול-price_per_night). אף פעם אל תשאיר את שניהם null כשיש מחיר כלשהו.
ה-description צריך להיות ניסוח מחדש קצר ומושך של מה שהבעל אמר בפועל בלבד. אסור להמציא תכונות, מתקנים או נתונים שהבעל לא ציין. אם הבעל לא אמר "בריכה" — אל תכתוב בריכה. ציין רק עובדות.
max_guests = כמות האורחים שיישנים בפועל (כמות המיטות).
max_guests_event = כמות האורחים שניתן לארח באירוע/אירוע יוקרתי במקום, רק אם הבעל ציין. אחרת null.
ה-data_zones צריכים לכלול מידע ייחודי שנאמר בשיחה (כגון: מדיניות ביטול, חיות מחמד, ציוד מיוחד וכו').
contact_phone: טלפון/וואטסאפ ליצירת קשר אם הבעל ציין. אחרת null.
expose_availability_calendar: נאות רק אם הבעל אמר במפורש שרוצה לחשוף יומן זמינות ללקוחות. ברירת מחדל false.
rooms_detail: חלץ את חלוקת החדרים מתוך הטקסט כמיטב יכולתך. אם הבעל ציין מספר חדרים (num_rooms) — בנה בדיוק מספר כזה של חדרים. אם num_rooms חסר אך max_guests ידוע — בנה חלוקה סבירה (חדר זוגי + חדרי ילדים/אורחים). סכום המיטות בכל החדרים צריך להגיע ל-max_guests. bed_type ברירת מחדל: queen (king לחדר ראשי, single לילדים/אורחים, bunk לילדים אם רלוונטי). אם הטקסט מזכיר מתקנים בחדר (טלוויזיה, מזגן, מרפסת פרטית, כניסה פרטית) — כלול אותם ב-amenities של החדר הרלוונטי. זוהי הצעה שהבעלים יאשר או יערוך ידנית — אל תהסס להציע חלוקה גם כשהטקסט חלקי.
additional_bathrooms_count: מספר חדרי רחצה נוספים/משותפים (לא צמודים לחדר שינה). למשל "3 חדרי רחצה נוספים" = 3, "שירותי אורחים" = 1, "מקלחת בכניסה" = 1. אם לא הוזכר — החזר 0.`;

    const response = await api.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          message: { type: 'string' },
          zimmer_data: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              location: { type: 'string' },
              price_per_night: { type: 'number' },
              weekday_price: { type: 'number' },
              weekend_price: { type: 'number' },
              num_rooms: { type: 'number' },
              max_guests: { type: 'number' },
              max_guests_event: { type: 'number' },
              description: { type: 'string' },
              data_zones: { type: 'array', items: { type: 'object' } },
              contact_phone: { type: 'string' },
              expose_availability_calendar: { type: 'boolean' },
              additional_bathrooms_count: { type: 'number' },
              rooms_detail: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    room_name: { type: 'string' },
                    beds: { type: 'array', items: { type: 'object', properties: { bed_type: { type: 'string' }, count: { type: 'number' } } } },
                    has_bathroom: { type: 'boolean' },
                    amenities: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          }
        }
      }
    });

    setIsTyping(false);

    if (response.zimmer_data) {
      setConversationData(prev => ({ ...prev, ...response.zimmer_data }));
    }

    // "הוסף פרטים בצ׳אט" flow — keep the preview card, merge new data + refresh auto-amenities.
    if (chatMode && builtZimmer && response.zimmer_data) {
      const sourceForAmenities = [ownerFullText, text, response.zimmer_data.description || ''].join('\n');
      const mergedAmenities = extractAmenitiesFromText(sourceForAmenities, builtZimmer.amenities || []);
      setBuiltZimmer(prev => ({ ...prev, ...response.zimmer_data, images: uploadedImages, amenities: mergedAmenities }));
      setChatMode(false);
      addMsg('bot', 'text', response.message || 'עדכנתי את הפרטים החדשים בכרטיס — אפשר להמשיך לערוך או לסיים ולפרסם.');
      return;
    }

    if (response.action === 'build' && response.zimmer_data) {
      // Capture the exact raw text the owner entered and store it as info zone #1
      // Include the current message (text) since state hasn't flushed in this closure
      const userRawText = [
        ...messages.filter(m => m.role === 'user' && m.type === 'text').map(m => m.content),
        text,
      ].join('\n').trim();
      const ownerZone = {
        content: userRawText,
        source_type: 'טקסט חופשי',
        source_label: 'מידע בעלים',
        source_date: new Date().toISOString().split('T')[0],
      };
      const aiZones = (response.zimmer_data.data_zones || conversationData.data_zones || []).filter(z => z && z.content);
      // Auto-extract amenities from the full owner text + AI description (keyword-based, no guessing).
      const sourceForAmenities = [ownerFullText, text, response.zimmer_data.description || ''].join('\n');
      const priorAmenities = Array.isArray(conversationData.amenities) ? conversationData.amenities : [];
      const autoAmenities = extractAmenitiesFromText(sourceForAmenities, priorAmenities);
      const finalZimmer = {
        ...conversationData,
        ...response.zimmer_data,
        images: uploadedImages,
        amenities: autoAmenities,
        data_zones: [ownerZone, ...aiZones],
      };
      setBuiltZimmer(finalZimmer);
      setChatMode(false);
      addMsg('bot', 'text', response.message || 'מצוין! הנה הצימר שבניתי לך — לחצו על כל שדה לעריכה, או הוסיפו פרטים בצ׳אט:');
      addMsg('bot', 'preview', finalZimmer);
    } else {
      addMsg('bot', 'text', response.message || 'תודה! ספר לי עוד.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSaveZimmer = async () => {
    if (!builtZimmer) return;
    setSaving(true);
    const normalized = {
      ...builtZimmer,
      rooms_detail: (builtZimmer.rooms_detail || []).map(normalizeRoomForSave),
      additional_bathrooms_count: Math.max(0, Number(builtZimmer.additional_bathrooms_count) || 0),
      amenities: (builtZimmer.amenities || []).filter((a) => String(a).trim()),
      images: uploadedImages,
      approval_status: 'אושר',
    };
    await onSave(normalized);
    setSaving(false);
  };

  const handleEditField = (field, val) => {
    setBuiltZimmer(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div
      className={`flex flex-col p-4 sm:p-6 lg:p-8 ${embedded ? 'flex-1 min-h-0' : 'h-dvh'}`}
      dir="rtl"
      style={{ background: '#FAFAFA', fontFamily: 'Heebo, sans-serif' }}
    >
      {/* Header — same pattern as "הצימרים שלי" */}
      <div className="flex items-center gap-3 mb-4 lg:mb-6 flex-shrink-0">
        <button
          type="button"
          onClick={onCancel}
          aria-label="חזרה"
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
          style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}
        >
          <ArrowRight size={18} />
        </button>
        <div className="text-right min-w-0">
          <h1 className="font-simpler leading-tight" style={{ color: '#0B3838', fontSize: 28, fontWeight: 600 }}>צימר חדש</h1>
          <p className="font-simona mt-1" style={{ color: '#717171', fontSize: 15 }}>ספר לי על הצימר שלך בשפה חופשית</p>
        </div>
        {uploadedImages.length > 0 && (
          <span className="font-simona mr-auto text-xs px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: '#EFEFEF', color: '#0B3838' }}>
            {uploadedImages.length} תמונות
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-[23px] bg-white overflow-hidden">
        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto owner-hide-scrollbar">
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 space-y-3">
            {messages.map(msg => (
              <AdminChatBubble
                key={msg.id}
                msg={msg}
                onEditField={handleEditField}
                builtZimmer={builtZimmer}
              />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Preview actions */}
        {builtZimmer && !chatMode && (
          <div className="flex-shrink-0 px-4 sm:px-6 py-4" style={{ borderTop: '1px solid #F0EEE8' }}>
            <div className="max-w-3xl mx-auto w-full flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleSaveZimmer}
                disabled={saving}
                className="font-simpler flex-1 text-white py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: '#0B3838', fontWeight: 600 }}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'שומר...' : 'סיים ופרסם צימר'}
              </button>
              <button
                type="button"
                onClick={() => { setChatMode(true); addMsg('bot', 'text', 'בסדר! כתוב פרטים נוספים ואעדכן את הכרטיס.'); }}
                className="font-simona px-5 py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838', border: '1.5px solid rgba(11,56,56,0.12)' }}
              >
                <Send size={15} /> הוסף פרטים בצ׳אט
              </button>
            </div>
          </div>
        )}

        {/* Composer — same box as the owner home ("היום") */}
        {(!builtZimmer || chatMode) && (
          <div className="flex-shrink-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-2">
            <div
              className="mx-auto w-full rounded-xl bg-white flex flex-col justify-between px-4 pt-3.5 pb-3"
              style={{ maxWidth: 720, minHeight: 85, border: '1.5px solid #E5E5E5', boxShadow: '0px 0px 3.9px 0px rgba(0,0,0,0.14)' }}
            >
              <label htmlFor="zimmer-creator-input" className="font-simona text-right" style={{ color: '#535353', fontSize: 14, fontWeight: 400 }}>
                {chatMode ? 'כתוב פרטים נוספים להוספה לכרטיס הצימר...' : 'ספר לי על הצימר שלך...'}
              </label>
              <div className="flex items-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImg}
                  title="העלאת תמונות"
                  aria-label="העלאת תמונות"
                  className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105 disabled:cursor-default"
                  style={{ background: '#E9E9E9' }}
                >
                  {uploadingImg
                    ? <Loader2 size={13} className="animate-spin" style={{ color: '#0B3838' }} />
                    : <img src={iconPlus} alt="" width={12} height={12} className="block" style={{ width: 12, height: 12 }} />}
                </button>
                <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                <textarea
                  id="zimmer-creator-input"
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); resizeInput(); }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className="font-simona flex-1 min-w-0 bg-transparent outline-none resize-none overflow-y-auto leading-5 py-1"
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

function AdminChatBubble({ msg, onEditField, builtZimmer }) {
  const isBot = msg.role === 'bot';

  if (msg.type === 'images') {
    return (
      <div className="flex justify-end">
        <div className="flex gap-2 flex-wrap justify-end max-w-xs">
          {msg.content.map((url, i) => (
            <img key={i} src={url} alt="" className="w-20 h-20 object-cover rounded-[10px]" style={{ background: '#F8F7F4' }} />
          ))}
        </div>
      </div>
    );
  }

  if (msg.type === 'preview' && builtZimmer) {
    const sectionLabel = 'font-simona block mb-2';
    const sectionLabelStyle = { color: '#717171', fontSize: 13 };
    const hintStyle = { color: '#717171', fontSize: 11 };
    return (
      <div className="flex items-start gap-2">
        <OwnerAiIcon size={32} className="mt-1" />
        <div className="flex-1 min-w-0 bg-white rounded-[23px] p-4 sm:p-5" style={{ border: '1.5px solid #E4E7E5' }}>
          <h2 className="font-simpler mb-1" style={{ color: '#0B3838', fontSize: 18, fontWeight: 600 }}>הצימר שלך</h2>
          <p className="font-simona mb-4" style={{ color: '#717171', fontSize: 13 }}>לחצו על כל שדה לעריכה ישירה, או הוסיפו פרטים בצ׳אט למטה.</p>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {[
              { label: 'שם', field: 'name', type: 'text' },
              { label: 'מיקום', field: 'location', type: 'text' },
              { label: 'מחיר בסיס (₪)', field: 'price_per_night', type: 'number' },
              { label: 'מחיר אמצ"ש (₪)', field: 'weekday_price', type: 'number' },
              { label: 'מחיר סופ"ש (₪)', field: 'weekend_price', type: 'number' },
              { label: 'חדרים', field: 'num_rooms', type: 'number' },
              { label: 'אורחים לשינה', field: 'max_guests', type: 'number' },
              { label: 'אורחים לאירוע', field: 'max_guests_event', type: 'number' },
              { label: 'טלפון/וואטסאפ', field: 'contact_phone', type: 'text' },
            ].map(({ label, field, type }) => (
              <label key={field} className="block">
                <span className={sectionLabel} style={{ ...sectionLabelStyle, marginBottom: 4 }}>{label}</span>
                <input
                  type={type}
                  value={builtZimmer[field] || ''}
                  onChange={e => onEditField(field, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                  className={fieldInputClass}
                  style={{ color: '#0B3838' }}
                />
              </label>
            ))}
            </div>
            <label className="block">
              <span className={sectionLabel} style={{ ...sectionLabelStyle, marginBottom: 4 }}>תיאור</span>
              <textarea
                value={builtZimmer.description || ''}
                onChange={e => onEditField('description', e.target.value)}
                rows={3}
                className={`${fieldInputClass} resize-none leading-relaxed`}
                style={{ color: '#0B3838' }}
              />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!builtZimmer.expose_availability_calendar}
                onChange={e => onEditField('expose_availability_calendar', e.target.checked)}
                className="w-4 h-4" style={{ accentColor: '#0B3838' }} />
              <span className="font-simona text-sm" style={{ color: '#0B3838' }}>חשוף מיני-יומן זמינות ללקוחות</span>
            </label>
            <div>
              <span className={sectionLabel} style={sectionLabelStyle}>חלוקת חדרים, מיטות ומתקנים — הצעה לעריכה</span>
              <RoomsDetailEditor
                value={Array.isArray(builtZimmer.rooms_detail) ? builtZimmer.rooms_detail : []}
                onChange={(rooms) => onEditField('rooms_detail', rooms)}
                additionalBathrooms={builtZimmer.additional_bathrooms_count ?? 0}
                onAdditionalBathroomsChange={(n) => onEditField('additional_bathrooms_count', n)}
              />
              <p className="font-simona mt-2" style={hintStyle}>החלוקה נקבעה מתוך הטקסט שהקלדת — בדוק ותקן אם צריך לפני פרסום.</p>
            </div>
            {(builtZimmer.data_zones || []).length > 0 && (
              <div>
                <span className={sectionLabel} style={sectionLabelStyle}>מידע נוסף שנקלט ({builtZimmer.data_zones.length} אזורים)</span>
                <div className="space-y-2">
                  {builtZimmer.data_zones.map((z, i) => (
                    <div key={i} className="font-simona rounded-[10px] px-3 py-2 text-sm whitespace-pre-wrap" style={{ background: '#F5F5F5', color: '#0B3838' }}>{z.content}</div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(builtZimmer.amenities) && builtZimmer.amenities.length > 0 && (
              <div>
                <span className={sectionLabel} style={sectionLabelStyle}>מתקנים שזוהו אוטומטית מהטקסט ({builtZimmer.amenities.length})</span>
                <div className="flex flex-wrap gap-1.5">
                  {builtZimmer.amenities.map((a, i) => (
                    <span key={i} className="font-simona inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}>
                      {a}
                      <button type="button" aria-label={`הסר ${a}`} onClick={() => onEditField('amenities', (builtZimmer.amenities || []).filter((_, idx) => idx !== i))} className="hover:opacity-70"><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <p className="font-simona mt-2" style={hintStyle}>זוהו לפי מילות מפתח — לחץ X להסרה. ניתן להוסיף מתקנים בעורך הצימר לאחר פרסום.</p>
              </div>
            )}
            {builtZimmer.images?.length > 0 && (
              <div>
                <span className={sectionLabel} style={sectionLabelStyle}>תמונות ({builtZimmer.images.length})</span>
                <div className="flex gap-2 flex-wrap">
                  {builtZimmer.images.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-[10px]" style={{ background: '#F8F7F4' }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 ${!isBot ? 'flex-row-reverse' : ''}`}>
      {isBot && <OwnerAiIcon size={32} />}
      <div
        className="max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-[10px]"
        style={isBot ? { background: '#F5F5F5', color: '#0B3838' } : { background: '#0B3838', color: '#fff' }}
      >
        <p className="font-simona leading-relaxed whitespace-pre-wrap" style={{ fontSize: 15 }}>{msg.content}</p>
        <div className="font-simona mt-1 text-left" style={{ fontSize: 11, color: isBot ? '#717171' : 'rgba(255,255,255,0.7)' }}>{msg.time}</div>
      </div>
    </div>
  );
}