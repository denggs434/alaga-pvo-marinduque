/**
 * Wall notifications: a bell in the site header for logged-in users.
 *  - badge with the unread count, refreshed every minute while the tab is visible
 *  - panel with the latest 30: likes, comments, replies in threads you joined,
 *    and posts or comments the PVO removed
 *  - opening one marks it read and goes to the post (index.html?post=<id>)
 *  - "Mark all as read"
 */
import { api } from './api.js';
import { getUser } from './store.js';
import { esc, timeAgo, $ } from './format.js';
import { ICONS } from './icons.js';

const POLL_MS = 60000;

const ICON = { like: 'heart', comment: 'comment', reply: 'comment', removed: 'alert' };

function line(n) {
  const who = `<strong>${esc(n.actorName || 'Someone')}</strong>`;
  const quote = n.snippet ? ` <span class="notif-quote">“${esc(n.snippet)}”</span>` : '';
  if (n.type === 'like') return `${who} liked your post${quote}`;
  if (n.type === 'comment') return `${who} commented on your post:${quote}`;
  if (n.type === 'reply') return `${who} also commented on a post you commented on:${quote}`;
  return esc(n.snippet || 'The PVO removed something you posted.');
}

function itemHtml(n) {
  const inner = `<span class="notif-icon notif-${n.type}" aria-hidden="true">${ICONS[ICON[n.type]] || ICONS.info}</span>
    <span class="notif-body"><span class="notif-text">${line(n)}</span><time datetime="${n.createdAt}">${timeAgo(n.createdAt)}</time></span>
    ${n.read ? '' : '<span class="notif-dot" aria-label="Unread"></span>'}`;
  return n.post
    ? `<li><a class="notif${n.read ? '' : ' is-unread'}" href="index.html?post=${n.post}" data-notif="${n._id}">${inner}</a></li>`
    : `<li><div class="notif${n.read ? '' : ' is-unread'}" data-notif="${n._id}">${inner}</div></li>`;
}

export function notificationsButton() {
  if (!getUser()) return '';
  return `<div class="notif-wrap">
    <button class="icon-btn notif-btn" id="notif-btn" type="button" aria-expanded="false" aria-controls="notif-panel" aria-label="Notifications">
      ${ICONS.bell}<span class="notif-badge" id="notif-badge" hidden></span>
    </button>
    <div class="popover notif-panel" id="notif-panel" hidden>
      <div class="notif-head"><strong>Notifications</strong><button type="button" class="notif-all" id="notif-all">Mark all as read</button></div>
      <ul class="notif-list" id="notif-list"><li class="notif-empty">Loading…</li></ul>
    </div>
  </div>`;
}

export function setupNotifications() {
  const btn = $('#notif-btn');
  if (!btn) return;
  const panel = $('#notif-panel');
  const list = $('#notif-list');
  const badge = $('#notif-badge');

  let lastCount = 0;
  const paintCount = (n) => {
    // A new unread notification rings the bell once.
    if (n > lastCount) {
      btn.classList.remove('ring');
      void btn.offsetWidth;
      btn.classList.add('ring');
    }
    lastCount = n;
    badge.hidden = !n;
    badge.textContent = n > 9 ? '9+' : String(n);
    btn.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
  };

  async function refreshCount() {
    try { paintCount((await api('/notifications/unread')).unread); } catch { /* keep the last count */ }
  }

  async function load() {
    try {
      const { items, unread } = await api('/notifications');
      paintCount(unread);
      $('#notif-all').hidden = !unread;
      list.innerHTML = items.length
        ? items.map(itemHtml).join('')
        : `<li class="notif-empty">${ICONS.bell}<span>No notifications yet.<br>Likes and comments on your posts show up here.</span></li>`;
    } catch (err) {
      list.innerHTML = `<li class="notif-empty">${esc(err.message)}</li>`;
    }
  }

  const close = () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      document.getElementById('account-menu')?.setAttribute('hidden', '');
      load();
    }
  });
  document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { close(); btn.focus(); } });

  $('#notif-all').addEventListener('click', async () => {
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      await load();
    } catch { /* ignore */ }
  });
  list.addEventListener('click', (e) => {
    const el = e.target.closest('[data-notif]');
    if (!el || !el.classList.contains('is-unread')) return;
    // Mark read without holding up the navigation.
    api(`/notifications/${el.dataset.notif}/read`, { method: 'PATCH' }).then((r) => paintCount(r.unread)).catch(() => {});
    el.classList.remove('is-unread');
    el.querySelector('.notif-dot')?.remove();
  });

  refreshCount();
  setInterval(() => { if (document.visibilityState === 'visible') refreshCount(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refreshCount());
}
