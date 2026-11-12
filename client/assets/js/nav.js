/**
 * Site header: brand, main links, "Report" button, theme toggle, account menu,
 * and the slide-in menu used on phones and tablets.
 */
import { getUser, isAdmin, isOwner, clearSession } from './store.js';
import { api } from './api.js';
import { SITE } from './config.js';
import { esc, initials, $, $$ } from './format.js';
import { ICONS, BRAND_MARK } from './icons.js';

const LINKS = [
  { key: 'wall', href: 'index.html', label: 'Community wall', icon: 'home' },
  { key: 'pets', href: 'pets.html', label: 'Pets', icon: 'paw' },
  { key: 'announcements', href: 'announcements.html', label: 'Announcements', icon: 'megaphone' },
  { key: 'services', href: 'services.html', label: 'Services', icon: 'stethoscope' },
  { key: 'about', href: 'about.html', label: 'About', icon: 'info' },
  { key: 'contact', href: 'contact.html', label: 'Contact', icon: 'mail' },
];

function accountHtml() {
  const user = getUser();
  if (!user) return `<a class="btn btn-ghost btn-sm" href="account.html">${ICONS.user}<span>Log in</span></a>`;
  return `
    <div class="account">
      <button class="avatar-btn" type="button" id="account-btn" aria-expanded="false" aria-controls="account-menu" aria-label="Account menu for ${esc(user.name)}">
        <span class="avatar">${esc(initials(user.name))}</span>
        <span class="dot avatar-dot" data-unread hidden></span>
      </button>
      <div class="popover" id="account-menu" hidden>
        <div class="popover-head"><strong>${esc(user.name)}</strong><span>${esc(user.email)}</span></div>
        ${isAdmin()
          ? `<a href="admin.html">${ICONS.shield}PVO admin console</a>`
          : `<a href="account.html#pets">${ICONS.user}Profile<small class="popover-hint">My pets and reports</small></a>
             <a href="account.html#messages">${ICONS.inbox}Messages<span class="dot" data-unread hidden><span class="sr-only">new reply</span></span></a>
             <a href="account.html#settings">${ICONS.gear}Settings</a>
             <button type="button" data-open-alagai>${ICONS.sparkle}Ask Alagai</button>`}
        <hr class="popover-sep">
        <button type="button" data-logout class="popover-logout">${ICONS.logout}Log out</button>
      </div>
    </div>`;
}

function headerHtml(active) {
  const link = (l) => `<a class="nav-link" href="${l.href}" ${l.key === active ? 'aria-current="page"' : ''}>${l.label}</a>`;
  return `
  ${isAdmin() ? `<div class="staffbar"><div class="wrap"><span><b>PVO staff view.</b> You can moderate posts and see private records here.</span><a href="admin.html">Open admin console →</a></div></div>` : ''}
  <header class="site-header" id="site-header">
    <div class="wrap nav">
      <a class="brand" href="index.html" aria-label="${SITE.name} home">${BRAND_MARK}<span class="brand-word">${SITE.name}<small>PVO ${SITE.province}</small></span></a>
      <nav aria-label="Main"><ul class="nav-links">${LINKS.map((l) => `<li>${link(l)}</li>`).join('')}</ul></nav>
      <div class="nav-tools">
        ${isAdmin() ? '' : `<a class="btn btn-primary btn-sm nav-report" href="report.html" ${active === 'report' ? 'aria-current="page"' : ''}>${ICONS.flag}Report</a>`}
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="Switch colour theme">${ICONS.moon}</button>
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
      ${LINKS.map((l) => `<a href="${l.href}" ${l.key === active ? 'aria-current="page"' : ''}>${ICONS[l.icon]}${l.label}</a>`).join('')}
      <hr>
      ${isAdmin()
        ? `<a href="admin.html">${ICONS.shield}PVO admin console</a>`
        : `<a href="report.html">${ICONS.flag}Report an incident</a>
           <a href="pet-form.html">${ICONS.plus}Register a pet</a>
           ${getUser() ? '' : `<a href="account.html">${ICONS.user}Log in or sign up</a>`}
           ${getUser() ? `<a href="account.html#pets">${ICONS.user}Profile</a>
           <a href="account.html#messages">${ICONS.inbox}Messages<span class="dot" data-unread hidden><span class="sr-only">new reply</span></span></a>
           <a href="account.html#settings">${ICONS.gear}Settings</a>
           <a href="#alagai" data-open-alagai>${ICONS.sparkle}Ask Alagai</a>` : ''}`}
    </nav>
  </dialog>`;
}

/* ---------- Behaviour ---------- */
export function setupThemeToggle(btn = $('#theme-toggle')) {
  if (!btn) return;
  const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => document.documentElement.dataset.theme || (prefersDark() ? 'dark' : 'light');
  const paint = () => {
    const dark = current() === 'dark';
    btn.innerHTML = dark ? ICONS.sun : ICONS.moon;
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('alaga.theme', next); } catch { /* ignore */ }
    paint();
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
    if (open) menu.querySelector('a, button')?.focus();
  });
  document.addEventListener('click', (e) => !menu.contains(e.target) && close());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); }
  });
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

/** Show a dot on the account menu when the PVO replied to one of the owner's messages. */
export async function refreshUnread() {
  if (!isOwner()) return;
  try {
    const { count } = await api('/contact/mine/unread');
    $$('[data-unread]').forEach((d) => (d.hidden = !count));
    const btn = $('#account-btn');
    if (btn) btn.setAttribute('aria-label', `Account menu for ${getUser()?.name || ''}${count ? `, ${count} new ${count === 1 ? 'reply' : 'replies'}` : ''}`);
  } catch { /* the dot is a nicety */ }
}

export function renderHeader(active) {
  document.body.insertAdjacentHTML('afterbegin', headerHtml(active));
  setupThemeToggle();
  setupAccountMenu();
  setupMobileMenu();
  $$('[data-logout]').forEach((b) => b.addEventListener('click', () => logout()));
  refreshUnread();
}
