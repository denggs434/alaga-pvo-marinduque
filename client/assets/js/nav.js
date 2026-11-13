/**
 * Site header: brand, main links, "Report" button, cart, theme toggle, account menu,
 * and the slide-in menu used on phones and tablets.
 */
import { getUser, isAdmin, isOwner, clearSession } from './store.js';
import { api } from './api.js';
import { notificationsButton, setupNotifications } from './notifications.js';
import { cart } from './cart.js';
import { SITE } from './config.js';
import { esc, initials, $, $$ } from './format.js';
import { ICONS, BRAND_MARK } from './icons.js';

/**
 * Main navigation, in two levels: a top-level item is either a page or a group
 * that opens a menu of its pages. The phone menu shows the same groups as sections.
 */
const NAV = [
  { key: 'wall', href: 'index.html', label: 'Community', icon: 'home' },
  { id: 'pets', label: 'Pets', items: [
    { key: 'pets', href: 'pets.html', label: 'Pet directory', icon: 'paw', hint: 'Registered pets in the province' },
    { key: 'pet-form', href: 'pet-form.html', label: 'Register a pet', icon: 'plus', hint: 'Get a PVO registration number', public: true },
    { key: 'report', href: 'report.html', label: 'Report an incident', icon: 'flag', hint: 'Bites, strays, lost or found pets', public: true },
  ] },
  { id: 'market', label: 'Market', items: [
    { key: 'shop', href: 'shop.html', label: 'Shop supplies', icon: 'bag', hint: 'Food, care and gear from local sellers' },
    { key: 'seller', href: 'seller.html', label: 'Seller Center', icon: 'box', hint: 'Sell pet supplies on Alaga', public: true },
  ] },
  { id: 'office', label: 'PVO Office', items: [
    { key: 'announcements', href: 'announcements.html', label: 'Announcements', icon: 'megaphone', hint: 'Drives, schedules and advisories' },
    { key: 'services', href: 'services.html', label: 'Services', icon: 'stethoscope', hint: 'Vaccination, kapon, certificates' },
    { key: 'contact', href: 'contact.html', label: 'Contact', icon: 'mail', hint: 'Office hours and hotline' },
    { key: 'about', href: 'about.html', label: 'About the office', icon: 'info', hint: 'The PVO and this site' },
  ] },
];
/** Staff don't register pets, report or sell, so those items are hidden for them. */
const itemsOf = (g) => g.items.filter((l) => !l.public || !isAdmin());

function accountHtml() {
  const user = getUser();
  if (!user) return `<a class="btn btn-ghost btn-sm" href="account.html">${ICONS.user}<span>Log in</span></a>`;
  return `
    <div class="account">
      <button class="avatar-btn" type="button" id="account-btn" aria-expanded="false" aria-controls="account-menu" aria-label="Account menu for ${esc(user.name)}">
        <span class="avatar">${esc(initials(user.name))}</span>
      </button>
      <div class="popover" id="account-menu" hidden>
        <div class="popover-head"><strong>${esc(user.name)}</strong><span>${esc(user.email)}</span></div>
        ${isAdmin()
          ? `<a href="admin.html">${ICONS.shield}PVO admin console</a>`
          : `<a href="account.html#pets">${ICONS.user}Profile<small class="popover-hint">My pets and reports</small></a>
             <a href="account.html#orders">${ICONS.bag}My orders</a>
             <a href="seller.html">${ICONS.box}Seller Center</a>
             <a href="account.html#settings">${ICONS.gear}Settings</a>
             <button type="button" data-open-alagai>${ICONS.sparkle}Ask Alagai</button>`}
        <hr class="popover-sep">
        <button type="button" data-logout class="popover-logout">${ICONS.logout}Log out</button>
      </div>
    </div>`;
}

function headerHtml(active) {
  const cur = (l) => (l.key === active ? 'aria-current="page"' : '');
  const link = (l) => `<a class="nav-link" href="${l.href}" ${cur(l)}>${l.label}</a>`;
  const group = (g) => `<button class="nav-link" type="button" data-menu="menu-${g.id}" aria-expanded="false" aria-controls="menu-${g.id}" ${itemsOf(g).some((l) => l.key === active) ? 'aria-current="true"' : ''}>${g.label}${ICONS.chevronDown}</button>
          <div class="popover more-menu" id="menu-${g.id}" hidden>${itemsOf(g).map((l) => `<a href="${l.href}" ${cur(l)}>${ICONS[l.icon]}<span><strong>${l.label}</strong><small>${l.hint}</small></span></a>`).join('')}</div>`;
  const drawerLink = (l) => `<a href="${l.href}" ${cur(l)}>${ICONS[l.icon]}${l.label}</a>`;
  return `
  ${isAdmin() ? `<div class="staffbar"><div class="wrap"><span><b>PVO staff view.</b> You can moderate posts and see private records here.</span><a href="admin.html">Open admin console</a></div></div>` : ''}
  <header class="site-header" id="site-header">
    <div class="wrap nav">
      <a class="brand" href="index.html" aria-label="${SITE.name} home">${BRAND_MARK}<span class="brand-word">${SITE.name}<small>PVO ${SITE.province}</small></span></a>
      <nav aria-label="Main"><ul class="nav-links">${NAV.map((n) => `<li${n.items ? ' class="nav-more"' : ''}>${n.items ? group(n) : link(n)}</li>`).join('')}</ul></nav>
      <div class="nav-tools">
        ${isAdmin() ? '' : `<a class="btn btn-primary btn-sm nav-report" href="report.html" ${active === 'report' ? 'aria-current="page"' : ''}>${ICONS.flag}Report</a>`}
        ${isAdmin() ? '' : `<a class="icon-btn cart-btn" id="cart-btn" href="shop.html#cart" aria-label="Cart">${ICONS.bag}<span class="cart-count" id="cart-count" hidden></span></a>`}
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="Switch colour theme">${ICONS.moon}</button>
        ${isOwner() ? `<a class="icon-btn msg-btn" href="messages.html" aria-label="Messages" ${active === 'messages' ? 'aria-current="page"' : ''}>${ICONS.chat}<span class="dot msg-btn-dot" data-unread hidden></span></a>` : ''}
        ${notificationsButton()}
        ${accountHtml()}
        <button class="icon-btn menu-toggle" id="menu-btn" type="button" aria-label="Open menu" aria-controls="mobile-nav">${ICONS.menu}</button>
      </div>
    </div>
  </header>
  <dialog class="drawer" id="mobile-nav" aria-label="Menu">
    <div class="drawer-head">
      <a class="brand" href="index.html">${BRAND_MARK}<span class="brand-word">${SITE.name}<small>PVO ${SITE.province}</small></span></a>
      <button class="icon-btn" type="button" data-close aria-label="Close menu">${ICONS.close}</button>
    </div>
    <nav class="drawer-body" aria-label="Mobile">
      ${NAV.map((n) => (n.items
        ? `<section class="drawer-group" aria-labelledby="dg-${n.id}"><h2 id="dg-${n.id}">${n.label}</h2>${itemsOf(n).map(drawerLink).join('')}</section>`
        : drawerLink(n))).join('')}
      <section class="drawer-group" aria-labelledby="dg-you"><h2 id="dg-you">${isAdmin() ? 'Staff' : 'You'}</h2>
      ${isAdmin()
        ? `<a href="admin.html">${ICONS.shield}PVO admin console</a>`
        : `${getUser() ? '' : `<a href="account.html">${ICONS.user}Log in or sign up</a>`}
           ${getUser() ? `<a href="account.html#pets">${ICONS.user}Profile</a>
           <a href="account.html#orders">${ICONS.bag}My orders</a>
           <a href="messages.html" ${active === 'messages' ? 'aria-current="page"' : ''}>${ICONS.chat}Messages<span class="dot" data-unread hidden><span class="sr-only">new reply</span></span></a>
           <a href="account.html#settings">${ICONS.gear}Settings</a>
           <a href="#alagai" data-open-alagai>${ICONS.sparkle}Ask Alagai</a>` : ''}`}
      <button type="button" class="drawer-theme" id="drawer-theme">${ICONS.moon}<span>Dark mode</span></button>
      </section>
    </nav>
  </dialog>`;
}

/* ---------- Behaviour ---------- */
export function setupThemeToggle(btn = $('#theme-toggle')) {
  if (!btn) return;
  const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const current = () => document.documentElement.dataset.theme || (prefersDark() ? 'dark' : 'light');
  // Both icons live in the button; CSS turns one into the other (rotate + fade).
  btn.classList.add('theme-toggle');
  btn.innerHTML = `<span class="theme-icon theme-sun">${ICONS.sun}</span><span class="theme-icon theme-moon">${ICONS.moon}</span>`;
  const paint = () => {
    const dark = current() === 'dark';
    btn.dataset.mode = dark ? 'dark' : 'light';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };
  const apply = (next) => {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('alaga.theme', next); } catch { /* ignore */ }
    paint();
  };
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition || reduce()) return apply(next);
    // A short, quiet crossfade between the two themes.
    document.startViewTransition(() => apply(next));
  });
  paint();
}

function setupAccountMenu() {
  const btn = $('#account-btn');
  const menu = $('#account-menu');
  if (!btn) return;
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) document.getElementById('notif-panel')?.setAttribute('hidden', '');
    if (open) menu.querySelector('a, button')?.focus();
  });
  document.addEventListener('click', (e) => !menu.contains(e.target) && close());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); }
  });
}

/** Group menus in the main nav: one open at a time, Escape or an outside click closes. */
function setupGroupMenus() {
  const btns = $$('[data-menu]');
  const pairs = btns.map((btn) => [btn, document.getElementById(btn.dataset.menu)]);
  const close = (btn, menu) => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  pairs.forEach(([btn, menu]) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      pairs.forEach((p) => close(...p));
      if (!open) return;
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      menu.querySelector('a')?.focus();
    });
  });
  document.addEventListener('click', (e) => pairs.forEach(([b, m]) => !m.contains(e.target) && close(b, m)));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openPair = pairs.find(([, m]) => !m.hidden);
    if (openPair) { close(...openPair); openPair[0].focus(); }
  });
}

/** Theme switch inside the phone menu (the header keeps its icon on wider screens). */
function setupDrawerTheme() {
  const b = $('#drawer-theme');
  if (!b) return;
  const paint = () => {
    const dark = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    b.innerHTML = `${dark ? ICONS.sun : ICONS.moon}<span>${dark ? 'Light mode' : 'Dark mode'}</span>`;
  };
  b.addEventListener('click', () => { $('#theme-toggle')?.click(); setTimeout(paint, 50); });
  paint();
}

function setupMobileMenu() {
  const dialog = $('#mobile-nav');
  $('#menu-btn').addEventListener('click', () => dialog.showModal());
  $$('[data-close]', dialog).forEach((b) => b.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
}

export function logout(to = 'index.html') {
  clearSession();
  location.href = to;
}

/** Show a dot on the Messages icon when the PVO replied to one of the owner's messages. */
export async function refreshUnread() {
  if (!isOwner()) return;
  try {
    const { count } = await api('/contact/mine/unread');
    $$('[data-unread]').forEach((d) => (d.hidden = !count));
    const msg = $('.msg-btn');
    if (msg) msg.setAttribute('aria-label', count ? `Messages, ${count} new ${count === 1 ? 'reply' : 'replies'}` : 'Messages');
  } catch { /* the dot is a nicety */ }
}

/**
 * Hover pill: slides between the main links under the pointer and fades out when
 * the pointer leaves. The current page has its own fixed highlight (CSS), so a
 * new page never shows the pill travelling from another link while it loads.
 */
function setupNavPill() {
  const list = $('.nav-links');
  if (!list) return;
  const pill = document.createElement('span');
  pill.className = 'nav-pill';
  pill.setAttribute('aria-hidden', 'true');
  list.prepend(pill);
  const links = $$('.nav-link', list);
  const moveTo = (el, instant = false) => {
    if (!el) { pill.style.opacity = '0'; return; }
    if (instant) pill.style.transition = 'none';
    const box = el.getBoundingClientRect();
    pill.style.width = `${box.width}px`;
    pill.style.transform = `translateX(${box.left - list.getBoundingClientRect().left}px)`;
    pill.style.opacity = '1';
    if (instant) { pill.offsetWidth; pill.style.transition = ''; }
  };
  links.forEach((l) => {
    l.addEventListener('mouseenter', () => moveTo(l));
    l.addEventListener('focus', () => moveTo(l));
  });
  // Leaving the links fades the pill out where it is (no slide back across the bar).
  list.addEventListener('mouseleave', () => moveTo(null));
  list.addEventListener('focusout', (e) => { if (!list.contains(e.relatedTarget)) moveTo(null); });
  // The first hover after page load appears in place instead of sliding in from the left.
  list.addEventListener('mouseenter', (e) => { if (pill.style.opacity !== '1') moveTo(e.target.closest('.nav-link') || null, true); }, true);
}

/** Item count on the header's cart button; follows every cart change. */
function setupCartButton() {
  const count = $('#cart-count');
  if (!count) return;
  const paint = () => {
    const n = cart.count();
    count.textContent = n > 99 ? '99+' : n;
    count.hidden = !n;
    $('#cart-btn').setAttribute('aria-label', n ? `Cart, ${n} item${n === 1 ? '' : 's'}` : 'Cart, empty');
  };
  document.addEventListener('cart:change', paint);
  paint();
}

export function renderHeader(active) {
  document.body.insertAdjacentHTML('afterbegin', headerHtml(active));
  setupThemeToggle();
  setupNavPill();
  setupAccountMenu();
  setupMobileMenu();
  setupGroupMenus();
  setupDrawerTheme();
  setupCartButton();
  $$('[data-logout]').forEach((b) => b.addEventListener('click', () => logout()));
  refreshUnread();
  setupNotifications();
}
