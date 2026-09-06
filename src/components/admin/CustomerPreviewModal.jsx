import React from 'react';
import { X } from 'lucide-react';
import ZimmerPublicPage from '@/components/customer/ZimmerPublicPage';

// Scrollable modal showing how a zimmer appears to an end customer. Used by
// owners/admins from the zimmer detail view instead of opening the live site.
export default function CustomerPreviewModal({ zimmer, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        className="relative bg-white rounded-none sm:rounded-2xl w-full h-full sm:h-[92vh] sm:max-w-5xl overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
        dir="rtl"
        style={{ fontFamily: 'Heebo, sans-serif' }}
      >
        {/* Sticky header so the close button is always reachable while scrolling */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ background: '#0B3838', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">תצוגת לקוח · {zimmer.name}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>תצוגה מקדימה</span>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable customer view */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#F8F7F4' }}>
          <ZimmerPublicPage zimmer={zimmer} onBack={onClose} preview />
        </div>
      </div>
    </div>
  );
}