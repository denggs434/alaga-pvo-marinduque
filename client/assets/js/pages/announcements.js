/**
 * Announcements and scheduled PVO activities.
 * Filters: category chips, title search, "upcoming schedules only".
 * Each scheduled activity can be saved to the visitor's calendar as an .ics file.
 * Links like announcements.html#a-<id> open and highlight one announcement.
 */
import { api, qs } from '../api.js';
import { CATEGORIES } from '../config.js';
import { initPage, emptyState, errorState, skeleton, debounce, esc, formatDate, ICONS, $, $$ } from '../ui.js';
import { categoryTag, dateTile, eventWhen, scheduleItem } from '../components.js';

initPage('announcements');

const params = new URLSearchParams(location.search);
const state = { category: params.get('category') || '', q: '', upcoming: params.get('view') === 'schedules' };
const list = $('#ann-list');
const byId = new Map();
$('#upcoming-only').checked = state.upcoming;

function card(a) {
  const e = a.event?.startsAt ? a.event : null;
  const past = e && new Date(e.endsAt || e.startsAt) < new Date();
  const long = a.body.length > 260 || /\n\s*\n/.test(a.body);
  return `<article class="card ann ${a.pinned ? 'is-pinned' : ''}" id="a-${a._id}">
    <div class="row" style="gap:8px">${categoryTag(a.category)}${a.pinned ? `<span class="tag">${ICONS.star}Pinned</span>` : ''}<span class="muted small">Posted ${formatDate(a.createdAt)}</span></div>
    <h2>${esc(a.title)}</h2>
    ${e ? `<div class="ann-event ${past ? 'is-past' : ''}">${dateTile(e.startsAt)}
      <div class="stack-sm" style="gap:4px">
        <p>${ICONS.clock}${esc(eventWhen(e))}${past ? ' <span class="tag">Done</span>' : ''}</p>
        <p>${ICONS.pin}${esc(e.venue || '')}${e.municipality ? `, ${esc(e.municipality)}` : ''}</p>
        ${past ? '' : `<button class="link-btn small" type="button" data-ics="${a._id}" style="justify-self:start;display:inline-flex;gap:6px;align-items:center">Add to my calendar</button>`}
      </div></div>` : ''}
    ${a.image ? `<img class="ann-image" src="${esc(a.image)}" alt="" loading="lazy">` : ''}
    <div class="ann-body ${long ? 'is-clamped' : ''}">${a.body.split(/\n\s*\n/).map((para) => `<p>${esc(para.trim())}</p>`).join('')}</div>
    <div class="row" style="gap:16px">
      ${long ? `<button class="link-btn" type="button" data-expand="${a._id}" aria-expanded="false">Read more</button>` : ''}
      <button class="link-btn" type="button" data-copy="${a._id}">Copy link</button>
    </div>
  </article>`;
}

function renderChips() {
  const chip = (k, label) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${state.category === k}">${label}</button>`;
  $('#cat-chips').innerHTML = chip('', 'All') + Object.entries(CATEGORIES).map(([k, c]) => chip(k, c.label)).join('');
}

async function load() {
  list.innerHTML = skeleton(3, 160);
  try {
    const data = await api(`/announcements${qs({ category: state.category, q: state.q, upcoming: state.upcoming ? 'true' : '', limit: 50 })}`);
    data.items.forEach((a) => byId.set(a._id, a));
    list.innerHTML = data.items.length
      ? data.items.map(card).join('')
      : emptyState(state.upcoming ? 'No upcoming activities' : 'No announcements found', state.upcoming ? 'New drives are posted here first. Check back soon.' : 'Try another category or search.');
    focusHash();
  } catch (err) {
    list.innerHTML = errorState(err.message);
  }
}

/** Open and scroll to the announcement in the URL hash. */
function focusHash() {
  const el = location.hash.startsWith('#a-') && document.getElementById(location.hash.slice(1));
  if (!el) return;
  el.querySelector('.ann-body')?.classList.remove('is-clamped');
  el.querySelector('[data-expand]')?.remove();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
addEventListener('hashchange', focusHash);

/* ---------- Calendar file (.ics) ---------- */
const icsDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s = '') => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

function downloadIcs(a) {
  const e = a.event;
  const end = e.endsAt || new Date(new Date(e.startsAt).getTime() + 2 * 36e5);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Alaga PVO Marinduque//EN', 'BEGIN:VEVENT',
    `UID:${a._id}@alaga`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(e.startsAt)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(a.title)}`, `LOCATION:${icsText([e.venue, e.municipality, 'Marinduque'].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${icsText(a.body.slice(0, 900))}`, 'END:VEVENT', 'END:VCALENDAR',
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: `${a.title.replace(/[^\w]+/g, '-').toLowerCase()}.ics` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Events ---------- */
list.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.expand) {
    const body = b.closest('.ann').querySelector('.ann-body');
    const open = body.classList.toggle('is-clamped');
    b.textContent = open ? 'Read more' : 'Show less';
    b.setAttribute('aria-expanded', String(!open));
  }
  if (b.dataset.ics) downloadIcs(byId.get(b.dataset.ics));
  if (b.dataset.copy) {
    const url = new URL(`announcements.html#a-${b.dataset.copy}`, location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      b.textContent = 'Link copied';
      setTimeout(() => { if (b.isConnected) b.textContent = 'Copy link'; }, 2000);
    } catch { prompt('Copy this link:', url); }
  }
});
$('#cat-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  state.category = b.dataset.cat;
  $$('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  load();
});
$('#ann-q').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); load(); }));
$('#upcoming-only').addEventListener('change', (e) => { state.upcoming = e.target.checked; load(); });

renderChips();
load();
api(`/announcements${qs({ upcoming: 'true', limit: 8 })}`)
  .then((d) => ($('#upcoming').innerHTML = d.items.map(scheduleItem).join('') || '<li class="muted small">No activities scheduled right now.</li>'))
  .catch(() => ($('#upcoming').innerHTML = '<li class="muted small">Could not load schedules.</li>'));
