/**
 * Announcements and scheduled PVO activities.
 * A news feed: All / Schedules switch, title search and a category menu.
 * Each scheduled activity can be saved to the visitor's calendar as an .ics file.
 * Links like /announcements#a-<id> open and highlight one announcement.
 */
import { api, qs } from '../api.js';
import { CATEGORIES } from '../config.js';
import { initPage, emptyState, errorState, skeleton, debounce, esc, formatDate, dateParts, options, ICONS, $, $$ } from '../ui.js';
import { eventWhen, scheduleItem } from '../components.js';

initPage('announcements');

const params = new URLSearchParams(location.search);
const state = { category: params.get('category') || '', q: '', upcoming: params.get('view') === 'schedules' };
const list = $('#ann-list');
const byId = new Map();

function card(a) {
  const e = a.event?.startsAt ? a.event : null;
  const past = e && new Date(e.endsAt || e.startsAt) < new Date();
  const long = a.body.length > 220 || /\n\s*\n/.test(a.body);
  const d = dateParts(e ? e.startsAt : a.createdAt);
  return `<article class="ann-item${a.pinned ? ' is-pinned' : ''}${past ? ' is-past' : ''}" id="a-${a._id}">
    <div class="ann-date${e ? ' is-event' : ''}" aria-hidden="true"><small>${esc(d.month)}</small><b>${esc(d.day)}</b><small>${esc(d.weekday)}</small></div>
    <div class="ann-main">
      <p class="ann-meta">${a.pinned ? `<span class="ann-pin">${ICONS.pin}Pinned</span>` : ''}<span>${esc(CATEGORIES[a.category]?.label || a.category)}</span><span>Posted ${formatDate(a.createdAt)}</span></p>
      <h2>${esc(a.title)}</h2>
      ${e ? `<p class="ann-when">${ICONS.clock}<span>${esc(eventWhen(e))}${past ? ' · done' : ''}</span></p><p class="ann-when">${ICONS.pin}<span>${esc(e.venue || '')}${e.municipality ? `, ${esc(e.municipality)}` : ''}</span></p>` : ''}
      <div class="ann-body ${long ? 'is-clamped' : ''}">${a.body.split(/\n\s*\n/).map((para) => `<p>${esc(para.trim())}</p>`).join('')}</div>
      <div class="ann-actions">
        ${long ? `<button class="text-btn" type="button" data-expand="${a._id}" aria-expanded="false">Read more</button>` : ''}
        ${e && !past ? `<button class="text-btn" type="button" data-ics="${a._id}">${ICONS.calendarPlus}Add to calendar</button>` : ''}
        <button class="text-btn" type="button" data-copy="${a._id}">${ICONS.link}Copy link</button>
      </div>
    </div>
    ${a.image ? `<img class="ann-thumb" src="${esc(a.image)}" alt="" loading="lazy">` : ''}
  </article>`;
}

function renderFilters() {
  $('#ann-cat').innerHTML = options(Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, c.label])), state.category, 'All categories');
  $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.view === 'schedules') === state.upcoming)));
}

async function load() {
  list.innerHTML = skeleton(4, 120);
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
    const url = new URL(`/announcements#a-${b.dataset.copy}`, location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      const html = b.innerHTML;
      b.innerHTML = `${ICONS.check}Link copied`;
      setTimeout(() => { if (b.isConnected) b.innerHTML = html; }, 2000);
    } catch { prompt('Copy this link:', url); }
  }
});
$('#ann-cat').addEventListener('change', (e) => { state.category = e.target.value; load(); });
$$('[data-view]').forEach((b) => b.addEventListener('click', () => {
  state.upcoming = b.dataset.view === 'schedules';
  renderFilters();
  load();
}));
$('#ann-q').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); load(); }));

renderFilters();
load();
api(`/announcements${qs({ upcoming: 'true', limit: 8 })}`)
  .then((d) => ($('#upcoming').innerHTML = d.items.map(scheduleItem).join('') || '<li class="muted small">No activities scheduled right now.</li>'))
  .catch(() => ($('#upcoming').innerHTML = '<li class="muted small">Could not load schedules.</li>'));
