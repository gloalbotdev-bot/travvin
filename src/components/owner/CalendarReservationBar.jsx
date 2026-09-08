import React from 'react';

/** Presentational reservation bar — Figma Frame 86 Reservation Bar */
export default function CalendarReservationBar({
  label,
  pending,
  bg,
  textColor = '#0B3838',
  onClick,
  style,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute flex items-center overflow-hidden pointer-events-auto transition-opacity hover:opacity-90"
      style={{
        height: 32,
        borderRadius: 10,
        background: pending ? '#EFEFEF' : bg,
        paddingInline: 12,
        ...style,
      }}
      title={label}
    >
      <div className="flex items-center w-full min-w-0" style={{ gap: 13 }} dir="rtl">
        <span
          className="flex-shrink-0 rounded-full"
          style={{ width: 8, height: 8, background: pending ? '#9CA3AF' : '#0B3838', opacity: 0.35 }}
        />
        <span
          className="font-simona flex-1 min-w-0 truncate text-right"
          style={{ color: pending ? '#383838' : textColor, fontSize: 15, fontWeight: 500 }}
        >
          {label}
        </span>
        {pending ? (
          <span
            className="font-simona flex-shrink-0 flex items-center justify-center"
            style={{
              background: '#FFFF00',
              color: '#0B3838',
              fontSize: 15,
              fontWeight: 500,
              height: 20,
              minWidth: 55,
              borderRadius: 10,
              paddingInline: 8,
            }}
          >
            ממתין
          </span>
        ) : (
          <span
            className="flex-shrink-0 rounded-full"
            style={{ width: 8, height: 8, background: '#0B3838', opacity: 0.35 }}
          />
        )}
      </div>
    </button>
  );
}
