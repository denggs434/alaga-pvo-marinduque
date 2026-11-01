/**
 * Thin wrapper around fetch() for the Voltyard REST API.
 * - Sends/receives JSON
 * - Adds the JWT from localStorage when the user is logged in
 * - Throws an Error with the server's message on non-2xx responses
 *
 * If the client is hosted separately from the API, set window.VOLTYARD_API
 * before this script loads, e.g. <script>window.VOLTYARD_API='https://api.example.com/api'</script>
 */
import { getToken, clearSession } from './store.js';

const BASE = window.VOLTYARD_API || '/api';

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Check that the API is running and try again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) clearSession(); // stale token
    const err = new Error(data.message || `Request failed (${res.status}).`);
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}

/** Build a query string, skipping empty values. */
export function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}
