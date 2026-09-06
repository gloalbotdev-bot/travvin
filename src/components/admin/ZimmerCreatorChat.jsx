import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/api/client';
import { Send, Upload, X, ArrowRight, Check } from 'lucide-react';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';
import { extractAmenitiesFromText, normalizeRoomForSave } from '@/lib/rooms';
import RoomsDetailEditor from '@/components/chat/RoomsDetailEditor';

const formatTime = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const TypingIndicator = () => (
  <div className="flex items-end gap-2 mb-3">
    <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">Z</div>
    <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
      <div className="flex gap-1 items-center h-4">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  </div>
);

export default function ZimmerCreatorChat({ onSave, onCancel }) {
  const [messages, setMessages] = useState([{
    id: 1, role: 'bot', type: 'text',
    content: 'שלום! 🏠 אני אעזור לך ליצור את הצימר שלך. ספר לי הכל — שם הצימר, מיקום, מספר חדרים, כמה אורחים, מחיר לאמצע שבוע (א\'-ה\'), מחיר לסוף שבוע (ה\'-ש\'), ומה מיוחד בו. כתוב בחופשיות!',
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
    addMsg('bot', 'text', `✅ העלית ${newUrls.length} תמונות! סה"כ ${updated.length} תמונות. יש עוד מידע שרוצה להוסיף, או שנסכם ונבנה את הצימר?`);
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
      addMsg('bot', 'text', response.message || '✅ עדכנתי את הפרטים החדשים בכרטיס — אפשר להמשיך לערוך או לסיים ולפרסם.');
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
    <div className="min-h-screen bg-gray-950 flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={onCancel} className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white">
          <ArrowRight size={18} />
        </button>
        <div>
          <h1 className="text-white font-bold">יצירת צימר חדש בצ'אט</h1>
          <p className="text-gray-400 text-xs">ספר לי על הצימר שלך בשפה חופשית</p>
        </div>
        <div className="mr-auto flex items-center gap-2 text-xs text-gray-500">
          {uploadedImages.length > 0 && <span className="bg-[#25D366]/20 text-[#25D366] px-2 py-1 rounded-full">{uploadedImages.length} תמונות</span>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
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

      {/* Preview actions */}
      {builtZimmer && !chatMode && (
        <div className="bg-gray-900 border-t border-gray-800 px-6 py-3 flex gap-3">
          <button
            onClick={handleSaveZimmer}
            disabled={saving}
            className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            <Check size={18} />
            {saving ? 'שומר...' : 'סיים ופרסם צימר'}
          </button>
          <button
            onClick={() => { setChatMode(true); addMsg('bot', 'text', 'בסדר! כתוב פרטים נוספים ואעדכן את הכרטיס.'); }}
            className="px-5 py-3 bg-gray-800 text-gray-300 hover:text-white rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <Send size={15} /> הוסף פרטים בצ׳אט
          </button>
        </div>
      )}

      {/* Input */}
      {(!builtZimmer || chatMode) && (
        <div className="bg-gray-900 border-t border-gray-800 px-4 py-3 flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImg}
            className="w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-gray-300 flex-shrink-0 transition-colors"
          >
            {uploadingImg ? <div className="w-5 h-5 border-2 border-gray-500 border-t-[#25D366] rounded-full animate-spin" /> : <Upload size={18} />}
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />

          <div className="flex-1 bg-gray-800 rounded-2xl px-4 py-3 flex items-center min-h-[48px]">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); resizeInput(); }}
              onKeyDown={handleKeyDown}
              placeholder={chatMode ? 'כתוב פרטים נוספים להוספה לכרטיס הצימר...' : 'ספר לי על הצימר שלך...'}
              className="w-full bg-transparent outline-none resize-none overflow-y-auto text-white text-sm leading-5 placeholder-gray-500"
              rows={1}
              style={{ direction: 'rtl' }}
            />
          </div>
          <MicButton tone="dark" disabled={isTyping} onText={t => setInput(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))} />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center text-white flex-shrink-0 hover:bg-[#128C7E] transition-colors disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function AdminChatBubble({ msg, onEditField, builtZimmer }) {
  const isBot = msg.role === 'bot';

  if (msg.type === 'images') {
    return (
      <div className="flex justify-end mb-2">
        <div className="flex gap-2 flex-wrap justify-end max-w-xs">
          {msg.content.map((url, i) => (
            <img key={i} src={url} alt="" className="w-20 h-20 object-cover rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (msg.type === 'preview' && builtZimmer) {
    return (
      <div className="flex items-start gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">Z</div>
        <div className="flex-1 bg-gray-900 border border-[#25D366]/40 rounded-2xl p-4 text-sm">
          <p className="text-[#25D366] font-semibold mb-1 text-xs uppercase tracking-wider">הצימר שלך — בכרטיס</p>
          <p className="text-gray-400 mb-3 text-xs">לחצו על כל שדה לעריכה ישירה, או הוסיפו פרטים בצ׳אט למטה.</p>
          <div className="space-y-2">
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
              <div key={field} className="flex items-center gap-2">
                <span className="text-gray-500 w-28 flex-shrink-0 text-xs">{label}:</span>
                <input
                  type={type}
                  value={builtZimmer[field] || ''}
                  onChange={e => onEditField(field, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-[#25D366] transition-colors"
                />
              </div>
            ))}
            <div>
              <span className="text-gray-500 text-xs block mb-1">תיאור:</span>
              <textarea
                value={builtZimmer.description || ''}
                onChange={e => onEditField('description', e.target.value)}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-[#25D366] resize-none transition-colors"
              />
            </div>
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={!!builtZimmer.expose_availability_calendar}
                onChange={e => onEditField('expose_availability_calendar', e.target.checked)}
                className="w-4 h-4" style={{ accentColor: '#25D366' }} />
              <span className="text-xs text-gray-400">חשוף מיני-יומן זמינות ללקוחות</span>
            </label>
            <div>
              <span className="text-gray-500 text-xs block mb-2">חלוקת חדרים, מיטות ומתקנים — הצעה לעריכה:</span>
              <div className="rounded-xl bg-white p-3">
                <RoomsDetailEditor
                  value={Array.isArray(builtZimmer.rooms_detail) ? builtZimmer.rooms_detail : []}
                  onChange={(rooms) => onEditField('rooms_detail', rooms)}
                  additionalBathrooms={builtZimmer.additional_bathrooms_count ?? 0}
                  onAdditionalBathroomsChange={(n) => onEditField('additional_bathrooms_count', n)}
                />
              </div>
              <p className="text-[10px] mt-1 text-gray-500">החלוקה נקבעה מתוך הטקסט שהקלדת — בדוק ותקן אם צריך לפני פרסום.</p>
            </div>
            {(builtZimmer.data_zones || []).length > 0 && (
              <div>
                <span className="text-gray-500 text-xs block mb-1">מידע נוסף שנקלט ({builtZimmer.data_zones.length} אזורים):</span>
                {builtZimmer.data_zones.map((z, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg px-2 py-1 mb-1 text-xs text-gray-300">{z.content}</div>
                ))}
              </div>
            )}
            {Array.isArray(builtZimmer.amenities) && builtZimmer.amenities.length > 0 && (
              <div>
                <span className="text-gray-500 text-xs block mb-1">מתקנים שזוהו אוטומטית מהטקסט ({builtZimmer.amenities.length}):</span>
                <div className="flex flex-wrap gap-1.5">
                  {builtZimmer.amenities.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,211,102,0.15)', color: '#25D366' }}>
                      {a}
                      <button type="button" onClick={() => onEditField('amenities', (builtZimmer.amenities || []).filter((_, idx) => idx !== i))} className="hover:opacity-70"><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <p className="text-[10px] mt-1 text-gray-500">זוהו לפי מילות מפתח — לחץ X להסרה. ניתן להוסיף מתקנים בעורך הצימר לאחר פרסום.</p>
              </div>
            )}
            {builtZimmer.images?.length > 0 && (
              <div>
                <span className="text-gray-500 text-xs block mb-1">תמונות ({builtZimmer.images.length}):</span>
                <div className="flex gap-2 flex-wrap">
                  {builtZimmer.images.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />
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
    <div className={`flex items-end gap-2 mb-1 ${!isBot ? 'flex-row-reverse' : ''}`}>
      {isBot && <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">Z</div>}
      <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl shadow-sm ${
        isBot ? 'bg-gray-800 text-gray-100 rounded-bl-sm' : 'bg-[#25D366]/20 text-gray-100 rounded-br-sm'
      }`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        <div className="text-xs text-gray-500 mt-1 text-left">{msg.time}</div>
      </div>
    </div>
  );
}