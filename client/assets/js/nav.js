/**
 * Site navigation
 * ---------------
 *  - Showroom bar: live open/closed status in Manila time
 *  - Sticky header that hides on scroll down and returns on scroll up
 *  - Inventory mega menu with live counts and "from" prices per model
 *  - Quick search palette (⌘K / Ctrl+K or "/") over the live inventory
 *  - Account menu, slide-out cart drawer, full-screen mobile menu
 *
 * Everything is keyboard accessible: Esc closes, focus returns to the trigger,
 * and the drawers/palette use <dialog> so focus is trapped while open.
 */
import { api, qs } from './api.js';
import { getUser, isAdmin, cartCount, getCart, cartTotals, removeFromCart, setQty, clearSession } from './store.js';
import { formatPrice, formatPriceShort, esc, $, $$ } from './format.js';
import { ICONS, BRAND_MARK } from './icons.js';

const PHONE = '+63 42 332 0142';
const MODELS = [
  { name: 'Model 3', img: 'assets/img/cars/model3-highland-lr.jpg', blurb: 'Sedan' },
  { name: 'Model Y', img: 'assets/img/cars/modely-juniper.jpg', blurb: 'Crossover' },
  { name: 'Model S', img: 'assets/img/cars/models-plaid.jpg', blurb: 'Flagship sedan' },
  { name: 'Model X', img: 'assets/img/cars/modelx-black.jpg', blurb: '7-seat SUV' },
  { name: 'Cybertruck', img: 'assets/img/cars/cybertruck-foundation.jpg', blurb: 'Pickup' },
  { name: 'Roadster', img: 'assets/img/cars/roadster-2gen.jpg', blurb: 'Sports car' },
];
const modelHref = (m) => `products.html?model=${encodeURIComponent(m)}`;

/* =========================================================================
   Showroom hours (Asia/Manila)
   ========================================================================= */
const HOURS = { Sun: [11, 17], Mon: null, Tue: [10, 19], Wed: [10, 19], Thu: [10, 19], Fri: [10, 19], Sat: [10, 19] };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hh = (h) => `${String(h).padStart(2, '0')}:00`;

export function showroomStatus(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const day = parts.weekday;
  const time = Number(parts.hour) + Number(parts.minute) / 60;
  const today = HOURS[day];

  if (today && time >= today[0] && time < today[1]) {
    return { open: true, text: `Open now · until ${hh(today[1])}` };
  }
  if (today && time < today[0]) return { open: false, text: `Closed · opens today ${hh(today[0])}` };

  // Find the next day with opening hours.
  const idx = DAYS.indexOf(day);
  for (let i = 1; i <= 7; i++) {
    const d = DAYS[(idx + i) % 7];
    if (HOURS[d]) return { open: false, text: `Closed · opens ${i === 1 ? 'tomorrow' : d} ${hh(HOURS[d][0])}` };
  }
  return { open: false, text: 'Closed' };
}

/* =========================================================================
   Inventory summary (shared by mega menu, mobile menu and palette)
   ========================================================================= */
let summaryPromise;
function inventorySummary() {
  summaryPromise ||= api(`/products${qs({ category: 'vehicle', limit: 100 })}`, { auth: false }).then(({ items }) => {
    const byModel = {};
    for (const p of items) {
      const m = (byModel[p.model] ||= { count: 0, from: Infinity });
      m.count += 1;
      m.from = Math.min(m.from, p.price);
    }
    const count = (c) => items.filter((p) => p.condition === c).length;
    return {
      byModel,
      total: items.length,
      conditions: { new: count('new'), 'pre-owned': count('pre-owned'), 'pre-order': count('pre-order') },
      preorder: items.find((p) => p.condition === 'pre-order'),
    };
  });
  return summaryPromise;
}

/* =========================================================================
   Markup
   ========================================================================= */
const LINKS = [
  { key: 'accessories', href: 'products.html?category=accessory', label: 'Charging & Parts' },
  { key: 'preorder', href: 'products.html?condition=pre-order', label: 'Roadster', pill: 'Pre-order' },
  { key: 'about', href: 'about.html', label: 'About' },
  { key: 'contact', href: 'contact.html', label: 'Contact' },
];

function megaHtml() {
  return `
  <div class="mega" id="mega-inventory" hidden>
    <div class="wrap mega-grid">
      <section class="mega-models" aria-labelledby="mega-models-title">
        <p class="nav-eyebrow" id="mega-models-title">Shop by model</p>
        <ul class="mega-model-list">
          ${MODELS.map((m) => `<li>
            <a href="${modelHref(m.name)}" class="mega-model">
              <span class="mega-model-img"><img src="${m.img}" alt="" loading="lazy" width="160" height="100"></span>
              <span class="mega-model-text">
                <span class="mega-model-name">${m.name}</span>
                <span class="mega-model-meta" data-model-meta="${m.name}">${m.blurb}</span>
              </span>
            </a></li>`).join('')}
        </ul>
      </section>

      <section class="mega-browse" aria-label="Browse">
        <p class="nav-eyebrow">Browse</p>
        <ul class="mega-links">
          <li><a href="products.html?condition=new">New vehicles <span class="mega-count" data-cond="new"></span></a></li>
          <li><a href="products.html?condition=pre-owned">Certified pre-owned <span class="mega-count" data-cond="pre-owned"></span></a></li>
          <li><a href="products.html?condition=pre-order">Pre-order <span class="mega-count" data-cond="pre-order"></span></a></li>
          <li><a href="products.html?sort=range-desc">Longest range first</a></li>
          <li><a href="products.html?maxPrice=2500000">Under ₱2.5M</a></li>
        </ul>
        <p class="nav-eyebrow">Before you buy</p>
        <ul class="mega-links">
          <li><a href="contact.html?topic=test-drive">Book a test drive</a></li>
          <li><a href="contact.html?topic=trade-in">Get a trade-in offer</a></li>
          <li><a href="contact.html?topic=financing">Ask about financing</a></li>
        </ul>
        <a class="mega-all" href="products.html">View all inventory <span data-total></span> ${ICONS.arrow}</a>
      </section>

      <a class="mega-promo" href="products.html?condition=pre-order" data-preorder-link>
        <img src="assets/img/cars/roadster-2gen.jpg" alt="" loading="lazy" width="480" height="320">
        <span class="mega-promo-body">
          <span class="nav-eyebrow">Pre-order · not yet in production</span>
          <strong>The Tesla that might fly</strong>
          <span>Roadster with SpaceX Package. ₱500k refundable deposit.</span>
        </span>
      </a>
    </div>
  </div>`;
}

function accountHtml() {
  const user = getUser();
  if (!user) {
    return `<a class="nav-login" href="account.html">${ICONS.user}<span>Log in</span></a>`;
  }
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return `
    <div class="account">
      <button class="avatar-btn" type="button" id="account-btn" aria-expanded="false" aria-controls="account-menu" aria-label="Account menu for ${esc(user.name)}">
        <span class="avatar">${esc(initials)}</span>
      </button>
      <div class="popover" id="account-menu" hidden>
        <div class="popover-head"><strong>${esc(user.name)}</strong><span>${esc(user.email)}</span></div>
        <a href="account.html">${ICONS.orders}My orders</a>
        ${isAdmin() ? `<a href="admin.html">${ICONS.shield}Admin panel</a>` : ''}
        <button type="button" data-logout>${ICONS.logout}Log out</button>
      </div>
    </div>`;
}

function headerHtml(active) {
  const status = showroomStatus();
  const inventoryActive = active === 'inventory';
  return `
  ${isAdmin() ? `<div class="staffbar">
    <div class="wrap staffbar-inner">
      <span><b>Staff preview</b><span class="staffbar-note">Ordering is turned off for staff accounts</span></span>
      <a href="admin.html">Back to lot console ${ICONS.arrow}</a>
    </div>
  </div>` : ''}
  <div class="topbar">
    <div class="wrap topbar-inner">
      <span class="open-status ${status.open ? 'is-open' : ''}" data-status><i aria-hidden="true"></i><span>${status.text}</span></span>
      <span class="topbar-meta">
        <span class="topbar-item">${ICONS.pin}Mogpog, Marinduque</span>
        <span class="topbar-item mono">${ICONS.phone}${PHONE}</span>
        <a class="topbar-cta" href="contact.html?topic=test-drive">Book a test drive</a>
      </span>
    </div>
  </div>
  <header class="site-header" id="site-header">
    <div class="wrap nav">
      <a class="brand" href="index.html" aria-label="Voltyard Motors home">${BRAND_MARK}<span class="brand-word">Voltyard<small>Motors</small></span></a>

      <nav class="primary" aria-label="Main">
        <ul class="primary-list">
          <li class="has-mega">
            <button class="nav-link ${inventoryActive ? 'is-active' : ''}" type="button" id="mega-btn"
              aria-expanded="false" aria-controls="mega-inventory" ${inventoryActive ? 'aria-current="page"' : ''}>
              Inventory ${ICONS.chevron}
            </button>
          </li>
          ${LINKS.map((l) => `<li><a class="nav-link ${l.key === active ? 'is-active' : ''}" href="${l.href}" ${l.key === active ? 'aria-current="page"' : ''}>
            ${l.label}${l.pill ? `<span class="nav-pill">${l.pill}</span>` : ''}</a></li>`).join('')}
        </ul>
      </nav>

      <div class="nav-tools">
        <button class="search-trigger" type="button" id="search-btn" aria-label="Search inventory" aria-keyshortcuts="Meta+K Control+K">
          ${ICONS.search}<span class="search-trigger-text">Search cars & parts</span><kbd>⌘K</kbd>
        </button>
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="Switch colour theme">${ICONS.moon}</button>
        ${accountHtml()}
        ${isAdmin() ? '' : `<button class="icon-btn cart-btn" type="button" id="cart-btn" aria-label="Open cart">
          ${ICONS.cart}<span class="cart-count" id="cart-count" hidden></span>
        </button>`}
        <button class="icon-btn menu-toggle" id="menu-btn" type="button" aria-label="Open menu" aria-controls="mobile-nav">${ICONS.menu}</button>
      </div>
    </div>
    ${megaHtml()}
  </header>

  <!-- Quick search -->
  <dialog class="palette" id="palette" aria-label="Search inventory">
    <form class="palette-form" role="search" id="palette-form">
      ${ICONS.search}
      <input id="palette-input" type="search" placeholder="Search model, trim, colour or stock no." autocomplete="off"
        role="combobox" aria-expanded="true" aria-controls="palette-results" aria-autocomplete="list">
      <button class="palette-esc" type="button" data-close>Esc</button>
    </form>
    <div class="palette-body">
      <ul class="palette-results" id="palette-results" role="listbox" aria-label="Results"></ul>
    </div>
    <div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></div>
  </dialog>

  <!-- Cart drawer -->
  <dialog class="drawer" id="cart-drawer" aria-labelledby="cart-drawer-title">
    <div class="drawer-head"><h2 id="cart-drawer-title">Your cart</h2><button class="icon-btn" type="button" data-close aria-label="Close cart">${ICONS.close}</button></div>
    <div class="drawer-body" id="cart-drawer-body"></div>
    <div class="drawer-foot" id="cart-drawer-foot"></div>
  </dialog>

  <!-- Mobile menu -->
  <dialog class="drawer drawer-menu" id="mobile-nav" aria-label="Menu">
    <div class="drawer-head">
      <a class="brand" href="index.html">${BRAND_MARK}<span class="brand-word">Voltyard<small>Motors</small></span></a>
      <button class="icon-btn" type="button" data-close aria-label="Close menu">${ICONS.close}</button>
    </div>
    <div class="drawer-body mobile-body">
      <button class="mobile-search" type="button" data-open-search>${ICONS.search}Search cars & parts</button>
      <ul class="mobile-links">
        <li><a href="index.html" ${active === 'home' ? 'aria-current="page"' : ''}>Home</a></li>
        <li><a href="products.html" ${active === 'inventory' ? 'aria-current="page"' : ''}>All inventory <span data-total></span></a></li>
        ${LINKS.map((l) => `<li><a href="${l.href}" ${l.key === active ? 'aria-current="page"' : ''}>${l.label}${l.pill ? `<span class="nav-pill">${l.pill}</span>` : ''}</a></li>`).join('')}
        ${isAdmin()
          ? '<li><a href="admin.html">Admin panel</a></li>'
          : `<li><a href="account.html">${getUser() ? 'My account & orders' : 'Log in or create account'}</a></li>`}
      </ul>
      <p class="nav-eyebrow">Shop by model</p>
      <ul class="mobile-models">
        ${MODELS.map((m) => `<li><a href="${modelHref(m.name)}"><img src="${m.img}" alt="" loading="lazy" width="120" height="80"><span>${m.name}</span><small data-model-meta="${m.name}">${m.blurb}</small></a></li>`).join('')}
      </ul>
      <div class="mobile-showroom">
        <span class="open-status ${status.open ? 'is-open' : ''}" data-status><i aria-hidden="true"></i><span>${status.text}</span></span>
        <span>Balanacan Port Road, Mogpog, Marinduque 4901</span>
        <span class="mono">${PHONE}</span>
        <a class="btn btn-accent btn-block" href="contact.html?topic=test-drive">Book a test drive</a>
      </div>
    </div>
  </dialog>`;
}

/* =========================================================================
   Behaviour
   ========================================================================= */
function fillSummary() {
  inventorySummary()
    .then((s) => {
      $$('[data-model-meta]').forEach((el) => {
        const m = s.byModel[el.dataset.modelMeta];
        el.textContent = m ? `${m.count} ${m.count === 1 ? 'listing' : 'listings'} · from ${formatPriceShort(m.from)}` : 'Ask us to source one';
      });
      $$('[data-cond]').forEach((el) => (el.textContent = s.conditions[el.dataset.cond] ?? ''));
      $$('[data-total]').forEach((el) => (el.textContent = `(${s.total})`));
      if (s.preorder) {
        $$('[data-preorder-link]').forEach((a) => (a.href = `product.html?slug=${encodeURIComponent(s.preorder.slug)}`));
      }
    })
    .catch(() => {}); // menus still work as plain links without the numbers
}

/* ---------- Mega menu ---------- */
function setupMega() {
  const btn = $('#mega-btn');
  const panel = $('#mega-inventory');
  const li = btn.closest('.has-mega');
  let timer;

  const open = () => {
    clearTimeout(timer);
    if (!panel.hidden) return;
    fillSummary();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => panel.classList.add('is-open'));
    document.body.classList.add('mega-open');
  };
  const close = (returnFocus = false) => {
    clearTimeout(timer);
    if (panel.hidden) return;
    panel.classList.remove('is-open');
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('mega-open');
    if (returnFocus) btn.focus();
  };

  btn.addEventListener('click', () => (panel.hidden ? open() : close()));

  // Hover intent for mouse users only.
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  [li, panel].forEach((el) => {
    el.addEventListener('mouseenter', () => { if (fine.matches) { clearTimeout(timer); timer = setTimeout(open, 90); } });
    el.addEventListener('mouseleave', () => { if (fine.matches) { clearTimeout(timer); timer = setTimeout(close, 180); } });
  });

  document.addEventListener('keydown', (e) => e.key === 'Escape' && !panel.hidden && close(true));
  document.addEventListener('click', (e) => !panel.hidden && !li.contains(e.target) && !panel.contains(e.target) && close());
  panel.addEventListener('focusout', (e) => !panel.contains(e.relatedTarget) && e.relatedTarget !== btn && close());

  // Warm the numbers once the page is idle so the menu opens complete.
  if ('requestIdleCallback' in window) requestIdleCallback(fillSummary, { timeout: 2500 });
  else setTimeout(fillSummary, 1200);
  return close;
}

/* ---------- Account popover ---------- */
function setupAccount() {
  const btn = $('#account-btn');
  if (!btn) return;
  const menu = $('#account-menu');
  const toggle = (show) => {
    menu.hidden = !show;
    btn.setAttribute('aria-expanded', String(show));
    if (show) menu.querySelector('a,button')?.focus();
  };
  btn.addEventListener('click', () => toggle(menu.hidden));
  document.addEventListener('click', (e) => !menu.hidden && !btn.parentElement.contains(e.target) && toggle(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { toggle(false); btn.focus(); }
  });
}

/* ---------- Dialog helpers (palette, drawers) ---------- */
function setupDialog(dialog) {
  $$('[data-close]', dialog).forEach((b) => b.addEventListener('click', () => closeDialog(dialog)));
  // Click on the backdrop closes.
  dialog.addEventListener('click', (e) => e.target === dialog && closeDialog(dialog));
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(dialog); });
}
function openDialog(dialog) {
  if (dialog.open) return;
  dialog.showModal();
  document.documentElement.classList.add('no-scroll');
  requestAnimationFrame(() => dialog.classList.add('is-open'));
}
function closeDialog(dialog) {
  if (!dialog.open) return;
  dialog.classList.remove('is-open');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => {
    dialog.close();
    if (!$$('dialog[open]').length) document.documentElement.classList.remove('no-scroll');
  }, reduce ? 0 : 200);
}

/* ---------- Quick search palette ---------- */
const SUGGESTIONS = [
  { label: 'Model Y', href: modelHref('Model Y') },
  { label: 'Plaid', q: 'plaid' },
  { label: 'Cybertruck', href: modelHref('Cybertruck') },
  { label: 'Wall Connector', q: 'wall connector' },
  { label: 'Under ₱2.5M', href: 'products.html?maxPrice=2500000' },
  { label: 'The flying Roadster', href: 'products.html?condition=pre-order' },
];

function setupPalette() {
  const dialog = $('#palette');
  const input = $('#palette-input');
  const list = $('#palette-results');
  let active = -1;
  let reqId = 0;
  let timer;

  setupDialog(dialog);

  const options = () => $$('[role=option]', list);
  const highlight = (i) => {
    const opts = options();
    if (!opts.length) return;
    active = (i + opts.length) % opts.length;
    opts.forEach((o, n) => o.setAttribute('aria-selected', String(n === active)));
    input.setAttribute('aria-activedescendant', opts[active].id);
    opts[active].scrollIntoView({ block: 'nearest' });
  };

  const renderSuggestions = () => {
    active = -1;
    list.innerHTML = `<li class="palette-section" role="presentation">Popular searches</li>
      <li role="presentation" class="palette-chips">${SUGGESTIONS.map((s) =>
        s.href ? `<a class="chip" href="${s.href}">${s.label}</a>` : `<button class="chip" type="button" data-q="${esc(s.q)}">${s.label}</button>`
      ).join('')}</li>`;
  };

  const search = async (term) => {
    const id = ++reqId;
    list.innerHTML = '<li class="palette-section" role="presentation">Searching…</li>';
    try {
      const { items, total } = await api(`/products${qs({ q: term, limit: 7 })}`, { auth: false });
      if (id !== reqId) return;
      active = -1;
      if (!items.length) {
        list.innerHTML = `<li class="palette-empty" role="presentation">No cars or parts match “${esc(term)}”. Try a model name like “Model 3” or a colour.</li>`;
        return;
      }
      list.innerHTML = `<li class="palette-section" role="presentation">${total} result${total === 1 ? '' : 's'}</li>
        ${items.map((p, i) => `<li role="option" id="pal-opt-${i}" aria-selected="false">
          <a href="product.html?slug=${encodeURIComponent(p.slug)}" tabindex="-1">
            <img src="${esc(p.image)}" alt="" width="64" height="48">
            <span class="pal-text"><strong>${esc(p.name)}</strong>
              <small>${p.category === 'vehicle' ? `${esc(p.color)} · <span class="mono">${esc(p.stockNumber)}</span>` : 'Charging & parts'}</small></span>
            <span class="pal-price">${formatPrice(p.price)}</span>
          </a></li>`).join('')}
        ${total > items.length ? `<li role="option" id="pal-opt-all" aria-selected="false"><a class="pal-all" href="products.html${qs({ q: term, category: items[0].category })}" tabindex="-1">See all ${total} results ${ICONS.arrow}</a></li>` : ''}`;
      highlight(0);
    } catch (err) {
      list.innerHTML = `<li class="palette-empty" role="presentation">${esc(err.message)}</li>`;
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const term = input.value.trim();
    if (!term) return renderSuggestions();
    timer = setTimeout(() => search(term), 180);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
  });
  $('#palette-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const target = options()[active]?.querySelector('a');
    if (target) location.href = target.href;
    else if (input.value.trim()) location.href = `products.html${qs({ q: input.value.trim() })}`;
  });
  list.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]')?.dataset.q;
    if (q) { input.value = q; input.dispatchEvent(new Event('input')); input.focus(); }
  });

  const openPalette = () => {
    closeDialog($('#mobile-nav'));
    input.value = '';
    renderSuggestions();
    openDialog(dialog);
    input.focus();
  };
  $('#search-btn').addEventListener('click', openPalette);
  $$('[data-open-search]').forEach((b) => b.addEventListener('click', openPalette));
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      dialog.open ? closeDialog(dialog) : openPalette();
    }
  });
  // Show the right shortcut for the platform.
  if (!/Mac|iPhone|iPad/.test(navigator.platform)) $('#search-btn kbd').textContent = 'Ctrl K';
}

/* ---------- Cart drawer ---------- */
function renderCartDrawer() {
  const cart = getCart();
  const body = $('#cart-drawer-body');
  const foot = $('#cart-drawer-foot');
  if (!cart.length) {
    body.innerHTML = `<div class="drawer-empty">${ICONS.cart}<p><strong>Your cart is empty.</strong></p>
      <p class="muted">Reserve a car or add chargers and parts.</p>
      <a class="btn btn-accent" href="products.html">Browse inventory</a></div>`;
    foot.innerHTML = '';
    return;
  }
  body.innerHTML = `<ul class="mini-lines">${cart.map((l) => `
    <li class="mini-line">
      <a href="product.html?slug=${encodeURIComponent(l.slug)}"><img src="${esc(l.image)}" alt="" width="96" height="72"></a>
      <div class="mini-info">
        <a href="product.html?slug=${encodeURIComponent(l.slug)}" class="mini-name">${esc(l.name)}</a>
        <span class="muted">${l.category === 'vehicle'
          ? `${l.condition === 'pre-order' ? 'Pre-order deposit' : 'Deposit'} ${formatPrice(l.deposit)}`
          : `<span class="mini-qty"><button type="button" data-mini-dec="${l.id}" aria-label="Fewer">−</button><span>${l.qty}</span><button type="button" data-mini-inc="${l.id}" aria-label="More">+</button></span>`}</span>
        <button type="button" class="mini-remove" data-mini-remove="${l.id}">Remove</button>
      </div>
      <span class="mini-price">${formatPrice(l.price * l.qty)}</span>
    </li>`).join('')}</ul>`;
  const t = cartTotals(cart);
  foot.innerHTML = `
    <div class="summary-row"><span class="muted">Full price</span><span class="mono">${formatPrice(t.subtotal)}</span></div>
    <div class="summary-row total"><span>Due now</span><span class="mono">${formatPrice(t.dueNow)}</span></div>
    <a class="btn btn-accent btn-block" href="cart.html">Checkout</a>
    <button class="btn btn-ghost btn-block" type="button" data-close>Keep browsing</button>`;
  $('[data-close]', foot).addEventListener('click', () => closeDialog($('#cart-drawer')));
}

export function openCartDrawer() {
  const dialog = $('#cart-drawer');
  if (!dialog) return (location.href = 'cart.html');
  renderCartDrawer();
  openDialog(dialog);
}

function setupCartDrawer() {
  const dialog = $('#cart-drawer');
  setupDialog(dialog);
  $('#cart-btn')?.addEventListener('click', () => {
    // On the cart page itself the drawer would duplicate the page.
    if (location.pathname.endsWith('cart.html')) return window.scrollTo({ top: 0, behavior: 'smooth' });
    openCartDrawer();
  });
  dialog.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const line = getCart().find((l) => l.id === (t.dataset.miniInc || t.dataset.miniDec));
    if (t.dataset.miniRemove) removeFromCart(t.dataset.miniRemove);
    if (t.dataset.miniInc) setQty(line.id, line.qty + 1);
    if (t.dataset.miniDec) setQty(line.id, line.qty - 1);
    if (t.dataset.miniRemove || t.dataset.miniInc || t.dataset.miniDec) renderCartDrawer();
  });
}

export function updateCartBadge(bump = false) {
  const el = $('#cart-count');
  if (!el) return;
  const n = cartCount();
  el.textContent = n > 9 ? '9+' : n;
  el.hidden = n === 0;
  if (bump && n) {
    el.classList.remove('bump');
    void el.offsetWidth; // restart the animation
    el.classList.add('bump');
  }
}

/* ---------- Mobile menu ---------- */
function setupMobileMenu() {
  const dialog = $('#mobile-nav');
  setupDialog(dialog);
  $('#menu-btn').addEventListener('click', () => {
    fillSummary();
    openDialog(dialog);
  });
}

/* ---------- Theme toggle ---------- */
export function setupThemeToggle() {
  const btn = $('#theme-toggle');
  const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => document.documentElement.dataset.theme || (prefersDark() ? 'dark' : 'light');
  const paint = () => {
    const dark = current() === 'dark';
    btn.innerHTML = dark ? ICONS.sun : ICONS.moon;
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('voltyard.theme', next); } catch { /* ignore */ }
    paint();
  });
  paint();
}

/* ---------- Scroll behaviour: shadow, hide on scroll down ---------- */
function setupScroll(closeMega) {
  const header = $('#site-header');
  let lastY = window.scrollY;
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    const accountMenu = $('#account-menu');
    const busy = document.body.classList.contains('mega-open') || (accountMenu && !accountMenu.hidden);
    if (y > lastY + 4 && y > 220 && !busy) header.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 220) header.classList.remove('is-hidden');
    if (Math.abs(y - lastY) > 60) closeMega();
    lastY = y;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  // Showing the header again when keyboard focus moves into it.
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
}

/* =========================================================================
   Admin header: a compact bar for the admin panel only (no shop navigation)
   ========================================================================= */
export function renderAdminHeader() {
  const user = getUser();
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<header class="site-header admin-header" id="site-header">
      <div class="wrap nav admin-nav">
        <a class="brand" href="admin.html" aria-label="Voltyard admin home">${BRAND_MARK}<span class="brand-word">Voltyard<small>Admin</small></span></a>
        <div class="nav-tools">
          <a class="btn btn-ghost btn-sm" href="index.html" target="_blank" rel="noopener">View store ${ICONS.arrow}</a>
          <button class="icon-btn" id="theme-toggle" type="button" aria-label="Switch colour theme">${ICONS.moon}</button>
          ${user ? `<span class="admin-user"><span class="avatar" aria-hidden="true">${esc(user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase())}</span><span class="admin-user-name">${esc(user.name)}</span></span>
          <button class="btn btn-ghost btn-sm" type="button" data-logout>${ICONS.logout}Log out</button>` : ''}
        </div>
      </div>
    </header>`
  );
  setupThemeToggle();
  $$('[data-logout]').forEach((b) => b.addEventListener('click', () => { clearSession(); location.href = 'admin.html'; }));
}

/* =========================================================================
   Public entry
   ========================================================================= */
export function renderHeader(active) {
  document.body.insertAdjacentHTML('afterbegin', headerHtml(active));
  const closeMega = setupMega();
  setupAccount();
  setupPalette();
  setupCartDrawer();
  setupMobileMenu();
  setupThemeToggle();
  setupScroll(closeMega);
  updateCartBadge();

  $$('[data-logout]').forEach((b) =>
    b.addEventListener('click', () => {
      clearSession();
      location.href = 'index.html';
    })
  );
  document.addEventListener('cart:change', () => updateCartBadge(true));
  // Keep the open/closed status current if the tab stays open.
  setInterval(() => {
    const s = showroomStatus();
    $$('[data-status]').forEach((el) => {
      el.classList.toggle('is-open', s.open);
      el.lastElementChild.textContent = s.text;
    });
  }, 60000);
}
