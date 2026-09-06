import React from 'react';
import { Tag, CalendarOff, Plus } from 'lucide-react';

// 3 quick-action boxes: price update, block date, add booking (Figma).
export default function AiQuickActions({ onAction }) {
  const actions = [
    { id: 'update_price', label: 'עדכון מחיר', icon: Tag },
    { id: 'block_date', label: 'חסום תאריך', icon: CalendarOff },
    { id: 'add_booking', label: 'הוספת הזמנה', icon: Plus },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {actions.map(a => {
        const Icon = a.icon;
        return (
          <button key={a.id} onClick={() => onAction(a.id)}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors hover:bg-gray-50"
            style={{ border: '1px solid #ECEFF1', background: '#fff' }}>
            <Icon size={18} style={{ color: '#E53935' }} />
            <span className="text-xs font-medium" style={{ color: '#424242' }}>{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}