/**
 * Shared HTTP for own-backend API clients.
 */
export function getApiBase() {
  return (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OWN_API_URL) ||
    'http://localhost:3001'
  );
}

export function getStoredToken() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('access_token') || localStorage.getItem('token') || null;
}

export function setStoredToken(token) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('access_token', token);
  localStorage.removeItem('token');
}

export function clearStoredToken() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('token');
}

export async function ownFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
