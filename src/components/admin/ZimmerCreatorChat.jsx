import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/api/client';
import { Send, X, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useAutoResize } from '@/hooks/useAutoResize';
import MicButton from '@/components/chat/MicButton';
import {
  extractAmenitiesFromText, normalizeRoomForSave, roomsSleepingCapacity,
  normalizeOutdoorAreaForSave, detectUnclearPlacement, applyPlacement,
} from '@/lib/rooms';
import { useOwnerCustomBedTypes } from '@/hooks/useOwnerCustomBedTypes';
import { buildCreatorRecentTurns, getAssistantParsed } from '@/lib/assistantCreator';
import { decideOwnerAction, findConfirmAction, ownerActionErrorText } from '@/lib/ownerActions';
import RoomsDetailEditor from '@/components/chat/RoomsDetailEditor';
import OutdoorAreaEditor from '@/components/chat/OutdoorAreaEditor';
import { describeMinNightsRules } from '@/lib/bookingPrice';
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

// Sleeping places vs. max_guests, computed in code (the LLM's arithmetic is not trusted).
function bedAllocationStatus(zimmer) {
  const { assigned, unknownBeds } = roomsSleepingCapacity(zimmer?.rooms_detail);
  const total = Number(zimmer?.max_guests) > 0 ? Number(zimmer.max_guests) : null;
  const remaining = total == null ? 0 : total - assigned;
  return { total, assigned, unknownBeds, remaining, complete: remaining <= 0 && unknownBeds === 0 };
}

function allocationQuestion({ total, assigned, unknownBeds, remaining }) {
  const parts = [];
  if (remaining > 0) {
    parts.push(`זיהינו ${total} מקומות שינה, ושובצו ${assigned}. באיזה חדרים ממוקמות שאר המיטות (${remaining} מקומות)?`);
  }
  if (unknownBeds > 0) {
    parts.push(`יש ${unknownBeds === 1 ? 'מיטה אחת' : `${unknownBeds} מיטות`} שלא ידוע לכמה אנשים ${unknownBeds === 1 ? 'היא מתאימה' : 'הן מתאימות'} (ספה נפתחת / סוג אחר).`);
  }
  parts.push('אפשר לכתוב לי (למשל "4 מיטות יחיד בחדר 3", "הספה נפתחת ל-3") או לשבץ ישירות בכרטיס.');
  return parts.join('\n');
}

const fieldInputClass = 'font-simona w-full bg-white border-[1.5px] border-[#E4E7E5] hover:border-[#C9CFCC] focus:border-[#0B3838] rounded-xl px-3 py-2 text-sm outline-none transition-colors';

export default function ZimmerCreatorChat({ onSave, onCreated, onCancel, embedded = false, ownerId = null }) {
  const customBedTypes = useOwnerCustomBedTypes(ownerId);
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
  // Zimmer waiting for the owner to place beds in rooms — shown before the preview card.
  const [pendingZimmer, setPendingZimmer] = useState(null);
  const [chatMode, setChatMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [conversationData, setConversationData] = useState({});
  // Ambiguous amenities the owner already placed (inside / outside / both) — never asked twice.
  const [placements, setPlacements] = useState({});
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

    // The allocation/preview card may hold manual edits the LLM hasn't seen — send those rooms.
    const cardZimmer = pendingZimmer || (chatMode ? builtZimmer : null);
    const currentData = cardZimmer
      ? { ...conversationData, rooms_detail: cardZimmer.rooms_detail, max_guests: cardZimmer.max_guests, num_rooms: cardZimmer.num_rooms, outdoor_area: cardZimmer.outdoor_area ?? null, amenities: cardZimmer.amenities }
      : conversationData;

    // All owner text so far — used for automatic amenity detection (keyword-based, no AI guessing).
    const ownerFullText = messages
      .filter(m => m.role === 'user' && m.type === 'text')
      .map(m => m.content)
      .join('\n');

    let res;
    try {
      res = await api.assistant.chat({
        profile: 'owner_zimmer_creator',
        message: text,
        clientState: {
          ...(ownerId ? { ownerId } : {}),
          conversationData: currentData,
          recentTurns: buildCreatorRecentTurns(messages),
          uploadedImageCount: uploadedImages.length,
          customBedTypes: customBedTypes.map((t) => ({ custom_label: t.custom_label, sleeps: t.sleeps ?? null })),
        },
      });
    } catch {
      setIsTyping(false);
      addMsg('bot', 'text', 'מצטער, אירעה שגיאה. נסה שוב.');
      return;
    }
    const parsedRes = getAssistantParsed(res);
    const response = { ...parsedRes, message: res?.message?.content || parsedRes.message };
    const freshConfirm = findConfirmAction(res);
    if (freshConfirm) setConfirmAction(freshConfirm);

    setIsTyping(false);

    const aiUnclear = Array.isArray(response.zimmer_data?.unclear_placement) ? response.zimmer_data.unclear_placement : [];
    if (response.zimmer_data) {
      delete response.zimmer_data.unclear_placement;
      setConversationData(prev => ({ ...prev, ...response.zimmer_data }));
    }
    const ownerTextNow = `${ownerFullText}\n${text}`;
    const askPlacement = (zimmer) => {
      const unclear = detectUnclearPlacement(ownerTextNow, zimmer, { resolved: Object.keys(placements), aiUnclear });
      if (unclear.length) addMsg('bot', 'placement', unclear);
    };

    // Bed-allocation step: the owner answered in text — take only room/bed data and re-check.
    if (pendingZimmer) {
      const zd = response.zimmer_data || {};
      const next = {
        ...pendingZimmer,
        ...(Array.isArray(zd.rooms_detail) ? { rooms_detail: zd.rooms_detail } : {}),
        ...(zd.max_guests != null ? { max_guests: zd.max_guests } : {}),
        ...(zd.num_rooms != null ? { num_rooms: zd.num_rooms } : {}),
        ...(zd.additional_bathrooms_count != null ? { additional_bathrooms_count: zd.additional_bathrooms_count } : {}),
        ...(zd.outdoor_area && typeof zd.outdoor_area === 'object' ? { outdoor_area: zd.outdoor_area } : {}),
      };
      if (bedAllocationStatus(next).complete) {
        proceedToPreview(next, 'כל המיטות שובצו! הנה הצימר — אפשר לערוך כל שדה או להוסיף פרטים בצ׳אט:');
      } else {
        setPendingZimmer(next);
        addMsg('bot', 'text', response.message || allocationQuestion(bedAllocationStatus(next)));
      }
      return;
    }

    // "הוסף פרטים בצ׳אט" flow — keep the preview card, merge new data + refresh auto-amenities.
    if (chatMode && builtZimmer && response.zimmer_data) {
      const sourceForAmenities = [ownerFullText, text, response.zimmer_data.description || ''].join('\n');
      const mergedAmenities = extractAmenitiesFromText(sourceForAmenities, builtZimmer.amenities || []);
      const nextZimmer = { ...builtZimmer, ...response.zimmer_data, images: uploadedImages, amenities: mergedAmenities };
      if (!response.zimmer_data.outdoor_area) nextZimmer.outdoor_area = builtZimmer.outdoor_area ?? null;
      setBuiltZimmer(nextZimmer);
      setChatMode(false);
      addMsg('bot', 'text', response.message || 'עדכנתי את הפרטים החדשים בכרטיס — אפשר להמשיך לערוך או לסיים ולפרסם.');
      askPlacement(nextZimmer);
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
      const status = bedAllocationStatus(finalZimmer);
      if (!status.complete) {
        setPendingZimmer(finalZimmer);
        addMsg('bot', 'text', allocationQuestion(status));
        addMsg('bot', 'bed_allocation', null);
        askPlacement(finalZimmer);
        return;
      }
      proceedToPreview(finalZimmer, response.message);
      askPlacement(finalZimmer);
    } else {
      addMsg('bot', 'text', response.message || 'תודה! ספר לי עוד.');
    }
  };

  const proceedToPreview = (zimmer, message) => {
    const images = [...new Set([...(zimmer.images || []), ...uploadedImages])];
    const finalZimmer = { ...zimmer, images };
    setPendingZimmer(null);
    setBuiltZimmer(finalZimmer);
    setChatMode(false);
    addMsg('bot', 'text', message || 'מצוין! הנה הצימר שבניתי לך — לחצו על כל שדה לעריכה, או הוסיפו פרטים בצ׳אט:');
    addMsg('bot', 'preview', finalZimmer);
  };

  const updatePendingField = (field, val) => setPendingZimmer(prev => (prev ? { ...prev, [field]: val } : prev));

  const resolvePlacement = (name, choice) => {
    setPlacements(prev => ({ ...prev, [name]: choice }));
    setPendingZimmer(prev => (prev ? applyPlacement(prev, name, choice) : prev));
    setBuiltZimmer(prev => (prev ? applyPlacement(prev, name, choice) : prev));
    setConversationData(prev => applyPlacement(prev, name, choice));
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
      outdoor_area: normalizeOutdoorAreaForSave(builtZimmer.outdoor_area),
      images: uploadedImages,
      approval_status: 'אושר',
    };
    if (!confirmAction) {
      // Admin sessions have no owner thread — legacy direct save.
      await onSave(normalized);
      setSaving(false);
      return;
    }
    const confirmWith = (action) => decideOwnerAction({
      profile: 'owner_zimmer_creator',
      actionId: action.actionId,
      confirm: true,
      editedFields: normalized,
      ...(ownerId ? { ownerId } : {}),
    });
    try {
      let res;
      try {
        res = await confirmWith(confirmAction);
      } catch (err) {
        // The proposal expired while the owner edited the card — ask the server for a fresh one.
        if (err?.status !== 404 && err?.status !== 410) throw err;
        const fresh = findConfirmAction(await api.assistant.chat({
          profile: 'owner_zimmer_creator',
          message: 'בנה את הצימר',
          clientState: { ...(ownerId ? { ownerId } : {}), conversationData: normalized, recentTurns: [] },
        }));
        if (!fresh) throw err;
        res = await confirmWith(fresh);
      }
      setConfirmAction(null);
      const created = res?.executedActions?.[0]?.zimmer || null;
      if (onCreated) await onCreated(created);
      else onCancel?.();
    } catch (err) {
      addMsg('bot', 'text', ownerActionErrorText(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEditField = (field, val) => {
    setBuiltZimmer(prev => ({ ...prev, [field]: val }));
  };

  const addRoomPhotoToGallery = (url) => {
    setUploadedImages(prev => (prev.includes(url) ? prev : [...prev, url]));
    setPendingZimmer(prev => {
      if (!prev) return prev;
      const images = prev.images || [];
      return images.includes(url) ? prev : { ...prev, images: [...images, url] };
    });
    setBuiltZimmer(prev => {
      if (!prev) return prev;
      const images = prev.images || [];
      return images.includes(url) ? prev : { ...prev, images: [...images, url] };
    });
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
                onRoomPhotoUploaded={addRoomPhotoToGallery}
                builtZimmer={builtZimmer}
                pendingZimmer={pendingZimmer}
                onEditPendingField={updatePendingField}
                onConfirmAllocation={() => proceedToPreview(pendingZimmer, 'מעולה, כל המיטות שובצו! הנה הצימר — אפשר לערוך כל שדה או להוסיף פרטים בצ׳אט:')}
                onSkipAllocation={() => proceedToPreview(pendingZimmer, 'בסדר, אפשר להשלים את שיבוץ המיטות בכרטיס או אחרי הפרסום בעורך הצימר:')}
                customBedTypes={customBedTypes}
                placements={placements}
                onResolvePlacement={resolvePlacement}
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

function BedAllocationCounter({ status }) {
  const { total, assigned, unknownBeds, remaining } = status;
  const pct = total ? Math.min(100, Math.round((assigned / total) * 100)) : 100;
  return (
    <div className="rounded-[10px] px-3 py-2.5" style={{ background: '#F5F5F5' }} role="status" aria-live="polite">
      {total != null && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="font-simona text-sm" style={{ color: '#0B3838', fontWeight: 600 }}>
              שובצו {assigned} מתוך {total} מקומות שינה
            </span>
            {remaining > 0 && <span className="font-simona text-xs" style={{ color: '#717171' }}>נותרו {remaining}</span>}
          </div>
          <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: '#E4E7E5' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#0B3838' }} />
          </div>
          {remaining < 0 && (
            <p className="font-simona text-xs mt-1.5" style={{ color: '#B45309' }}>
              שובצו יותר מקומות שינה ממספר האורחים ({total}) — כדאי לבדוק את מספר האורחים.
            </p>
          )}
        </>
      )}
      {unknownBeds > 0 && (
        <p className="font-simona text-xs mt-1.5" style={{ color: '#B45309' }}>
          {unknownBeds === 1 ? 'מיטה אחת' : `${unknownBeds} מיטות`} ללא קיבולת — מלא "ישנים במיטה".
        </p>
      )}
    </div>
  );
}

const PLACEMENT_CHOICES = [['inside', 'בפנים'], ['outside', 'בחצר'], ['both', 'גם וגם']];

function PlacementQuestion({ names, placements, onResolve }) {
  return (
    <div className="flex items-start gap-2">
      <OwnerAiIcon size={32} className="mt-1" />
      <div className="flex-1 min-w-0 max-w-md rounded-[10px] px-4 py-3" style={{ background: '#F5F5F5' }}>
        <p className="font-simona mb-2" style={{ color: '#0B3838', fontSize: 15 }}>
          לא היה ברור לי איפה נמצאים המתקנים הבאים — בפנים או בחצר?
        </p>
        <div className="space-y-2">
          {names.map((name) => (
            <div key={name} className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-simona text-sm" style={{ color: '#0B3838', fontWeight: 600 }}>{name}</span>
              <div className="flex gap-1.5" role="radiogroup" aria-label={`מיקום ${name}`}>
                {PLACEMENT_CHOICES.map(([val, lbl]) => {
                  const active = placements[name] === val;
                  return (
                    <button key={val} type="button" role="radio" aria-checked={active} onClick={() => onResolve(name, val)}
                      className="font-simona text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={active ? { background: '#0B3838', color: '#fff' } : { background: '#fff', color: '#0B3838', border: '1.5px solid #E4E7E5' }}>
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminChatBubble({ msg, onEditField, onRoomPhotoUploaded, builtZimmer, pendingZimmer, onEditPendingField, onConfirmAllocation, onSkipAllocation, customBedTypes, placements, onResolvePlacement }) {
  const isBot = msg.role === 'bot';

  if (msg.type === 'placement') {
    return <PlacementQuestion names={msg.content || []} placements={placements} onResolve={onResolvePlacement} />;
  }

  if (msg.type === 'bed_allocation') {
    if (!pendingZimmer) return null;
    const status = bedAllocationStatus(pendingZimmer);
    return (
      <div className="flex items-start gap-2">
        <OwnerAiIcon size={32} className="mt-1" />
        <div className="flex-1 min-w-0 bg-white rounded-[23px] p-4 sm:p-5" style={{ border: '1.5px solid #E4E7E5' }}>
          <h2 className="font-simpler mb-1" style={{ color: '#0B3838', fontSize: 18, fontWeight: 600 }}>שיבוץ מיטות בחדרים</h2>
          <p className="font-simona mb-3" style={{ color: '#717171', fontSize: 13 }}>
            שיבצנו רק מיטות שציינת במפורש. הוסף לכל חדר את המיטות שבו, או כתוב לי בצ׳אט.
          </p>
          <BedAllocationCounter status={status} />
          <div className="mt-4">
            <RoomsDetailEditor
              value={Array.isArray(pendingZimmer.rooms_detail) ? pendingZimmer.rooms_detail : []}
              onChange={(rooms) => onEditPendingField('rooms_detail', rooms)}
              additionalBathrooms={pendingZimmer.additional_bathrooms_count ?? 0}
              onAdditionalBathroomsChange={(n) => onEditPendingField('additional_bathrooms_count', n)}
              onRoomPhotoUploaded={onRoomPhotoUploaded}
              allowEmptyBeds
              customBedTypes={customBedTypes}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
            <button
              type="button"
              onClick={onConfirmAllocation}
              disabled={!status.complete}
              className="font-simpler flex-1 text-white py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#0B3838', fontWeight: 600 }}
            >
              <Check size={16} /> אישור השיבוץ
            </button>
            <button
              type="button"
              onClick={onSkipAllocation}
              className="font-simona px-5 py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838', border: '1.5px solid rgba(11,56,56,0.12)' }}
            >
              דלג, אשלים אחר כך
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            {(() => {
              const rules = Array.isArray(builtZimmer.min_nights_rules) ? builtZimmer.min_nights_rules : [];
              const isAlwaysWeekend = (r) => r.scope === 'weekend' && !r.start_date && !r.end_date;
              const weekendRule = rules.find(isAlwaysWeekend);
              const others = describeMinNightsRules({ min_nights_rules: rules.filter((r) => !isAlwaysWeekend(r)) });
              return (
                <label className="block">
                  <span className={sectionLabel} style={{ ...sectionLabelStyle, marginBottom: 4 }}>מינימום לילות בסופ"ש (חמשוש)</span>
                  <input
                    type="number"
                    min={1}
                    value={weekendRule?.min_nights || ''}
                    placeholder="ללא הגבלה"
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      const rest = rules.filter((r) => !isAlwaysWeekend(r));
                      onEditField('min_nights_rules', n > 1 ? [...rest, { scope: 'weekend', min_nights: n, start_date: null, end_date: null, label: null }] : rest);
                    }}
                    className={fieldInputClass}
                    style={{ color: '#0B3838' }}
                  />
                  {others && <span className="font-simona block mt-1" style={hintStyle}>כללים נוספים: {others}</span>}
                </label>
              );
            })()}
            <div>
              <span className={sectionLabel} style={sectionLabelStyle}>חלוקת חדרים, מיטות ומתקנים</span>
              {!bedAllocationStatus(builtZimmer).complete && (
                <div className="mb-3"><BedAllocationCounter status={bedAllocationStatus(builtZimmer)} /></div>
              )}
              <RoomsDetailEditor
                value={Array.isArray(builtZimmer.rooms_detail) ? builtZimmer.rooms_detail : []}
                onChange={(rooms) => onEditField('rooms_detail', rooms)}
                additionalBathrooms={builtZimmer.additional_bathrooms_count ?? 0}
                onAdditionalBathroomsChange={(n) => onEditField('additional_bathrooms_count', n)}
                onRoomPhotoUploaded={onRoomPhotoUploaded}
                allowEmptyBeds
                customBedTypes={customBedTypes}
              />
              <p className="font-simona mt-2" style={hintStyle}>המיטות שובצו רק לפי מה שציינת או שיבצת — בדוק ותקן אם צריך לפני פרסום.</p>
            </div>
            <div>
              <span className={sectionLabel} style={sectionLabelStyle}>מתחם חיצוני (חצר)</span>
              <OutdoorAreaEditor
                value={builtZimmer.outdoor_area}
                onChange={(area) => onEditField('outdoor_area', area)}
              />
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
