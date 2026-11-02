import { useEffect, useRef } from 'react';

/**
 * Subscribe to one or more entity APIs and call `load({ silent: true })` on change.
 * Does not replace the screen's own mount loader unless `loadOnMount` is true.
 *
 * @param {{
 *   entities: Array<{ subscribe: (cb: (ev: object) => void) => () => void } | null | undefined>,
 *   load: (opts?: { silent?: boolean }) => void | Promise<void>,
 *   enabled?: boolean,
 *   debounceMs?: number,
 *   loadOnMount?: boolean,
 * }} opts
 */
export function useEntityReload({
  entities,
  load,
  enabled = true,
  debounceMs = 120,
  loadOnMount = false,
}) {
  const loadRef = useRef(load);
  loadRef.current = load;

  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;

  useEffect(() => {
    if (!enabled) return undefined;

    const run = (silent) => {
      void loadRef.current?.(silent ? { silent: true } : undefined);
    };

    if (loadOnMount) run(false);

    let timer = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        run(true);
      }, debounceMs);
    };

    const unsubs = (entitiesRef.current || [])
      .filter((e) => e && typeof e.subscribe === 'function')
      .map((e) => e.subscribe(() => { schedule(); }));

    return () => {
      if (timer) clearTimeout(timer);
      for (const u of unsubs) u();
    };
  }, [enabled, debounceMs, loadOnMount]);
}
