/**
 * Messages: the user's conversations with the PVO, like a chat app.
 *  - left: conversations, newest activity first, with a dot for unread replies
 *  - right: the chosen conversation as chat bubbles, and a box to write again
 *  - "New" starts a conversation (topic + message)
 * On phones the list and the conversation take turns on screen.
 * Links: /messages#<id> opens one conversation; #new opens the new-message form.
 */
import { api } from '../api.js';
import { refreshUnread } from '../nav.js';
import { CONTACT_TOPICS, SITE } from '../config.js';
import { initPage, requireLogin, toast, setBusy, options, emptyState, errorState, skeleton, esc, timeAgo, formatDateTime, ICONS, $ } from '../ui.js';

initPage('messages');
const user = requireLogin('Log in to message the PVO.');

const state = { list: [], open: null };
const app = $('#msg-app');
const thread = $('#msg-thread');

const preview = (m) => {
  const last = m.replies[m.replies.length - 1];
  return last ? `${last.mine ? 'You: ' : 'PVO: '}${last.text}` : `You: ${m.message}`;
};
const lastAt = (m) => m.replies[m.replies.length - 1]?.createdAt || m.createdAt;

function renderList() {
  $('#msg-list').innerHTML = state.list.length
    ? state.list.map((m) => `<li><button type="button" class="msg-item${state.open === m._id ? ' is-open' : ''}${m.unread ? ' is-unread' : ''}" data-open="${m._id}">
        <span class="msg-avatar" aria-hidden="true">${ICONS.shield}</span>
        <span class="msg-item-body">
          <span class="msg-item-top"><strong>${esc(CONTACT_TOPICS[m.topic] || 'Message')}</strong><time datetime="${lastAt(m)}">${timeAgo(lastAt(m))}</time></span>
          <span class="msg-item-text">${esc(preview(m))}</span>
        </span>
        ${m.unread ? '<span class="msg-dot" aria-label="New reply"></span>' : ''}
      </button></li>`).join('')
    : `<li class="msg-empty-list">No conversations yet.</li>`;
}

const bubble = (who, text, at, mine) => `<div class="bubble-row${mine ? ' is-mine' : ''}">
  ${mine ? '' : `<span class="msg-avatar sm" aria-hidden="true">${ICONS.shield}</span>`}
  <div class="bubble"><p>${esc(text)}</p><span class="bubble-meta">${mine ? '' : `${esc(who)} · `}${formatDateTime(at)}</span></div>
</div>`;

function renderThread() {
  const m = state.list.find((x) => x._id === state.open);
  app.classList.toggle('show-thread', !!state.open);
  if (state.open === 'new') return renderCompose();
  if (!m) {
    thread.innerHTML = `<div class="msg-placeholder">${ICONS.chat}<h2>Your messages with the PVO</h2><p>Questions about registration, vaccination, a report or the shop? Start a conversation and the office will reply here.</p><button class="btn btn-primary" type="button" data-new>New message</button></div>`;
    return;
  }
  thread.innerHTML = `<header class="msg-thread-head">
      <button class="icon-btn msg-back" type="button" data-back aria-label="Back to conversations">${ICONS.chevron}</button>
      <span class="msg-avatar" aria-hidden="true">${ICONS.shield}</span>
      <div><strong>PVO Marinduque</strong><span>${esc(CONTACT_TOPICS[m.topic] || 'Message')} · started ${formatDateTime(m.createdAt)}</span></div>
    </header>
    <div class="msg-bubbles" id="msg-bubbles">
      ${bubble('You', m.message, m.createdAt, true)}
      ${m.replies.map((r) => bubble(r.by, r.text, r.createdAt, r.mine)).join('')}
      ${m.replies.some((r) => !r.mine) ? '' : '<p class="msg-wait">Sent. The office usually replies within one working day; you will see the reply here.</p>'}
    </div>
    <form class="msg-compose" id="msg-reply" novalidate>
      <label class="sr-only" for="msg-reply-text">Write a message</label>
      <textarea id="msg-reply-text" name="text" rows="1" maxlength="2000" placeholder="Write a message…" required></textarea>
      <button class="btn btn-primary msg-send" type="submit" aria-label="Send">${ICONS.send}</button>
    </form>`;
  const box = $('#msg-bubbles');
  box.scrollTop = box.scrollHeight;
  if (m.unread) markRead(m);
}

function renderCompose() {
  thread.innerHTML = `<header class="msg-thread-head">
      <button class="icon-btn msg-back" type="button" data-back aria-label="Back to conversations">${ICONS.chevron}</button>
      <span class="msg-avatar" aria-hidden="true">${ICONS.shield}</span>
      <div><strong>New message to the PVO</strong><span>${esc(SITE.hours)}</span></div>
    </header>
    <form class="msg-new-form" id="msg-new-form" novalidate>
      <label class="field"><span>Topic</span><select class="input" name="topic">${options(CONTACT_TOPICS, 'general')}</select></label>
      <label class="field"><span>Message</span><textarea class="input" name="message" maxlength="2000" required placeholder="Write your question. Include your pet's name or a report number if it is about one." style="min-height:160px"></textarea><small class="field-error"></small></label>
      <p class="muted small" style="margin:0">For animal bites and emergencies, call the hotline <a href="tel:${SITE.hotline.replace(/\s/g, '')}">${SITE.hotline}</a> instead.</p>
      <div class="row"><button class="btn btn-ghost" type="button" data-back>Cancel</button><button class="btn btn-primary" type="submit">Send message</button></div>
    </form>`;
  $('#msg-new-form textarea').focus();
}

async function markRead(m) {
  m.unread = false;
  renderList();
  try { await api('/contact/mine/read', { method: 'PATCH' }); refreshUnread(); } catch { /* next visit */ }
}

function open(id) {
  state.open = id;
  history.replaceState(null, '', id ? `#${id}` : location.pathname);
  renderList();
  renderThread();
}

async function load() {
  $('#msg-list').innerHTML = `<li>${skeleton(3, 64)}</li>`;
  try {
    state.list = await api('/contact/mine');
    state.list.sort((a, b) => new Date(lastAt(b)) - new Date(lastAt(a)));
    const hash = location.hash.slice(1);
    // Desktop opens the newest conversation; phones start on the list.
    const wide = matchMedia('(min-width: 821px)').matches;
    state.open = hash === 'new' || state.list.some((m) => m._id === hash) ? hash : wide ? state.list[0]?._id || null : null;
    renderList();
    renderThread();
  } catch (err) {
    thread.innerHTML = errorState(err.message);
    $('#msg-list').innerHTML = '';
  }
}

/* ---------- Events ---------- */
app.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.open) open(b.dataset.open);
  if (b.dataset.back !== undefined) open(null);
  if (b.dataset.new !== undefined || b.id === 'msg-new') open('new');
});

app.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('[type=submit]');
  if (form.id === 'msg-reply') {
    const text = form.elements.text.value.trim();
    if (text.length < 2) return;
    setBusy(btn, true, '…');
    try {
      const updated = await api(`/contact/${state.open}/followups`, { method: 'POST', body: { text } });
      state.list = [updated, ...state.list.filter((m) => m._id !== updated._id)];
      renderList();
      renderThread();
      $('#msg-reply-text')?.focus();
    } catch (err) {
      toast(err.message, 'error');
      setBusy(btn, false);
    }
  }
  if (form.id === 'msg-new-form') {
    const f = form.elements;
    const slot = form.querySelector('.field-error');
    if (f.message.value.trim().length < 10) { slot.textContent = 'Write at least 10 characters.'; f.message.focus(); return; }
    setBusy(btn, true, 'Sending…');
    try {
      const { id } = await api('/contact', { method: 'POST', body: { topic: f.topic.value, message: f.message.value.trim() } });
      toast('Message sent to the PVO.');
      state.list = await api('/contact/mine');
      state.list.sort((a, b) => new Date(lastAt(b)) - new Date(lastAt(a)));
      open(id);
    } catch (err) {
      slot.textContent = err.message;
      setBusy(btn, false);
    }
  }
});

// Enter sends, Shift+Enter makes a new line; the box grows with the text.
app.addEventListener('keydown', (e) => {
  if (e.target.id === 'msg-reply-text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    e.target.form.requestSubmit();
  }
});
app.addEventListener('input', (e) => {
  if (e.target.id !== 'msg-reply-text') return;
  e.target.style.height = 'auto';
  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
});

if (user) {
  if (user.role === 'admin') location.replace('/admin/messages');
  else load();
}
