import { useEffect } from 'react';

// Controls the <meta name="robots"> tag for the current route.
// Default: noindex, nofollow (so Google doesn't index app/auth pages or AI-generated content).
// Public marketing pages pass 'index, follow'.
export function useRobotsMeta(content = 'noindex, nofollow') {
  useEffect(() => {
    let tag = document.querySelector('meta[name="robots"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'robots');
      document.head.appendChild(tag);
    }
    const prev = tag.getAttribute('content') || 'noindex, nofollow';
    tag.setAttribute('content', content);
    return () => { tag.setAttribute('content', 'noindex, nofollow'); prev; };
  }, [content]);
}