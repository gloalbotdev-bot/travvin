import React from 'react';
import { X, History as HistoryIcon, Loader2 } from 'lucide-react';

// Generic history overlay shared by the owner AI assistant and the customer
// search chat. Renders a paginated list of past conversations inside a
// backdrop-closable sheet. The parent owns the list + paging and passes a
// renderRow function so each side can show its own row shape.
export default function ChatHistoryOverlay({
  open,
  onClose,
  items,
  renderRow,
  onSelect,
  hasMore,
  onLoadMore,
  loadingMore,
  emptyText = 'אין שיחות קודמות עדיין'
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      dir="rtl"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto flex flex-col overflow-hidden"
        style={{
          maxHeight: '80vh',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          border: '1px solid rgba(0,0,0,0.06)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1.5px solid #F0EEE8' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.1)' }}>
              <HistoryIcon size={18} style={{ color: '#F97316' }} />
            </div>
            <h3 className="font-black text-base" style={{ color: '#1A1A1A' }}>היסטוריית צ'אטים</h3>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{ width: 36, height: 36, borderRadius: 10, background: '#F8F7F4', color: '#6B7280' }}
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-3" style={{ minHeight: 0 }}>
          {items.length === 0 && !loadingMore ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HistoryIcon size={30} style={{ color: '#D1D5DB' }} />
              <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>{emptyText}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <button
                  key={item.id || idx}
                  onClick={() => onSelect(item)}
                  className="w-full text-right rounded-xl px-3.5 py-3 transition-all hover:opacity-80"
                  style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}
                >
                  {renderRow(item)}
                </button>
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="pt-3 pb-1 flex justify-center">
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl transition-all"
                style={{ background: '#0B3838', color: '#fff' }}
              >
                  {loadingMore ? <><Loader2 size={13} className="animate-spin" /> טוען…</> : 'טען עוד'}
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}