/**
 * URL / storage bootstrap params.
 * Still accepts ?access_token= and legacy `token` key for session grace.
 */
const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const isPlaceholder = (v) =>
  typeof v === 'string' && v.includes('REPLACE_WITH');

function readToken() {
  if (isNode) return null;

  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('clear_access_token') === 'true') {
      storage.removeItem('access_token');
      storage.removeItem('token');
      urlParams.delete('clear_access_token');
      const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams}` : ''}${window.location.hash}`;
      window.history.replaceState({}, document.title, newUrl);
    }

    const fromUrl = urlParams.get('access_token');
    if (fromUrl && !isPlaceholder(fromUrl)) {
      storage.setItem('access_token', fromUrl);
      storage.removeItem('token');
      urlParams.delete('access_token');
      const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams}` : ''}${window.location.hash}`;
      window.history.replaceState({}, document.title, newUrl);
      return fromUrl;
    }
  }

  const primary = storage.getItem('access_token');
  if (primary && !isPlaceholder(primary)) return primary;

  const legacy = storage.getItem('token');
  if (legacy && !isPlaceholder(legacy)) {
    storage.setItem('access_token', legacy);
    storage.removeItem('token');
    return legacy;
  }
  return null;
}

function readFromUrl(paramName, { defaultValue, removeFromUrl = false } = {}) {
  if (isNode) return defaultValue ?? null;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);
  if (removeFromUrl && searchParam != null) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }
  if (searchParam && !isPlaceholder(searchParam)) return searchParam;
  return defaultValue ?? null;
}

export const appParams = {
  token: readToken(),
  fromUrl: readFromUrl('from_url', {
    defaultValue: typeof window !== 'undefined' ? window.location.href : undefined,
  }),
};
