import React from 'react';
import { AlertTriangle, PenLine } from 'lucide-react';
import { isSummaryStale } from '@/lib/infoSummary';

// Shared "info summary" section — identical display for owner and customer.
// Owner additionally gets create / sync / edit affordances.
// variant="inline" — flat section for ZimmerView / Figma property card
export default function InfoSummarySection({ zimmer, isOwner, onEdit, variant = 'card' }) {
  const summary = zimmer?.info_summary;
  const stale = isSummaryStale(zimmer);
  const inline = variant === 'inline';

  // Customer with no summary: show nothing (keeps owner & customer views aligned
  // — both rely solely on the curated summary, never on raw data zones).
  if (!summary && !isOwner) return null;

  const shellClass = inline
    ? 'flex flex-col gap-3 w-full items-stretch text-right'
    : 'rounded-[16px] p-5 sm:p-6';
  const shellStyle = inline
    ? undefined
    : { background: '#fff', border: '1px solid #E8E8E8' };

  return (
    <section className={shellClass} style={shellStyle} dir="rtl">
      <div className="flex items-center justify-between gap-3 w-full">
        <h2
          className="font-simpler flex-1 text-right"
          style={{ color: '#0B3838', fontSize: inline ? 20 : 18, fontWeight: 600 }}
        >
          סיכום מידע
        </h2>
        {isOwner && summary && !stale && (
          <button
            type="button"
            onClick={onEdit}
            className="font-simona flex items-center gap-1.5 shrink-0 transition-opacity hover:opacity-80"
            style={{
              background: '#FAFAFA',
              color: '#0B3838',
              borderRadius: 17,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <PenLine size={13} /> עריכת סיכום
          </button>
        )}
      </div>

      {isOwner && !summary && (
        <div
          className="rounded-[16px] p-5 text-center"
          style={{ background: '#FAFAFA', border: '1px dashed #E8E8E8' }}
        >
          <p className="font-simona text-sm mb-3" style={{ color: '#717171', lineHeight: '22px' }}>
            עדיין אין סיכום מידע ללקוחות. צור סיכום מתוך אזורי המידע שאספת.
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="font-simpler text-white transition-opacity hover:opacity-90"
            style={{ background: '#0B3838', borderRadius: 123, padding: '10px 22px', fontSize: 14, fontWeight: 600 }}
          >
            צור סיכום מידע
          </button>
        </div>
      )}

      {isOwner && summary && stale && (
        <div
          className="rounded-[16px] p-3 flex items-center gap-2 flex-wrap"
          style={{ background: '#FAFAFA', border: '1px solid #E8E8E8' }}
        >
          <AlertTriangle size={15} style={{ color: '#0B3838' }} />
          <span className="font-simona text-xs flex-1 text-right" style={{ color: '#717171' }}>
            יש מידע נוסף שלא מסונכרן בתצוגת המידע שהלקוח רואה (נוסף/עודכן אזור מידע).
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="font-simpler text-white transition-opacity hover:opacity-90"
            style={{ background: '#0B3838', borderRadius: 123, padding: '8px 14px', fontSize: 12, fontWeight: 600 }}
          >
            רענן / ערוך סיכום
          </button>
        </div>
      )}

      {summary && (
        <p
          className="font-simona w-full whitespace-pre-wrap text-right"
          style={{ color: '#717171', fontSize: 16, fontWeight: 400, lineHeight: '26px' }}
        >
          {summary}
        </p>
      )}
    </section>
  );
}
