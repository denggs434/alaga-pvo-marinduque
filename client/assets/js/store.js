/**
 * The login session ({ token, user }) kept in localStorage.
 * Every storage call is wrapped so the site still works when storage is blocked.
 * The server re-checks the token and role on every request; this copy only
 * decides what to show.
 */
const SESSION_KEY = 'alaga.session';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const getSession = () => read(SESSION_KEY, null);
export const getToken = () => getSession()?.token || null;
export const getUser = () => getSession()?.user || null;
export const isAdmin = () => getUser()?.role === 'admin';
export const isOwner = () => getUser()?.role === 'owner';

export function setSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable: session lasts until reload */
  }
  document.dispatchEvent(new CustomEvent('session:change'));
}

/** Replace the stored user (and token, when the server issued a new one). */
export function updateSessionUser(user, token) {
  const s = getSession();
  if (s) setSession({ token: token || s.token, user });
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  document.dispatchEvent(new CustomEvent('session:change'));
}
