import React from 'react';
import AiQuickActions from './AiQuickActions';
import AiToggles from './AiToggles';
import AiChatBox from './AiChatBox';
import AiNotifications from './AiNotifications';

// The dedicated AI sidebar for the bookings page (Figma).
export default function BookingsAiSidebar({ bookings, zimmers, onQuickAction, onApproveQuick, onCreatePromo }) {
  return (
    <aside className="hidden lg:flex w-[340px] flex-shrink-0 flex-col" style={{ borderRight: '1px solid #ECEFF1', background: '#F9F9F9' }} dir="rtl">
      <div className="p-4" style={{ borderBottom: '1px solid #ECEFF1' }}>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-bold text-base" style={{ color: '#212121' }}>הצעות AI</h2>
        </div>
        <p className="text-xs" style={{ color: '#9e9e9e' }}>שיעזור לך לשפר ולנהל את הנכס AI</p>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <div>
          <h3 className="text-xs font-bold mb-2" style={{ color: '#616161' }}>פעולות מהירות</h3>
          <AiQuickActions onAction={onQuickAction} />
        </div>

        <div style={{ borderTop: '1px solid #ECEFF1' }}>
          <AiToggles />
        </div>

        <div>
          <h3 className="text-xs font-bold mb-2" style={{ color: '#616161' }}>התראות AI</h3>
          <AiNotifications bookings={bookings} onApproveQuick={onApproveQuick} onCreatePromo={onCreatePromo} />
        </div>
      </div>

      <AiChatBox bookings={bookings} zimmers={zimmers} />
    </aside>
  );
}