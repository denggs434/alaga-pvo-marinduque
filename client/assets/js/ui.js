/**
 * Shared UI: footer, product cards, toasts, form helpers and page bootstrap.
 * The header lives in nav.js, animation in motion.js.
 * Every page imports this module and calls initPage().
 */
import { clearSession } from './store.js';
import { formatPrice, formatNumber, esc, $, $$ } from './format.js';
import { ICONS, BRAND_MARK } from './icons.js';
import { renderHeader, renderAdminHeader, updateCartBadge, openCartDrawer } from './nav.js';
import { initMotion } from './motion.js';

// Re-export helpers so page scripts can keep importing everything from ui.js.
export { formatPrice, formatNumber, formatDate, formatPriceShort, esc, $, $$ } from './format.js';
export { ICONS } from './icons.js';
export { updateCartBadge, openCartDrawer };

// Apply a saved theme as early as possible to avoid a flash of the wrong theme.
try {
  const saved = localStorage.getItem('voltyard.theme');
  if (saved) document.documentElement.dataset.theme = saved;
} catch { /* ignore */ }

/* ---------- Footer ---------- */
function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="wrap footer-grid">
      <div class="stack">
        <a class="brand" href="index.html">${BRAND_MARK}<span class="brand-word">Voltyard<small>Motors</small></span></a>
        <p class="muted">Independent Tesla dealer in Mogpog, Marinduque. New imports and certified pre-owned, every battery tested before sale.</p>
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
          <li>Balanacan Port Road, Brgy. Balanacan</li>
          <li>Mogpog, Marinduque 4901</li>
          <li class="mono">+63 42 332 0142</li>
          <li>Tue–Sat 10:00–19:00</li>
          <li>Sun 11:00–17:00 · Mon closed</li>
        </ul>
      </div>
    </div>
    <div class="wrap footer-base">
      <span>© ${new Date().getFullYear()} Voltyard Motors. A student project; not affiliated with Tesla, Inc.</span>
      <span>Tesla, Model 3, Model Y, Model S, Model X, Cybertruck and Roadster are trademarks of Tesla, Inc.</span>
    </div>`;
  document.body.append(footer);
}

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
    <span class="battery-cells" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < cells ? 'on' : ''}" style="--i:${i}"></i>`).join('')}</span>
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
      : `<div><dt title="Top speed">Top</dt><dd>${s.topSpeedKph}<small> km/h</small></dd></div>`;
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
  const main = document.querySelector("main");
  if (main && !main.id) main.id = "main";
  document.body.insertAdjacentHTML("afterbegin", '<a class="skip-link" href="#main">Skip to content</a>');
  renderHeader(active);
  // keep the skip link first in tab order
  document.body.prepend(document.querySelector(".skip-link"));
  renderFooter();
  initMotion();
}

/** Admin panel pages: compact admin header, no shop navigation or footer. */
export function initAdminPage({ header = true } = {}) {
  const main = document.querySelector('main');
  if (main && !main.id) main.id = 'main';
  document.body.classList.add('admin-body');
  if (header) renderAdminHeader();
  initMotion();
}

export function logout() {
  clearSession();
  toast('You are logged out.');
  setTimeout(() => (location.href = 'index.html'), 400);
}
