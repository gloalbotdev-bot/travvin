import { useState, useEffect, useRef } from 'react';

// Attaches touch-based pull-to-refresh to an existing scroll container (the
// element whose ref you pass). No layout changes, no nested scroll. Touch
// events only fire on touch devices, so desktop web scrolling is untouched.
export function usePullToRefresh(scrollRef, onRefresh, { threshold = 70, max = 100, disabled = false } = {}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || disabled) return;
    const onStart = (e) => {
      if (refreshingRef.current) return;
      startY.current = e.touches[0].clientY;
      pulling.current = false;
    };
    const onMove = (e) => {
      if (refreshingRef.current) return;
      const top = el.scrollTop;
      const dy = e.touches[0].clientY - startY.current;
      if (top <= 0 && dy > 0) {
        pulling.current = true;
        const next = Math.min(dy * 0.5, max);
        pullRef.current = next;
        setPull(next);
      } else if (pulling.current) {
        pulling.current = false;
        pullRef.current = 0;
        setPull(0);
      }
    };
    const onEnd = async () => {
      if (!pulling.current) { setPull(0); pullRef.current = 0; return; }
      pulling.current = false;
      if (pullRef.current >= threshold && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(threshold);
        try { await onRefreshRef.current?.(); } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          setPull(0);
          pullRef.current = 0;
        }
      } else {
        setPull(0);
        pullRef.current = 0;
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [scrollRef, disabled, max, threshold]);

  return { pull, refreshing };
}
