import React, { useEffect, useRef, useState } from 'react';

/**
 * Figma-styled scroll thumb for a scroll container whose native scrollbar is hidden.
 * Render inside a positioned ancestor; `style` places the track (e.g. { left, top, bottom }).
 */
export default function CustomScrollThumb({ targetRef, style, className = '', width = 10.4, height = 114, color = '#E8E8E8', radius = 47 }) {
  const trackRef = useRef(null);
  const drag = useRef(null);
  const [state, setState] = useState({ visible: false, offset: 0 });

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return undefined;
    const update = () => {
      const track = trackRef.current;
      const max = el.scrollHeight - el.clientHeight;
      if (!track || max <= 1) { setState((s) => (s.visible ? { visible: false, offset: 0 } : s)); return; }
      const room = Math.max(0, track.clientHeight - height);
      setState({ visible: true, offset: (el.scrollTop / max) * room });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [targetRef, height]);

  const onPointerDown = (e) => {
    const el = targetRef.current;
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, top: el.scrollTop };
  };

  const onPointerMove = (e) => {
    const el = targetRef.current;
    const track = trackRef.current;
    if (!drag.current || !el || !track) return;
    const room = Math.max(1, track.clientHeight - height);
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = drag.current.top + ((e.clientY - drag.current.y) / room) * max;
  };

  const onPointerUp = () => { drag.current = null; };

  return (
    <div ref={trackRef} className={`absolute pointer-events-none ${className}`} style={{ width, ...style }} aria-hidden>
      {state.visible && (
        <div
          className="absolute inset-x-0 pointer-events-auto cursor-grab active:cursor-grabbing touch-none"
          style={{ top: state.offset, height, background: color, borderRadius: radius }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      )}
    </div>
  );
}
