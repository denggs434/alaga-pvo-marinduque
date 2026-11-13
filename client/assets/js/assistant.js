/**
 * Alagai: the pet-care helper, available to logged-in users on every public page.
 * Answers come from Google Gemini on the server, grounded in the user's pets, the PVO
 * schedule and the shop (with built-in pet-care answers when AI is unavailable).
 *  - a labelled "Ask Alagai" button opens a chat panel (a modal dialog: focus stays
 *    inside, Escape closes it, it fills the screen on phones)
 *  - the conversation is kept for this browser tab (sessionStorage) so it survives
 *    moving between pages; "New chat" clears it
 *  - the server adds an urgent flag for emergencies; the panel then shows the
 *    hotline banner
 * Replies are escaped first, then a tiny Markdown subset (bold, links to pages
 * of this site only, bullet and numbered lists, paragraphs) is turned into HTML.
 */
import { api } from './api.js';
import { getUser } from './store.js';
import { SITE } from './config.js';
import { esc, $ } from './format.js';
import { ICONS } from './icons.js';

const SUGGESTIONS = [
  'What should I feed a 3-month-old puppy?',
  'When is the next vaccination drive?',
  'Is my pets\' anti-rabies up to date?',
  'My dog keeps scratching. What can I do?',
  'What should I buy for my pet from the shop?',
];
const MAX_LEN = 1500;

const storeKey = () => `alaga.alagai.${getUser()?._id || 'guest'}`;
function loadHistory() {
  try { return JSON.parse(sessionStorage.getItem(storeKey())) || []; } catch { return []; }
}
function saveHistory(list) {
  try { sessionStorage.setItem(storeKey(), JSON.stringify(list.slice(-30))); } catch { /* storage blocked */ }
}

/** Escape, then render **bold**, [links](page.html?…) to this site, "- " / "1. " lists and paragraphs. */
export function renderReply(text) {
  const inline = (s) => esc(s)
    .replace(/\[([^\]]+)\]\(([a-z-]+\.html(?:\?[\w=.-]*)?(?:#[\w-]*)?)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const out = [];
  let para = [];
  let list = null;
  const flushPara = () => { if (para.length) out.push(`<p>${para.join('<br>')}</p>`); para = []; };
  const flushList = () => { if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${i}</li>`).join('')}</${list.type}>`); list = null; };
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    const m = line.match(/^(?:([-*•])|\d+[.)])\s+(.*)$/);
    if (m) {
      flushPara();
      const type = m[1] ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      list = list || { type, items: [] };
      list.items.push(inline(m[2]));
    } else if (line) {
      flushList();
      para.push(inline(line));
    } else {
      flushPara();
      flushList();
    }
  }
  flushPara();
  flushList();
  return out.join('');
}

function panelHtml() {
  return `<dialog class="alagai" id="alagai" aria-labelledby="alagai-title">
    <header class="alagai-head">
      <span class="alagai-mark" aria-hidden="true">${ICONS.sparkle}</span>
      <div class="alagai-who"><h2 id="alagai-title">Alagai</h2><span>Pet-care helper · not a veterinarian</span></div>
      <button class="btn btn-ghost btn-sm" type="button" id="alagai-new">New chat</button>
      <button class="icon-btn" type="button" id="alagai-close" aria-label="Close Alagai">${ICONS.close}</button>
    </header>
    <div class="alagai-urgent" id="alagai-urgent" hidden role="alert">
      ${ICONS.alert}<p><strong>This may be an emergency.</strong> Go to a licensed veterinarian now, or call the PVO animal bite hotline <a href="tel:${SITE.hotline.replace(/\s/g, '')}">${SITE.hotline}</a>.</p>
    </div>
    <div class="alagai-log" id="alagai-log" role="log" aria-live="polite" aria-relevant="additions" tabindex="0"></div>
    <form class="alagai-form" id="alagai-form" novalidate>
      <label class="sr-only" for="alagai-input">Ask Alagai about your pet</label>
      <textarea id="alagai-input" rows="1" maxlength="${MAX_LEN}" placeholder="Ask about feeding, vaccines, symptoms…" required></textarea>
      <button class="btn btn-primary alagai-send" type="submit" id="alagai-send" aria-label="Send">${ICONS.send}</button>
    </form>
    <p class="alagai-foot">Alagai gives general pet-care information only. It cannot diagnose or prescribe. For anything serious, see a licensed vet.</p>
  </dialog>`;
}

function introHtml(name) {
  return `<div class="alagai-intro">
    <p><strong>Hi ${esc(name)}! I'm Alagai.</strong> Ask me about feeding, grooming, vaccines, deworming, behaviour, or PVO services and schedules.</p>
    <p class="muted small">I'm a pet-care helper, not a veterinarian, so I can't diagnose or prescribe. In an emergency, go to a vet right away.</p>
    <div class="alagai-suggest">${SUGGESTIONS.map((s) => `<button class="chip" type="button" data-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>
  </div>`;
}

const bubble = (m) => m.role === 'user'
  ? `<div class="msg msg-user"><p>${esc(m.content).replace(/\n/g, '<br>')}</p></div>`
  : `<div class="msg msg-bot${m.error ? ' is-error' : ''}">${m.error ? `<p>${esc(m.content)}</p>` : renderReply(m.content)}</div>`;

export function setupAssistant() {
  const user = getUser();
  if (!user || document.getElementById('alagai')) return;

  document.documentElement.classList.add('has-alagai'); // leaves room so the button never covers the footer
  document.body.insertAdjacentHTML('beforeend', `<button class="alagai-fab" type="button" id="alagai-open" aria-haspopup="dialog" aria-controls="alagai">${ICONS.sparkle}<span>Ask Alagai</span></button>${panelHtml()}`);
  const dialog = $('#alagai');
  const log = $('#alagai-log');
  const form = $('#alagai-form');
  const input = $('#alagai-input');
  const send = $('#alagai-send');
  let history = loadHistory();
  let busy = false;

  const scrollDown = () => { log.scrollTop = log.scrollHeight; };
  function paint() {
    log.innerHTML = introHtml(user.name.split(' ')[0]) + history.map(bubble).join('');
    $('#alagai-urgent').hidden = !history.some((m) => m.urgent);
    scrollDown();
  }
  const grow = () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 140)}px`; };

  async function ask(text) {
    const question = text.trim().slice(0, MAX_LEN);
    if (!question || busy) return;
    busy = true;
    send.disabled = true;
    history.push({ role: 'user', content: question });
    saveHistory(history);
    paint();
    log.insertAdjacentHTML('beforeend', '<div class="msg msg-bot msg-typing" id="alagai-typing" aria-label="Alagai is typing"><span></span><span></span><span></span></div>');
    scrollDown();
    try {
      const convo = history.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
      const { reply, urgent } = await api('/assistant/chat', { method: 'POST', body: { messages: convo } });
      history.push({ role: 'assistant', content: reply, urgent });
    } catch (err) {
      history.push({ role: 'assistant', content: err.status === 401 ? 'Your session ended. Log in again to keep chatting.' : err.message, error: true });
    } finally {
      saveHistory(history);
      busy = false;
      send.disabled = false;
      paint();
      input.focus();
    }
  }

  function open(prefill) {
    paint();
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('alagai-open');
    if (prefill) ask(prefill);
    else input.focus();
  }

  $('#alagai-open').addEventListener('click', () => open());
  $('#alagai-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('alagai-open');
    $('#alagai-open').focus();
  });
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  $('#alagai-new').addEventListener('click', () => {
    if (busy) return;
    history = [];
    saveHistory(history);
    paint();
    input.focus();
  });
  log.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ask]');
    if (b) ask(b.dataset.ask);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    grow();
    ask(text);
  });
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  // Any link or button with data-open-alagai (account menu, drawer, pages) opens the chat.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-alagai]');
    if (!t) return;
    e.preventDefault();
    document.querySelectorAll('dialog[open]').forEach((d) => d !== dialog && d.close());
    open(t.dataset.openAlagai || '');
  });
  if (location.hash === '#alagai') open();
}
