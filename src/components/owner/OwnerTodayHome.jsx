/**
 * Owner "היום" tab — Figma Desktop:
 * https://www.figma.com/design/3rRfXaZ752TAyPABkfCjSJ/?node-id=1776-18223
 */
import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import useOwnerTodayData from '@/components/owner/useOwnerTodayData';
import BookingsSnapshotStrip from '@/components/owner/bookings/BookingsSnapshotStrip';
import { PropertyThumb, GuestCircle } from '@/components/owner/bookings/BookingsAiSidebar';
import { formatRangeLong, nightsBetween, nightsLabel } from '@/components/owner/bookings/bookingStatus';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';
import OwnerHomeComposer from '@/components/owner/OwnerHomeComposer';
import OwnerAssistantThread from '@/components/owner/OwnerAssistantThread';
import useOwnerAssistantThread, { composerPlaceholder } from '@/hooks/useOwnerAssistantThread';
import { OwnerAssistantSuggestions } from '@/components/owner/OwnerAssistantHome';
import { monthStats } from '@/lib/occupancy';
import CustomScrollThumb from '@/components/common/CustomScrollThumb';
import iconChat from '@/assets/owner/bookings/sidebar-chat.svg';
import iconChevron from '@/assets/owner/bookings/sidebar-chevron.svg';
import iconHouse from '@/assets/owner/today/cta-house.svg';
import iconAlert from '@/assets/owner/today/alert.svg';
import iconCollapse from '@/assets/owner/today/collapse.svg';

const INK = '#0B3838';
const VISIBLE_CARDS = 3;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 18) return 'צהריים טובים';
  return 'ערב טוב';
}

const ACTION_LABEL = {
  answer_question: 'אשר תשובה',
  open_chat: "פתח צ'אט",
};

function toCard(a) {
  const b = a.booking;
  const guest = b?.guest_name || 'אורחים';
  const place = b?.zimmer_name || a.zimmer?.name || '';
  const range = b ? formatRangeLong(b.check_in, b.check_out) : '';
  const image = a.zimmer?.images?.[0];
  switch (a.type) {
    case 'send_directions':
      return {
        date: b?.check_in_time ? `היום · בשעה · ${b.check_in_time}` : 'היום',
        title: `${guest} מגיעים היום`,
        body: 'הצ׳ק־אין שלהם מתקרב.',
        action: 'שלחי להם הוראות הגעה',
        actionSub: 'עזרי להם להגיע מוכנים לצ׳ק־אין.',
        icon: iconChat, image,
      };
    case 'approve_booking':
      return {
        date: range,
        title: 'יש לך הזמנה חדשה',
        body: `${guest} הזמינו ${nightsLabel(nightsBetween(b?.check_in, b?.check_out))}${place ? ` ב${place}` : ''}.`,
        action: 'לאשר את ההזמנה',
        actionSub: 'פתחי את ההזמנה ואשרי או דחי אותה.',
        icon: iconChat, image,
      };
    case 'missing_info':
      return {
        alert: true,
        title: 'חסר מידע בנכס',
        body: `ב״${a.zimmer?.name || 'נכס'}״ עדיין חסרים כמה פרטים חשובים.`,
        action: 'השלימי את פרטי הנכס',
        actionSub: 'עזרי לאורחים להבין אם המקום מתאים להם עוד לפני ההזמנה.',
        icon: iconHouse, image,
      };
    case 'cancel_booking':
      return {
        date: range,
        title: 'התקבלה בקשת ביטול',
        body: `${guest} ביקשו לבטל את ההזמנה${place ? ` ב${place}` : ''}.`,
        action: 'לטפל בבקשה',
        actionSub: 'פתחי את ההזמנה ואשרי או דחי את הביטול.',
        icon: iconChat, image,
      };
    default:
      return {
        alert: true,
        title: a.title,
        body: a.sub,
        action: ACTION_LABEL[a.type] || 'טפל',
        icon: iconChat, image,
      };
  }
}

/** Figma 1776:18229 — 533×294 #FAFAFA r23 task card. */
function TaskCard({ card, onAction }) {
  return (
    <div
      className="w-full flex flex-col items-center justify-center"
      style={{ maxWidth: 533, minHeight: 294, background: '#FAFAFA', borderRadius: 23, padding: '24px 0', gap: 56 }}
    >
      <div className="w-full flex flex-col items-center" style={{ gap: 40 }}>
        <div className="flex flex-col items-center w-full" style={{ gap: 31 }}>
          {card.alert ? (
            <img src={iconAlert} alt="" className="block" style={{ width: 13.9, height: 13.9 }} />
          ) : (
            <p className="font-simona text-center" style={{ color: INK, fontSize: 17, fontWeight: 400, lineHeight: 'normal' }}>{card.date}</p>
          )}
          <div className="flex items-center justify-center" style={{ width: 445, maxWidth: 'calc(100% - 24px)', gap: 12 }}>
            <div className="relative flex-shrink-0" style={{ width: 104.58, height: 91.19 }}>
              <div className="absolute" style={{ right: 0, top: 0 }}><PropertyThumb src={card.image} /></div>
              <div className="absolute" style={{ left: 0, top: 33.63 }}><GuestCircle size={49.435} border="2px solid #FAFAFA" /></div>
            </div>
            <div className="text-right min-w-0" style={{ width: 234 }}>
              <p className="font-simpler" style={{ color: INK, fontSize: 22, fontWeight: 600, lineHeight: 'normal' }}>{card.title}</p>
              {card.body && (
                <p
                  className="font-simona line-clamp-3"
                  style={{ color: INK, fontSize: 20, fontWeight: 400, lineHeight: 1.379, marginTop: 3 }}
                  dir="auto"
                >
                  {card.body}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="w-full" style={{ height: 1, background: 'rgba(0,0,0,0.17)' }} aria-hidden />
      </div>
      <button
        type="button"
        onClick={onAction}
        className="flex items-center justify-between text-right transition-opacity hover:opacity-80"
        style={{ width: 410, maxWidth: 'calc(100% - 24px)', gap: 12 }}
      >
        <span className="flex items-center" style={{ gap: 6 }}>
          <img src={card.icon} alt="" width={28} height={29} className="block flex-shrink-0" style={{ width: 28, height: 29 }} />
          <span className="flex flex-col items-start">
            <span className="font-simona" style={{ color: INK, fontSize: 18, fontWeight: 500, lineHeight: 'normal' }}>{card.action}</span>
            {card.actionSub && (
              <span className="font-simona" style={{ color: INK, fontSize: 14, fontWeight: 400, lineHeight: 'normal', marginTop: 2 }}>{card.actionSub}</span>
            )}
          </span>
        </span>
        <img src={iconChevron} alt="" width={8} height={14} className="block flex-shrink-0" style={{ width: 8, height: 14 }} />
      </button>
    </div>
  );
}

export default function OwnerTodayHome({
  ownerId, zimmers, currentUser, onAction, onNavigate, onEditZimmer, onAssistantMutated, onOpenForm,
}) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef(null);
  const chat = useOwnerAssistantThread({
    ownerId,
    surface: 'home',
    onMutated: onAssistantMutated,
    onOpenForm,
  });

  const showThread = chat.chatStarted;
  const {
    bookings, loading, selectedZimmer, setSelectedZimmer,
    checkoutsToday, checkinsToday, pending, activeGuests,
    actions, handleAction,
  } = useOwnerTodayData({ ownerId, zimmers, onAction, onNavigate, onEditZimmer });

  const firstName = (currentUser?.full_name || '').split(' ')[0] || '';
  const stats = monthStats(
    selectedZimmer === 'all' ? bookings : bookings.filter(b => b.zimmer_id === selectedZimmer),
    zimmers,
    selectedZimmer === 'all' ? zimmers.length : 1,
  );
  const shown = expanded ? actions : actions.slice(0, VISIBLE_CARDS);

  return (
    <div className="relative flex flex-col h-full bg-white" dir="rtl">
      <div className="hidden lg:block relative z-10">
        <BookingsSnapshotStrip
          bookings={bookings}
          zimmers={zimmers}
          zimmerFilter={selectedZimmer}
          onZimmerFilter={setSelectedZimmer}
          values={{
            checkin: checkinsToday.length,
            pending: pending.length,
            checkout: checkoutsToday.length,
            active: activeGuests.length,
          }}
          offsetLeft={40}
          titleGap={24.7}
          numberColor={INK}
          stats={stats}
        />
      </div>

      <div className="relative flex-1 min-h-0">
      <div ref={scrollRef} className="h-full overflow-y-auto owner-hide-scrollbar">
        {showThread ? (
          <div className="flex flex-col items-center px-4" style={{ paddingTop: 24.5, paddingBottom: 240 }}>
            <div className="w-full flex justify-start" style={{ maxWidth: 723, marginBottom: 24 }}>
              <button
                type="button"
                onClick={chat.reset}
                disabled={chat.isTyping}
                className="font-simona transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ color: INK, fontSize: 14, textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                חזרה למשימות היום
              </button>
            </div>
            <OwnerAssistantThread
              messages={chat.messages}
              isTyping={chat.isTyping}
              busyActionId={chat.busyActionId}
              onConfirm={chat.confirm}
              onCancel={chat.cancel}
              onNavigate={onNavigate}
              onOpenForm={onOpenForm}
              scrollParentRef={scrollRef}
            />
          </div>
        ) : (
        <div className="flex flex-col items-center px-4" style={{ paddingTop: 24.5, paddingBottom: 240 }}>
          <OwnerAiIcon variant="orb" size={90} />
          <h1
            className="font-simpler text-center"
            style={{ color: '#0F4D4D', fontSize: 35, fontWeight: 600, lineHeight: '34px', marginTop: 28 }}
          >
            {firstName ? `היי ${firstName}, ${greeting()}` : `היי, ${greeting()}`}
          </h1>
          <p className="font-simona text-center" style={{ color: INK, fontSize: 20, fontWeight: 400, lineHeight: 'normal', marginTop: 4 }}>
            הנה כמה דברים קטנים שמחכים לטיפול היום
          </p>

          <div className="w-full flex flex-col items-center" style={{ gap: 32, marginTop: 41.8 }}>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin" style={{ color: '#9CA3AF' }} />
              </div>
            ) : actions.length === 0 ? (
              <div
                className="w-full flex items-center justify-center"
                style={{ maxWidth: 533, minHeight: 120, background: '#FAFAFA', borderRadius: 23 }}
                role="status"
              >
                <p className="font-simona" style={{ color: INK, fontSize: 18 }}>אין משימות פתוחות להיום</p>
              </div>
            ) : (
              shown.map(a => <TaskCard key={`${a.type}-${a.id}`} card={toCard(a)} onAction={() => handleAction(a)} />)
            )}
          </div>
          <OwnerAssistantSuggestions ownerId={ownerId} zimmers={zimmers} onNavigate={onNavigate} style={{ marginTop: 56 }} />
        </div>
        )}
      </div>
      {/* Figma 1776:18223 Rectangle 621 — scroll thumb 68px right of the cards column */}
      <CustomScrollThumb
        targetRef={scrollRef}
        className="hidden lg:block"
        width={10.4}
        height={114.2}
        radius={47}
        style={{ left: showThread ? 'calc(50% + 385px)' : 'calc(50% + 333.5px)', top: 24.5, bottom: 200 }}
      />
      </div>

      {/* Figma 1776:18350 — white fade behind the floating composer */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{ height: 192.5, background: 'linear-gradient(to top, #FFFFFF 71.727%, rgba(255,255,255,0))' }}
        aria-hidden
      />
      {!showThread && actions.length > VISIBLE_CARDS && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'הצג פחות משימות' : 'הצג את כל המשימות'}
          aria-expanded={expanded}
          className="absolute hidden lg:block transition-opacity hover:opacity-80"
          style={{ left: 'calc(50% - 350.8px)', bottom: 160.2, width: 28.866, height: 28.866 }}
        >
          <img
            src={iconCollapse}
            alt=""
            className="block w-full h-full"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          />
        </button>
      )}
      <div className="absolute inset-x-0 flex justify-center px-4" style={{ bottom: 38 }}>
        <OwnerHomeComposer
          onSubmit={chat.send}
          autoFocus={showThread}
          placeholder={composerPlaceholder(showThread)}
        />
      </div>
    </div>
  );
}
