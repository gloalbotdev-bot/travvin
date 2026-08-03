import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Upload, X, ArrowRight, Check } from 'lucide-react';

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
  const [saving, setSaving] = useState(false);
  const [conversationData, setConversationData] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
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
    "description": "...",
    "data_zones": []
  }
}

אם action=build, מלא את zimmer_data בצורה מלאה ומפורטת לפי כל מה שנאמר בשיחה.
חובה לבקש מהבעל מחיר נפרד לאמצע השבוע (א'-ה', weekday_price) ולסוף השבוע (ה'-ש', weekend_price). אם הבעל נתן רק מחיר אחד ולא ציין חלוקה — הגדר את אותו מחיר גם ל-weekday_price וגם ל-weekend_price (ול-price_per_night). אף פעם אל תשאיר את שניהם null כשיש מחיר כלשהו.
ה-description צריך להיות תיאור מפנה ומושך.
ה-data_zones צריכים לכלול מידע ייחודי שנאמר בשיחה (כגון: מדיניות ביטול, חיות מחמד, ציוד מיוחד וכו').`;

    const response = await base44.integrations.Core.InvokeLLM({
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
              description: { type: 'string' },
              data_zones: { type: 'array', items: { type: 'object' } }
            }
          }
        }
      }
    });

    setIsTyping(false);

    if (response.zimmer_data) {
      setConversationData(prev => ({ ...prev, ...response.zimmer_data }));
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
      const finalZimmer = { ...conversationData, ...response.zimmer_data, images: uploadedImages, data_zones: [ownerZone, ...aiZones] };
      setBuiltZimmer(finalZimmer);
      addMsg('bot', 'text', response.message || 'מצוין! הנה הצימר שבניתי לך:');
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
    await onSave({ ...builtZimmer, images: uploadedImages, approval_status: 'אושר' });
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
      {builtZimmer && (
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
            onClick={() => { setBuiltZimmer(null); addMsg('bot', 'text', 'בסדר! מה תרצה לשנות?'); }}
            className="px-5 py-3 bg-gray-800 text-gray-300 hover:text-white rounded-xl font-medium transition-colors"
          >
            ערוך
          </button>
        </div>
      )}

      {/* Input */}
      {!builtZimmer && (
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
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ספר לי על הצימר שלך..."
              className="w-full bg-transparent outline-none resize-none text-white text-sm leading-5 max-h-32 placeholder-gray-500"
              rows={1}
              style={{ direction: 'rtl' }}
            />
          </div>
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
          <p className="text-[#25D366] font-semibold mb-3 text-xs uppercase tracking-wider">תצוגה מקדימה של הצימר</p>
          <div className="space-y-2">
            {[
              { label: 'שם', field: 'name', type: 'text' },
              { label: 'מיקום', field: 'location', type: 'text' },
              { label: 'מחיר בסיס (₪)', field: 'price_per_night', type: 'number' },
              { label: 'מחיר אמצ"ש (₪)', field: 'weekday_price', type: 'number' },
              { label: 'מחיר סופ"ש (₪)', field: 'weekend_price', type: 'number' },
              { label: 'חדרים', field: 'num_rooms', type: 'number' },
              { label: 'אורחים מקס\'', field: 'max_guests', type: 'number' },
            ].map(({ label, field, type }) => (
              <div key={field} className="flex items-center gap-2">
                <span className="text-gray-500 w-28 flex-shrink-0 text-xs">{label}:</span>
                <input
                  type={type}
                  value={builtZimmer[field] || ''}
                  onChange={e => onEditField(field, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-[#25D366]"
                />
              </div>
            ))}
            <div>
              <span className="text-gray-500 text-xs block mb-1">תיאור:</span>
              <textarea
                value={builtZimmer.description || ''}
                onChange={e => onEditField('description', e.target.value)}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-[#25D366] resize-none"
              />
            </div>
            {(builtZimmer.data_zones || []).length > 0 && (
              <div>
                <span className="text-gray-500 text-xs block mb-1">מידע נוסף שנקלט ({builtZimmer.data_zones.length} אזורים):</span>
                {builtZimmer.data_zones.map((z, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg px-2 py-1 mb-1 text-xs text-gray-300">{z.content}</div>
                ))}
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