import { useRef, useCallback, useEffect } from 'react';

// Returns a ref to attach to a textarea + a resize() callback.
// The textarea grows with its content up to maxPx, then scrolls internally.
export function useAutoResize(value, maxPx = 220) {
  const ref = useRef(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxPx) + 'px';
  }, [maxPx]);
  useEffect(() => { resize(); }, [value, resize]);
  return { ref, resize };
}