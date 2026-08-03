import React from 'react';
import { FileText, AlertTriangle, PenLine } from 'lucide-react';
import { isSummaryStale } from '@/lib/infoSummary';

// Shared "info summary" section — identical display for owner and customer.
// Owner additionally gets create / sync / edit affordances.
export default function InfoSummarySection({ zimmer, isOwner, onEdit }) {
  const summary = zimmer?.info_summary;
  const stale = isSummaryStale(zimmer);

  // Customer with no summary: show nothing (keeps owner & customer views aligned
  // — both rely solely on the curated summary, never on raw data zones).
  if (!summary && !isOwner) return null;

  return (
    <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-xs uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#F97316' }}>
          <FileText size={12} /> סיכום מידע
        </h2>
        {isOwner && summary && !stale && (
          <button onClick={onEdit}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
            style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}>
            <PenLine size={12} /> עריכת סיכום
          </button>
        )}
      </div>

      {/* Owner: no summary yet → prompt to create */}
      {isOwner && !summary && (
        <div className="rounded-xl p-4 text-center" style={{ background: '#F8F7F4', border: '1.5px dashed #E8E5E0' }}>
          <p className="text-sm mb-3" style={{ color: '#6B7280' }}>עדיין אין סיכום מידע ללקוחות. צור סיכום מתוך אזורי המידע שאספת.</p>
          <button onClick={onEdit}
            className="text-white px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: '#F97316' }}>
            צור סיכום מידע
          </button>
        </div>
      )}

      {/* Owner: new info not synced → notice + refresh/edit */}
      {isOwner && summary && stale && (
        <div className="rounded-xl p-3 mb-3 flex items-center gap-2 flex-wrap" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <AlertTriangle size={15} style={{ color: '#D97706' }} />
          <span className="text-xs flex-1" style={{ color: '#92400E' }}>
            יש מידע נוסף שלא מסונכרן בתצוגת המידע שהלקוח רואה (נוסף/עודכן אזור מידע).
          </span>
          <button onClick={onEdit}
            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90"
            style={{ background: '#D97706' }}>
            רענן / ערוך סיכום
          </button>
        </div>
      )}

      {summary && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#4B5563' }}>{summary}</p>
      )}
    </section>
  );
}