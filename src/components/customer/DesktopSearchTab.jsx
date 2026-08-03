import React from 'react';
import DesktopSearch from '@/pages/DesktopSearch';
import { X } from 'lucide-react';

export default function DesktopSearchTab({ onExit }) {
  return (
    <div className="h-screen flex flex-col bg-[#F5F5F5]" dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <div className="flex-1 min-h-0 overflow-hidden">
        <DesktopSearch />
      </div>
      <button
        type="button"
        onClick={onExit}
        className="shrink-0 mx-3 mb-3 mt-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: '#1A1A1A', color: '#fff' }}
      >
        <X size={16} /> יציאה ממצב חיפוש
      </button>
    </div>
  );
}