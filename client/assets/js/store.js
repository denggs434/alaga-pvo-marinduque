/**
 * Client-side state kept in localStorage:
 *  - session: { token, user } after login
 *  - cart:    [{ id, name, image, price, category, condition, deposit, qty, stock }]
 * Every storage call is wrapped so the site still works when storage is blocked.
 */
const SESSION_KEY = 'voltyard.session';
const CART_KEY = 'voltyard.cart';
export const DEFAULT_DEPOSIT = 50000;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: state lasts until reload */
  }
}

/* ---------- Session ---------- */
export const getSession = () => read(SESSION_KEY, null);
export const getToken = () => getSession()?.token || null;
export const getUser = () => getSession()?.user || null;
export const isAdmin = () => getUser()?.role === 'admin';

export function setSession(session) {
  write(SESSION_KEY, session);
  document.dispatchEvent(new CustomEvent('session:change'));
}
export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  document.dispatchEvent(new CustomEvent('session:change'));
}

/* ---------- Cart ---------- */
export const getCart = () => read(CART_KEY, []);

function saveCart(cart) {
  write(CART_KEY, cart);
  document.dispatchEvent(new CustomEvent('cart:change', { detail: cart }));
}

/** Add a product. Vehicles are capped at 1 per cart; accessories at their stock. */
export function addToCart(product, qty = 1) {
  const cart = getCart();
  const line = cart.find((l) => l.id === product._id);
  const max = product.category === 'vehicle' ? 1 : Math.max(product.stock, 0);

  if (line) {
    if (product.category === 'vehicle') return { ok: false, message: `${product.name} is already in your cart.` };
    line.qty = Math.min(line.qty + qty, max);
  } else {
    cart.push({
      id: product._id,
      slug: product.slug,
      name: product.name,
      image: product.image,
      price: product.price,
      category: product.category,
      condition: product.condition,
      deposit: product.category === 'vehicle' ? product.deposit ?? DEFAULT_DEPOSIT : null,
      stockNumber: product.stockNumber,
      stock: max,
      qty: Math.min(qty, max),
    });
  }
  saveCart(cart);
  return { ok: true, message: `Added ${product.name} to your cart.` };
}

export function setQty(id, qty) {
  const cart = getCart();
  const line = cart.find((l) => l.id === id);
  if (!line) return;
  line.qty = Math.max(1, Math.min(qty, line.stock || 1));
  saveCart(cart);
}

export function removeFromCart(id) {
  saveCart(getCart().filter((l) => l.id !== id));
}

export const clearCart = () => saveCart([]);
export const cartCount = () => getCart().reduce((n, l) => n + l.qty, 0);

/** Totals mirror the server's calculation so shoppers see the same numbers. */
export function cartTotals(cart = getCart()) {
  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const dueNow = cart.reduce((s, l) => s + (l.category === 'vehicle' ? l.deposit : l.price * l.qty), 0);
  return { subtotal, dueNow, balance: subtotal - dueNow };
}
