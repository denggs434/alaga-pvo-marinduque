/**
 * Shared UI: site header/footer, formatters, product cards, toasts.
 * Every page imports this module and calls initPage().
 */
import { cartCount, getUser, isAdmin, clearSession } from './store.js';

/* ---------- Formatters ---------- */
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-PH');
export const formatPrice = (n) => peso.format(n || 0);
export const formatNumber = (n) => num.format(n || 0);
export const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

/** Escape text before putting it into innerHTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Icons (inline SVG, stroke = currentColor) ---------- */
const icon = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  cart: icon('<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>'),
  user: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  menu: icon('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  sun: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: icon('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
};

const BRAND_MARK = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
  <rect x="1" y="1" width="30" height="30" rx="5" fill="var(--ink)"/>
  <path d="M8 9h4.2L16 19.5 19.8 9H24l-6 15h-4z" fill="var(--bg)"/>
  <path d="M17.5 4.5 15 10h3l-2.5 5.5" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/* ---------- Header & footer ---------- */
const NAV = [
  { href: 'index.html', label: 'Home', key: 'home' },
  { href: 'products.html', label: 'Inventory', key: 'inventory' },
  { href: 'products.html?category=accessory', label: 'Charging & Parts', key: 'accessories' },
  { href: 'about.html', label: 'About', key: 'about' },
  { href: 'contact.html', label: 'Contact', key: 'contact' },
];

function renderHeader(active) {
  const user = getUser();
  const links = [...NAV, ...(isAdmin() ? [{ href: 'admin.html', label: 'Admin', key: 'admin' }] : [])];
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <nav class="wrap nav" aria-label="Main">
      <a class="brand" href="index.html">${BRAND_MARK}<span>Voltyard</span></a>
      <ul class="nav-links" id="nav-links">
        ${links.map((l) => `<li><a href="${l.href}" ${l.key === active ? 'aria-current="page"' : ''}>${l.label}</a></li>`).join('')}
      </ul>
      <div class="nav-tools">
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="Switch colour theme">${ICONS.moon}</button>
        <a class="icon-btn" href="account.html" aria-label="${user ? `Account: ${esc(user.name)}` : 'Log in'}" title="${user ? esc(user.name) : 'Log in'}">${ICONS.user}</a>
        <a class="icon-btn" href="cart.html" aria-label="Cart">${ICONS.cart}<span class="cart-count" id="cart-count" hidden></span></a>
        <button class="icon-btn menu-toggle" id="menu-toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Menu">${ICONS.menu}</button>
      </div>
    </nav>`;
  document.body.prepend(header);

  $('#menu-toggle').addEventListener('click', (e) => {
    const open = $('#nav-links').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });
  setupThemeToggle();
  updateCartBadge();
}

function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="wrap footer-grid">
      <div class="stack">
        <a class="brand" href="index.html">${BRAND_MARK}<span>Voltyard</span></a>
        <p class="muted">Independent Tesla dealer in Quezon City. New imports and certified pre-owned, every battery tested before sale.</p>
      </div>
      <div>
        <h4>Shop</h4>
        <ul>
          <li><a href="products.html?condition=new">New vehicles</a></li>
          <li><a href="products.html?condition=pre-owned">Pre-owned</a></li>
          <li><a href="products.html?condition=pre-order">Pre-order</a></li>
          <li><a href="products.html?category=accessory">Charging & parts</a></li>
        </ul>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About us</a></li>
          <li><a href="contact.html?topic=test-drive">Book a test drive</a></li>
          <li><a href="contact.html?topic=trade-in">Trade in your car</a></li>
          <li><a href="about.html#credits">Photo credits</a></li>
        </ul>
      </div>
      <div>
        <h4>Showroom</h4>
        <ul class="muted">
          <li>88 E. Rodriguez Jr. Ave.</li>
          <li>Quezon City, Metro Manila</li>
          <li class="mono">+63 2 8555 0142</li>
          <li>Tue–Sun, 10:00–19:00</li>
        </ul>
      </div>
    </div>
    <div class="wrap footer-base">
      <span>© ${new Date().getFullYear()} Voltyard Motors. A student project; not affiliated with Tesla, Inc.</span>
      <span>Tesla, Model 3, Model Y, Model S, Model X, Cybertruck and Roadster are trademarks of Tesla, Inc.</span>
    </div>`;
  document.body.append(footer);
}

/* ---------- Theme toggle (light / dark), remembered per browser ---------- */
function setupThemeToggle() {
  const btn = $('#theme-toggle');
  const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => document.documentElement.dataset.theme || (prefersDark() ? 'dark' : 'light');
  const paint = () => {
    btn.innerHTML = current() === 'dark' ? ICONS.sun : ICONS.moon;
    btn.setAttribute('aria-label', current() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  };
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('voltyard.theme', next); } catch { /* ignore */ }
    paint();
  });
  paint();
}
// Apply a saved theme as early as possible.
try {
  const saved = localStorage.getItem('voltyard.theme');
  if (saved) document.documentElement.dataset.theme = saved;
} catch { /* ignore */ }

export function updateCartBadge() {
  const el = $('#cart-count');
  if (!el) return;
  const n = cartCount();
  el.textContent = n;
  el.hidden = n === 0;
}
document.addEventListener('cart:change', updateCartBadge);

/* ---------- Toasts ---------- */
export function toast(message, type = 'info') {
  let host = $('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  host.append(el);
  setTimeout(() => el.remove(), 3800);
}

/* ---------- Product pieces ---------- */

/** Ten-cell battery gauge for state of health (pre-owned cars). */
export function batteryGauge(health) {
  if (health === undefined || health === null) return '';
  const cells = Math.round(health / 10);
  const cls = health >= 90 ? '' : 'mid';
  return `<span class="battery ${cls}" title="Battery health ${health}% of original capacity">
    <span class="battery-cells" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < cells ? 'on' : ''}"></i>`).join('')}</span>
    <span>${health}%</span><span class="sr-only">battery health</span>
  </span>`;
}

export function conditionTag(p) {
  if (p.status === 'reserved') return '<span class="tag tag-reserved">Reserved</span>';
  if (p.status === 'sold') return '<span class="tag tag-sold">Sold</span>';
  if (p.condition === 'new' && p.category === 'vehicle') return '<span class="tag tag-new">New</span>';
  if (p.condition === 'pre-order') return '<span class="tag tag-new">Pre-order</span>';
  if (p.condition === 'pre-owned') return '<span class="tag">Pre-owned</span>';
  return '';
}

/** Three-cell "window sticker" for cards. */
function stickerFor(p) {
  if (p.category !== 'vehicle') {
    const fits = (p.compatibleWith || []).length >= 5 ? 'All models' : (p.compatibleWith || []).join(', ');
    return `<dl class="sticker" style="grid-template-columns: minmax(0,2fr) minmax(0,1fr)">
      <div><dt>Fits</dt><dd style="white-space:normal">${esc(fits)}</dd></div>
      <div><dt>In stock</dt><dd>${p.stock}</dd></div>
    </dl>`;
  }
  const s = p.specs || {};
  const third =
    p.condition === 'pre-owned'
      ? `<div><dt>Odometer</dt><dd>${formatNumber(s.odometerKm)}<small> km</small></dd></div>`
      : `<div><dt>Top speed</dt><dd>${s.topSpeedKph}<small> km/h</small></dd></div>`;
  return `<dl class="sticker">
    <div><dt>Range</dt><dd>${formatNumber(s.rangeKm)}<small> km</small></dd></div>
    <div><dt>0–100</dt><dd>${Number(s.zeroTo100).toFixed(1)}<small> s</small></dd></div>
    ${third}
  </dl>`;
}

export function productCard(p) {
  const meta =
    p.category === 'vehicle'
      ? `${esc(p.color)} · <span class="mono">${esc(p.stockNumber)}</span>`
      : 'Accessory';
  const health = p.condition === 'pre-owned' ? batteryGauge(p.specs?.batteryHealth) : '';
  return `<a class="card" href="product.html?slug=${encodeURIComponent(p.slug)}">
    <div class="card-media">
      <img src="${esc(p.image)}" alt="${esc(p.name)}${p.color ? `, ${esc(p.color)}` : ''}" loading="lazy" width="400" height="300">
      <div class="card-tags">${conditionTag(p)}</div>
    </div>
    <div class="card-body">
      <div class="card-title">
        <span class="label">${meta}</span>
        <h3>${esc(p.name)}</h3>
      </div>
      ${stickerFor(p)}
      <div class="card-price">
        <span class="price">${formatPrice(p.price)}</span>
        ${health}
      </div>
    </div>
  </a>`;
}

export const skeletonCards = (n = 6) => Array.from({ length: n }, () => '<div class="skeleton skeleton-card"></div>').join('');

export function errorState(message, retryLabel = 'Try again') {
  return `<div class="empty"><h3>Could not load this</h3><p class="muted">${esc(message)}</p>
    <button class="btn btn-ghost" type="button" onclick="location.reload()">${retryLabel}</button></div>`;
}

/* ---------- Form helpers ---------- */

/** Show server-side field errors next to inputs (matching by name). */
export function showFieldErrors(form, details = {}) {
  $$('.field-error', form).forEach((el) => (el.textContent = ''));
  $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  Object.entries(details).forEach(([name, msg]) => {
    const input = form.elements[name.split('.').pop()];
    if (!input) return;
    input.setAttribute('aria-invalid', 'true');
    const slot = input.closest('.field')?.querySelector('.field-error');
    if (slot) slot.textContent = msg;
  });
}

export function setBusy(button, busy, busyLabel) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

/* ---------- Page bootstrap ---------- */
export function initPage(active) {
  renderHeader(active);
  renderFooter();
}

export function logout() {
  clearSession();
  toast('You are logged out.');
  setTimeout(() => (location.href = 'index.html'), 400);
}
