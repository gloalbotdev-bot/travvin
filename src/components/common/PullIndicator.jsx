import React from 'react';
import { RefreshCw } from 'lucide-react';

// Visual pull-to-refresh indicator. Render as the first child inside the
// scroll container passed to usePullToRefresh. Zero height when idle.
export default function PullIndicator({ pull = 0, refreshing = false, threshold = 70 }) {
  if (pull <= 0 && !refreshing) return null;
  const ready = pull >= threshold;
  return (
    <div className="flex items-center justify-center overflow-hidden" style={{ height: pull, flexShrink: 0 }}>
      <div className="flex items-center justify-center"
        style={{ transform: `rotate(${refreshing ? 0 : pull * 3}deg)`, transition: refreshing ? 'none' : 'transform 0.1s ease-out' }}>
        <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} style={{ color: ready || refreshing ? '#F97316' : '#9CA3AF' }} />
      </div>
    </div>
  );
}
