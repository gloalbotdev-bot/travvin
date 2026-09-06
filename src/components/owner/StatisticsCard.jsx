import React from 'react';

// A single metric card for the owner statistics page.
// accent: 'green' | 'orange' | 'purple' | 'gold'
export default function StatisticsCard({ icon: Icon, value, label, subtitle, accent = 'green', highlighted = false, onClick }) {
  const palettes = {
    green: { bg: 'rgba(34,197,94,0.10)', fg: '#16A34A', soft: '#16A34A' },
    orange: { bg: 'rgba(249,115,22,0.10)', fg: '#EA580C', soft: '#EA580C' },
    purple: { bg: 'rgba(124,58,237,0.10)', fg: '#7C3AED', soft: '#7C3AED' },
    gold: { bg: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(245,158,11,0.16) 100%)', fg: '#059669', soft: '#D97706' },
  };
  const p = palettes[accent] || palettes.green;

  return (
    <button
      onClick={onClick}
      className="text-right rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: '#fff',
        border: highlighted ? '1.5px solid rgba(217,119,6,0.35)' : '1.5px solid #F0EEE8',
        boxShadow: highlighted ? '0 8px 28px rgba(217,119,6,0.12)' : 'none',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: p.bg }}>
          <Icon size={22} style={{ color: p.fg }} />
        </div>
        {highlighted && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(217,119,6,0.12)', color: '#D97706' }}>
            ★ מצטיין
          </span>
        )}
      </div>
      <div className="text-4xl font-black leading-none mb-1.5" style={{ color: '#1A1A1A' }}>{value}</div>
      <div className="text-sm font-bold mb-1" style={{ color: '#1F2937' }}>{label}</div>
      {subtitle && <div className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{subtitle}</div>}
    </button>
  );
}