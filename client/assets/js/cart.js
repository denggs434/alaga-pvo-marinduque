/**
 * The shopping cart, kept in this browser (localStorage) until checkout.
 * Each line stores a copy of what the shop page showed (name, price, photo,
 * stock) so the cart can be drawn without a request; the server re-checks
 * price and stock when the order is placed.
 *
 *   cart.lines()           -> [{ id, name, price, photo, category, stock, shop, shopId, qty }]
 *   cart.add(product, qty) / cart.setQty(id, qty) / cart.remove(id) / cart.clear()
 *   cart.count()           -> number of items
 * Every change fires "cart:change" on document.
 */
const KEY = 'alaga.cart';
const MAX_QTY = 20;

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((l) => l && l.id && l.qty > 0) : [];
  } catch {
    return [];
  }
}

let memory = read();
let blocked = false; // storage unavailable: the cart lives in memory until reload

function write(lines) {
  memory = lines;
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { blocked = true; }
  document.dispatchEvent(new CustomEvent('cart:change'));
}

const limit = (l, qty) => Math.max(1, Math.min(qty, MAX_QTY, l.stock || MAX_QTY));

export const cart = {
  lines: () => (blocked ? memory : read()).map((l) => ({ ...l })),
  count: () => cart.lines().reduce((n, l) => n + l.qty, 0),
  subtotal: () => cart.lines().reduce((s, l) => s + l.price * l.qty, 0),
  qtyOf: (id) => cart.lines().find((l) => l.id === id)?.qty || 0,

  /** Add a product (as returned by the API). Returns the new quantity in the cart. */
  add(p, qty = 1) {
    const lines = cart.lines();
    let line = lines.find((l) => l.id === p._id);
    if (!line) {
      line = { id: p._id, qty: 0 };
      lines.push(line);
    }
    Object.assign(line, { name: p.name, price: p.price, photo: p.photos?.[0] || '', category: p.category, stock: p.stock, shop: p.shop?.name || 'Alaga Official Store', shopId: p.shop?.id || 'official' });
    line.qty = limit(line, line.qty + qty);
    write(lines);
    return line.qty;
  },
  setQty(id, qty) {
    const lines = cart.lines();
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    line.qty = limit(line, qty);
    write(lines);
  },
  remove(id) { write(cart.lines().filter((l) => l.id !== id)); },
  clear() { write([]); },
};

// Another tab changed the cart: tell this page.
addEventListener('storage', (e) => { if (e.key === KEY) { document.dispatchEvent(new CustomEvent('cart:change')); } });
