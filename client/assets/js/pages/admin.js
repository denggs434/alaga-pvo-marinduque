/**
 * PVO admin console.
 *
 * Views (switched with the URL hash so each can be bookmarked):
 *   #overview       dashboard: totals, what needs attention, coverage, monthly charts
 *   #pets           the pet registry: verify registrations, record vaccinations, remove
 *   #reports        incident cases: filter, open a case, update status with a note
 *   #announcements  publish news and scheduled activities (vaccination drives…)
 *   #owners         accounts: suspend / delete
 *   #messages       contact-form inbox
 *
 * Every request carries the admin's token; the server enforces the admin role.
 * This page only decides what to show.
 */
import { api, qs } from '../api.js';
import { getUser, isAdmin, setSession, clearSession } from '../store.js';
import { setupThemeToggle } from '../nav.js';
import { SPECIES, SPECIES_PLURAL, MUNICIPALITIES, CATEGORIES, REPORT_TYPES, REPORT_STATUSES, VACCINES, CONTACT_TOPICS } from '../config.js';
import {
  initAdminPage, toast, armed, setupModal, showFieldErrors, setBusy, options, createPhotoPicker, emptyState,
  esc, initials, formatDate, formatDateTime, formatNumber, timeAgo, toDateInput, fromDateInput, toDateTimeInput, fromDateTimeInput, debounce,
  ICONS, BRAND_MARK, $, $$,
} from '../ui.js';
import { petImg, reportTypeTag, reportStatusTag, categoryTag, timeline, eventWhen } from '../components.js';
import { groupedBars, stackedBars } from './admin-charts.js';

initAdminPage();
const brand = `${BRAND_MARK}<span class="brand-word">Alaga<small>PVO admin</small></span>`;
$('#login-brand').innerHTML = brand;
$$('[data-logout]').forEach((b) => b.addEventListener('click', () => { clearSession(); location.href = 'admin.html'; }));

if (isAdmin()) boot();
else if (getUser()) $('#denied').hidden = false;
else showLogin();

/* =========================================================================
   Sign in
   ========================================================================= */
function showLogin() {
  const form = $('#admin-login-form');
  $('#admin-login').hidden = false;
  form.elements.email.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#admin-login-error');
    err.hidden = true;
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Signing in…');
    try {
      const session = await api('/users/login', { method: 'POST', auth: false, body: { email: form.elements.email.value.trim(), password: form.elements.password.value } });
      if (session.user.role !== 'admin') throw new Error('That is a pet owner account. Use a PVO staff account here.');
      setSession(session);
      location.reload();
    } catch (error) {
      err.textContent = error.message;
      err.hidden = false;
      setBusy(btn, false);
    }
  });
}

/* =========================================================================
   Console
   ========================================================================= */
function boot() {
  const state = { stats: null, pets: [], reports: [], anns: [], users: [], messages: [], reportFilter: 'open', msgFilter: 'inbox', replying: null };
  const user = getUser();

  /* ---------- Chrome ---------- */
  $('#console').hidden = false;
  $('#side-brand').innerHTML = brand;
  $$('[data-icon]').forEach((el) => (el.innerHTML = ICONS[el.dataset.icon] || ''));
  $('#admin-name').textContent = user.name;
  $('#greet-name').textContent = user.name.split(' ')[0];
  $('#admin-avatar').textContent = initials(user.name);
  $('#today-date').textContent = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });
  setupThemeToggle($('#theme-toggle'));

  const side = $('#console-side');
  const setSide = (open) => {
    side.classList.toggle('is-open', open);
    $('#side-toggle').setAttribute('aria-expanded', String(open));
    if (open) side.querySelector('a, button')?.focus();
  };
  $('#side-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    setSide(!side.classList.contains('is-open'));
  });
  // Phone menu: a tap outside or Escape closes it.
  document.addEventListener('click', (e) => {
    if (side.classList.contains('is-open') && !side.contains(e.target)) setSide(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && side.classList.contains('is-open')) { setSide(false); $('#side-toggle').focus(); }
  });

  // On phones each table row becomes a card: give every cell its column name as a label.
  const labelCells = (table) => {
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => {
      if (heads[i] && !td.hasAttribute('colspan')) td.dataset.label = heads[i];
    }));
  };
  $$('.console .table').forEach((t) => new MutationObserver(() => labelCells(t)).observe(t, { childList: true }));

  const VIEWS = ['overview', 'pets', 'reports', 'announcements', 'owners', 'messages'];
  function showView() {
    const view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
    $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== view));
    $$('[data-view]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.view === view));
    const label = $(`[data-view="${view}"]`).textContent.trim();
    $('#mobile-title').textContent = label;
    document.title = `${label} | Alaga PVO admin`;
    side.classList.remove('is-open');
    window.scrollTo(0, 0);
  }
  addEventListener('hashchange', showView);
  showView();

  /* ---------- Data ---------- */
  async function loadAll() {
    try {
      const [stats, pets, reports, anns, users, messages] = await Promise.all([
        api('/admin/stats'),
        api(`/pets${qs({ all: 'true', limit: 500 })}`).then((d) => d.items),
        api(`/reports${qs({ limit: 500 })}`),
        api(`/announcements${qs({ all: 'true', limit: 100 })}`).then((d) => d.items),
        api('/users'),
        api('/contact?box=all'),
      ]);
      Object.assign(state, { stats, pets, reports, anns, users, messages });
      renderAll();
    } catch (err) {
      toast(err.message, 'error');
      if (err.status === 401 || err.status === 403) setTimeout(() => location.reload(), 1200);
    }
  }
  function renderAll() {
    renderOverview();
    renderPets();
    renderReports();
    renderAnnouncements();
    renderOwners();
    renderMessages();
    renderBadges();
  }
  /** Run an update, then refresh everything so every view stays consistent. */
  async function act(request, success) {
    try {
      const result = await request();
      if (success) toast(success);
      await loadAll();
      return result;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    }
  }

  function renderBadges() {
    const set = (k, n) => { const b = $(`[data-badge="${k}"]`); b.textContent = n; b.hidden = !n; };
    set('pets', state.stats.pets.pending);
    set('reports', state.stats.reports.pending);
    set('messages', state.stats.newMessages);
  }

  /* ---------- Overview ---------- */
  function renderOverview() {
    const s = state.stats;
    const pct = s.vaccinations.rabiesEligible ? Math.round((s.vaccinations.rabiesCurrent / s.vaccinations.rabiesEligible) * 100) : 0;
    const tile = (icon, label, value, small, alert = false) =>
      `<div class="stat ${alert ? 'is-alert' : ''}"><span class="label">${ICONS[icon]}${label}</span><strong>${value}</strong><small>${small}</small></div>`;
    $('#stats').innerHTML = [
      tile('paw', 'Registered pets', formatNumber(s.pets.total), `${s.pets.verified} verified · ${s.pets.pending} pending`),
      tile('users', 'Pet owners', formatNumber(s.owners.total), s.owners.banned ? `${s.owners.banned} suspended` : 'All accounts active'),
      tile('shieldCheck', 'Anti-rabies coverage', `${pct}%`, `${s.vaccinations.rabiesCurrent} of ${s.vaccinations.rabiesEligible} dogs and cats`),
      tile('syringe', 'Vaccinations, 30 days', formatNumber(s.vaccinations.last30), `${s.vaccinations.records} on record · ${s.vaccinations.unverified} owner entries`),
      tile('flag', 'Open reports', s.reports.open, s.reports.highPriorityOpen ? `${s.reports.highPriorityOpen} high priority` : 'None high priority', s.reports.highPriorityOpen > 0),
      tile('check', 'Resolved incidents', s.reports.resolved, `${s.reports.pending} new, awaiting review`),
      tile('calendar', 'Upcoming activities', s.vaccinations.upcomingActivities, 'Scheduled drives and programs'),
      tile('inbox', 'New messages', s.newMessages, `${s.posts} wall posts in total`),
    ].join('');

    // Needs attention
    const q = [];
    s.reports.recent.forEach((r) => q.push(`<li><span><strong>${esc(REPORT_TYPES[r.type].label)} · <span class="mono">${esc(r.reference)}</span></strong>
      ${r.priority === 'high' ? ' <span class="tag tag-red">High priority</span>' : ''} ${reportStatusTag(r.status)}<br>
      <span>${esc(r.location.barangay)}, ${esc(r.location.municipality)} · filed ${timeAgo(r.createdAt)}</span></span>
      <button class="btn btn-sm btn-primary" type="button" data-open-report="${r._id}">Open case</button></li>`));
    if (s.pets.pending) q.push(`<li><span><strong>${s.pets.pending} pet registration${s.pets.pending === 1 ? '' : 's'} to verify</strong><br><span>Check the details and photos, then verify.</span></span><button class="btn btn-sm btn-ghost" type="button" data-goto-pending>Review</button></li>`);
    if (s.vaccinations.unverified) q.push(`<li><span><strong>${s.vaccinations.unverified} owner-entered vaccination${s.vaccinations.unverified === 1 ? '' : 's'}</strong><br><span>Verify when the owner shows the vaccination card.</span></span></li>`);
    if (s.newMessages) q.push(`<li><span><strong>${s.newMessages} new message${s.newMessages === 1 ? '' : 's'}</strong><br><span>From the contact form.</span></span><a class="btn btn-sm btn-ghost" href="#messages">Read</a></li>`);
    $('#queue').innerHTML = q.join('') || '<li><span><strong>All clear.</strong><br><span>New reports and registrations will show up here.</span></span></li>';

    // Coverage meter + species bars (single series: one colour, values labelled)
    $('#rabies-meter').innerHTML = `<div class="meter"><div class="row between"><strong style="font:900 2rem/1 var(--font-display)">${pct}%</strong>
      <span class="muted small">${s.vaccinations.rabiesCurrent} of ${s.vaccinations.rabiesEligible} dogs and cats with a valid shot</span></div>
      <div class="meter-bar" role="img" aria-label="${pct}% anti-rabies coverage"><span style="width:${pct}%"></span></div></div>`;
    const species = Object.entries(s.pets.bySpecies).sort((a, b) => b[1] - a[1]);
    const maxSp = Math.max(1, ...species.map(([, n]) => n));
    $('#species-bars').innerHTML = species.map(([k, n]) => `<li><span>${esc(SPECIES_PLURAL[k] || k)}</span>
      <span class="track"><span style="width:${(n / maxSp) * 100}%;background:var(--series-1)"></span></span><b>${n}</b></li>`).join('');

    const months = s.monthly.map((m) => m.month);
    groupedBars($('#chart-activity'), months, [
      { label: 'New registrations', cls: 's1', values: s.monthly.map((m) => m.registrations) },
      { label: 'Vaccinations given', cls: 's2', values: s.monthly.map((m) => m.vaccinations) },
    ], 'New pet registrations and vaccinations given per month, last 6 months');
    stackedBars($('#chart-reports'), months, Object.keys(REPORT_TYPES).map((t, i) => ({
      label: REPORT_TYPES[t].label, cls: `s${i + 1}`, values: s.monthly.map((m) => m.reports[t]),
    })), 'Reports filed per month by type, last 6 months');
  }

  /* ---------- Pets ---------- */
  $('#pet-species').innerHTML = options(SPECIES, '', 'All species');
  $('#pet-town').innerHTML = options(MUNICIPALITIES, '', 'All municipalities');
  ['#pet-species', '#pet-town', '#pet-reg'].forEach((s) => $(s).addEventListener('change', renderPets));
  $('#pet-q').addEventListener('input', debounce(renderPets, 150));

  const rabiesCell = (r) => (r.status === 'current' ? `<span class="tag tag-green">Until ${formatDate(r.due)}</span>`
    : r.status === 'overdue' ? '<span class="tag tag-amber">Overdue</span>' : '<span class="tag">None</span>');

  function renderPets() {
    const term = $('#pet-q').value.trim().toLowerCase();
    const sp = $('#pet-species').value;
    const town = $('#pet-town').value;
    const reg = $('#pet-reg').value;
    const rows = state.pets.filter((p) => (!sp || p.species === sp) && (!town || p.municipality === town) && (!reg || p.registrationStatus === reg)
      && (!term || `${p.name} ${p.breed} ${p.registrationNo} ${p.owner.name} ${p.owner.email}`.toLowerCase().includes(term)));
    $('#pets-table').innerHTML = `<thead><tr><th>Pet</th><th>Owner</th><th>Species / breed</th><th>Municipality</th><th>Anti-rabies</th><th>Registration</th><th></th></tr></thead>
      <tbody>${rows.map((p) => `<tr class="${p.status === 'deceased' ? 'is-muted' : ''}">
        <td><div class="cell-pet">${petImg(p.photos?.[0], '', p.name)}<span><strong><a href="pet.html?id=${p._id}" target="_blank" rel="noopener">${esc(p.name)}</a></strong>
          <span class="muted small mono">${esc(p.registrationNo)}</span>${p.status === 'missing' ? ' <span class="tag tag-solid-red">Missing</span>' : ''}${p.isPublic ? '' : ' <span class="tag">Private</span>'}</span></div></td>
        <td>${esc(p.owner.name)}<br><span class="muted small">${esc(p.owner.phone || p.owner.email || '')}</span></td>
        <td>${esc(SPECIES[p.species])}<br><span class="muted small">${esc(p.breed || '—')}</span></td>
        <td>${esc(p.municipality)}</td>
        <td>${rabiesCell(p.rabies)}</td>
        <td>${p.registrationStatus === 'verified' ? '<span class="tag tag-green">Verified</span>' : '<span class="tag tag-amber">Pending</span>'}</td>
        <td><div class="cell-actions">
          ${p.registrationStatus === 'verified' ? '' : `<button class="btn btn-soft btn-sm" type="button" data-verify="${p._id}">Verify</button>`}
          <button class="btn btn-ghost btn-sm" type="button" data-vax="${p._id}" title="Record a PVO vaccination">${ICONS.syringe}<span class="sr-only">Record vaccination for ${esc(p.name)}</span></button>
          <a class="btn btn-ghost btn-sm" href="pet-form.html?id=${p._id}" title="Edit">${ICONS.edit}<span class="sr-only">Edit ${esc(p.name)}</span></a>
          <button class="btn btn-danger btn-sm" type="button" data-del-pet="${p._id}" title="Delete">${ICONS.trash}<span class="sr-only">Delete ${esc(p.name)}</span></button>
        </div></td></tr>`).join('') || `<tr><td colspan="7">${emptyState('No pets match these filters')}</td></tr>`}</tbody>`;
  }

  // Record a verified vaccination from the registry.
  const vaxDialog = setupModal($('#vax-dialog'));
  const vaxForm = $('#vax-form');
  $('#vax-names').innerHTML = options(VACCINES);
  let vaxPet = null;
  function openVax(pet) {
    vaxPet = pet;
    vaxForm.reset();
    showFieldErrors(vaxForm, {});
    $('#vax-error').hidden = true;
    $('#vax-title').textContent = `Record vaccination: ${pet.name}`;
    const today = new Date();
    vaxForm.elements.dateGiven.value = toDateInput(today);
    vaxForm.elements.dateGiven.max = toDateInput(today);
    vaxForm.elements.nextDue.value = toDateInput(new Date(today.getTime() + 365 * 864e5));
    vaxDialog.showModal();
  }
  vaxForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = vaxForm.elements;
    const btn = vaxForm.querySelector('[type=submit]');
    setBusy(btn, true, 'Saving…');
    try {
      await api(`/pets/${vaxPet._id}/vaccinations`, { method: 'POST', body: { vaccine: f.vaccine.value.trim(), dateGiven: fromDateInput(f.dateGiven.value), nextDue: fromDateInput(f.nextDue.value), administeredBy: f.administeredBy.value.trim() } });
      vaxDialog.close();
      toast(`Vaccination recorded for ${vaxPet.name}.`);
      loadAll();
    } catch (err) {
      $('#vax-error').textContent = err.message;
      $('#vax-error').hidden = false;
      if (err.details) showFieldErrors(vaxForm, Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k.split('.').pop(), v])));
    } finally {
      setBusy(btn, false);
    }
  });

  /* ---------- Reports ---------- */
  $('#rep-type').innerHTML = options(REPORT_TYPES, '', 'All types');
  $('#rep-town').innerHTML = options(MUNICIPALITIES, '', 'All municipalities');
  ['#rep-type', '#rep-town'].forEach((s) => $(s).addEventListener('change', renderReports));
  $('#rep-q').addEventListener('input', debounce(renderReports, 150));
  $('#report-status-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rfilter]');
    if (!b) return;
    state.reportFilter = b.dataset.rfilter;
    renderReports();
  });

  const OPEN = ['submitted', 'under-review', 'in-progress'];
  function renderReports() {
    const count = (f) => state.reports.filter((r) => (f === 'open' ? OPEN.includes(r.status) : f === 'all' || r.status === f)).length;
    $('#report-status-chips').innerHTML = [['open', 'Open'], ['all', 'All'], ...Object.entries(REPORT_STATUSES).map(([k, s]) => [k, s.label])]
      .map(([k, l]) => `<button class="chip" type="button" data-rfilter="${k}" aria-pressed="${state.reportFilter === k}">${l} <b>${count(k)}</b></button>`).join('');
    const f = state.reportFilter;
    const type = $('#rep-type').value;
    const town = $('#rep-town').value;
    const term = $('#rep-q').value.trim().toLowerCase();
    const rows = state.reports
      .filter((r) => (f === 'open' ? OPEN.includes(r.status) : f === 'all' || r.status === f))
      .filter((r) => (!type || r.type === type) && (!town || r.location.municipality === town)
        && (!term || `${r.reference} ${r.contact.name} ${r.location.barangay}`.toLowerCase().includes(term)))
      .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1) || new Date(b.createdAt) - new Date(a.createdAt));
    $('#reports-table').innerHTML = `<thead><tr><th>Reference</th><th>Type</th><th>Where</th><th>Happened</th><th>Filed</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td><strong class="mono">${esc(r.reference)}</strong>${r.priority === 'high' ? '<br><span class="tag tag-red">High priority</span>' : ''}</td>
        <td>${reportTypeTag(r.type)}${r.pet ? `<br><span class="small">${esc(r.pet.name)}</span>` : ''}</td>
        <td>${esc(r.location.barangay)}<br><span class="muted small">${esc(r.location.municipality)}</span></td>
        <td>${formatDate(r.incidentDate)}</td>
        <td>${timeAgo(r.createdAt)}</td>
        <td>${reportStatusTag(r.status)}</td>
        <td><div class="cell-actions"><button class="btn btn-primary btn-sm" type="button" data-open-report="${r._id}">Open</button></div></td>
      </tr>`).join('') || `<tr><td colspan="7">${emptyState('No reports here', f === 'open' ? 'Every case is resolved or closed.' : '')}</td></tr>`}</tbody>`;
  }

  const caseDialog = setupModal($('#case-dialog'));
  function openCase(id) {
    const r = state.reports.find((x) => x._id === id);
    if (!r) return;
    $('#case-title').innerHTML = `${esc(REPORT_TYPES[r.type].label)} · <span class="mono">${esc(r.reference)}</span>`;
    const closed = ['resolved', 'closed'].includes(r.status);
    $('#case-body').innerHTML = `
      <div class="row" style="gap:6px">${reportTypeTag(r.type)}${reportStatusTag(r.status)}${r.priority === 'high' ? '<span class="tag tag-red">High priority</span>' : ''}${r.publicAlert ? '<span class="tag tag-amber">Public alert on</span>' : ''}</div>
      <div class="case">
        <div class="stack">
          <p style="white-space:pre-line">${esc(r.description)}</p>
          ${r.photos?.length ? `<div class="case-photos">${r.photos.map((p) => `<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="Report photo"></a>`).join('')}</div>` : ''}
          <dl>
            <dt>Happened</dt><dd>${formatDate(r.incidentDate)} (filed ${formatDate(r.createdAt)})</dd>
            <dt>Where</dt><dd>${esc(r.location.details ? `${r.location.details}, ` : '')}Brgy. ${esc(r.location.barangay)}, ${esc(r.location.municipality)}</dd>
            <dt>Animal</dt><dd>${esc(SPECIES[r.animalSpecies] || 'Not sure')}${r.pet ? ` · <a href="pet.html?id=${r.pet._id}" target="_blank" rel="noopener">${esc(r.pet.name)} (${esc(r.pet.registrationNo)})</a>` : ''}</dd>
            <dt>Contact</dt><dd>${esc(r.contact.name)} · <a href="tel:${esc(r.contact.phone.replace(/\s/g, ''))}">${esc(r.contact.phone)}</a>${r.contact.email ? ` · <a href="mailto:${esc(r.contact.email)}">${esc(r.contact.email)}</a>` : ''}</dd>
          </dl>
          <h3 style="font-size:1rem">Timeline</h3>
          ${timeline(r.history)}
        </div>
        <form class="panel stack" id="case-form" novalidate>
          <h3 style="font-size:1rem">Update case</h3>
          <label class="field"><span>Status</span><select class="input" name="status">${options(REPORT_STATUSES, r.status)}</select></label>
          <label class="field"><span>Note to the reporter</span><textarea class="input" name="note" maxlength="500" style="min-height:110px" placeholder="What the PVO did or will do next. The reporter sees this."></textarea></label>
          ${r.type === 'missing' ? `<label class="check"><input type="checkbox" name="publicAlert" ${r.publicAlert ? 'checked' : ''} ${closed ? 'disabled' : ''}><span>Show public missing-pet alert<small>Turn off to hide the alert from the wall.</small></span></label>` : ''}
          <button class="btn btn-primary" type="submit">Save update</button>
        </form>
      </div>`;
    $('#case-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget.elements;
      const body = { status: f.status.value, note: f.note.value.trim() };
      if (f.publicAlert && !f.publicAlert.disabled) body.publicAlert = f.publicAlert.checked;
      const btn = e.currentTarget.querySelector('[type=submit]');
      setBusy(btn, true, 'Saving…');
      const saved = await act(() => api(`/reports/${r._id}`, { method: 'PATCH', body }), 'Case updated. The reporter can see it now.');
      setBusy(btn, false);
      if (saved) openCase(r._id); // show the new timeline entry
    });
    if (!caseDialog.open) caseDialog.showModal();
  }

  /* ---------- Announcements ---------- */
  function renderAnnouncements() {
    $('#ann-table').innerHTML = `<thead><tr><th>Title</th><th>Category</th><th>Schedule</th><th>Posted</th><th></th></tr></thead>
      <tbody>${state.anns.map((a) => `<tr class="${a.published ? '' : 'is-muted'}">
        <td><strong>${esc(a.title)}</strong><br>${a.pinned ? '<span class="tag tag-solid-green">Pinned</span> ' : ''}${a.published ? '' : '<span class="tag">Draft</span>'}</td>
        <td>${categoryTag(a.category)}</td>
        <td>${a.event?.startsAt ? `${esc(eventWhen(a.event))}<br><span class="muted small">${esc(a.event.venue || '')}</span>` : '<span class="muted">—</span>'}</td>
        <td>${formatDate(a.createdAt)}</td>
        <td><div class="cell-actions">
          <a class="btn btn-ghost btn-sm" href="announcements.html#a-${a._id}" target="_blank" rel="noopener" title="View">${ICONS.eye}<span class="sr-only">View</span></a>
          <button class="btn btn-ghost btn-sm" type="button" data-edit-ann="${a._id}">${ICONS.edit}<span class="sr-only">Edit</span></button>
          <button class="btn btn-danger btn-sm" type="button" data-del-ann="${a._id}">${ICONS.trash}<span class="sr-only">Delete</span></button>
        </div></td></tr>`).join('') || `<tr><td colspan="5">${emptyState('No announcements yet')}</td></tr>`}</tbody>`;
  }

  const annDialog = setupModal($('#ann-dialog'));
  const annForm = $('#ann-form');
  const annImage = createPhotoPicker($('#ann-image'), { max: 1, label: 'Add an image' });
  $('#ann-category').innerHTML = options(CATEGORIES);
  $('#ann-town').innerHTML = options(MUNICIPALITIES, '', 'Province-wide');
  const syncEvent = () => ($('#event-fields').hidden = !annForm.elements.hasEvent.checked);
  annForm.elements.hasEvent.addEventListener('change', syncEvent);
  let editingAnn = null;

  function openAnnouncement(a = null) {
    editingAnn = a?._id || null;
    annForm.reset();
    showFieldErrors(annForm, {});
    $('#ann-error').hidden = true;
    $('#ann-title').textContent = a ? 'Edit announcement' : 'New announcement';
    $('#ann-save').textContent = a ? 'Save changes' : 'Publish';
    const f = annForm.elements;
    if (a) {
      f.title.value = a.title;
      f.category.value = a.category;
      f.body.value = a.body;
      f.published.checked = a.published;
      f.pinned.checked = a.pinned;
      f.hasEvent.checked = !!a.event?.startsAt;
      f.startsAt.value = toDateTimeInput(a.event?.startsAt);
      f.endsAt.value = toDateTimeInput(a.event?.endsAt);
      f.venue.value = a.event?.venue || '';
      f.municipality.value = a.event?.municipality || '';
    }
    annImage.set(a?.image ? [a.image] : []);
    syncEvent();
    annDialog.showModal();
  }
  $$('[data-new-announcement]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); location.hash = 'announcements'; openAnnouncement(); }));

  annForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = annForm.elements;
    const errors = {};
    if (!f.title.value.trim()) errors.title = 'Enter a title.';
    if (!f.body.value.trim()) errors.body = 'Write the announcement text.';
    if (f.hasEvent.checked) {
      if (!f.startsAt.value) errors.startsAt = 'Add the start date and time.';
      if (!f.venue.value.trim()) errors.venue = 'Add the venue.';
      if (f.endsAt.value && f.startsAt.value && f.endsAt.value < f.startsAt.value) errors.endsAt = 'The end must be after the start.';
    }
    showFieldErrors(annForm, errors);
    if (Object.keys(errors).length) return;
    if (annImage.busy) return toast('Wait for the image to finish uploading.', 'error');
    const body = {
      title: f.title.value.trim(), category: f.category.value, body: f.body.value.trim(),
      published: f.published.checked, pinned: f.pinned.checked, image: annImage.paths[0] || '',
      event: f.hasEvent.checked ? { startsAt: fromDateTimeInput(f.startsAt.value), endsAt: fromDateTimeInput(f.endsAt.value), venue: f.venue.value.trim(), municipality: f.municipality.value } : null,
    };
    const btn = $('#ann-save');
    setBusy(btn, true, 'Saving…');
    try {
      await api(editingAnn ? `/announcements/${editingAnn}` : '/announcements', { method: editingAnn ? 'PUT' : 'POST', body });
      annDialog.close();
      toast(editingAnn ? 'Announcement updated.' : body.published ? 'Announcement published.' : 'Draft saved.');
      loadAll();
    } catch (err) {
      $('#ann-error').textContent = err.message;
      $('#ann-error').hidden = false;
      if (err.details) showFieldErrors(annForm, Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k.split('.').pop(), v])));
    } finally {
      setBusy(btn, false);
    }
  });

  /* ---------- Owners ---------- */
  $('#owner-q').addEventListener('input', debounce(renderOwners, 150));
  function renderOwners() {
    const term = $('#owner-q').value.trim().toLowerCase();
    const rows = state.users.filter((u) => !term || `${u.name} ${u.email} ${u.municipality || ''}`.toLowerCase().includes(term));
    $('#owners-table').innerHTML = `<thead><tr><th>Name</th><th>Contact</th><th>Municipality</th><th class="num">Pets</th><th class="num">Reports</th><th>Joined</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map((u) => `<tr class="${u.banned ? 'is-muted' : ''}">
        <td><strong>${esc(u.name)}</strong>${u.role === 'admin' ? ' <span class="tag tag-green">PVO staff</span>' : ''}</td>
        <td>${esc(u.email)}<br><span class="muted small">${esc(u.phone || '—')}</span></td>
        <td>${esc(u.municipality || '—')}${u.barangay ? `<br><span class="muted small">${esc(u.barangay)}</span>` : ''}</td>
        <td class="num">${u.petCount}</td><td class="num">${u.reportCount}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td>${u.banned ? `<span class="tag tag-red">Suspended ${formatDate(u.bannedAt)}</span>` : '<span class="tag tag-green">Active</span>'}</td>
        <td>${u.role === 'admin' ? '' : `<div class="cell-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-ban="${u._id}" data-to="${!u.banned}">${u.banned ? 'Restore' : 'Suspend'}</button>
          <button class="btn btn-danger btn-sm" type="button" data-del-user="${u._id}">Delete</button></div>`}</td>
      </tr>`).join('') || `<tr><td colspan="8">${emptyState('No accounts match')}</td></tr>`}</tbody>`;
  }

  /* ---------- Messages: reply, archive, restore (never delete) ---------- */
  $$('[data-mfilter]').forEach((c) => c.addEventListener('click', () => {
    state.msgFilter = c.dataset.mfilter;
    $$('[data-mfilter]').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    renderMessages();
  }));
  const MBOX = {
    inbox: (m) => !m.archived,
    new: (m) => !m.archived && m.status === 'new',
    archived: (m) => m.archived,
  };
  const MEMPTY = {
    inbox: ['Inbox zero', 'Archived messages are under Archived.'],
    new: ['Every message has a reply', 'New messages from the contact form appear here.'],
    archived: ['Nothing archived', 'Archive a message once it is dealt with. You can restore it at any time.'],
  };
  function messageHtml(m) {
    const replying = state.replying === m._id;
    const sender = m.hasAccount
      ? `<span class="tag tag-green" title="Reads replies under Account → Messages">${ICONS.user}Has an account</span>`
      : '<span class="tag" title="Not logged in when sending: also reply by email">Visitor</span>';
    return `<li class="card st-${m.archived ? 'archived' : m.status}" id="msg-${m._id}">
      <div class="row between"><div class="row" style="gap:8px"><span class="tag tag-blue">${esc(CONTACT_TOPICS[m.topic] || m.topic)}</span><strong>${esc(m.name)}</strong>${sender}
        ${m.archived ? `<span class="tag">${ICONS.archive}Archived ${m.archivedAt ? formatDate(m.archivedAt) : ''}</span>` : m.status === 'new' ? '<span class="tag tag-solid-green">New</span>' : `<span class="tag tag-green">${ICONS.check}Replied</span>`}</div>
        <time class="muted small" datetime="${m.createdAt}" title="${formatDateTime(m.createdAt)}">${timeAgo(m.createdAt)}</time></div>
      <p style="white-space:pre-line">${esc(m.message)}</p>
      <div class="row small"><a href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: your message to the PVO')}">${esc(m.email)}</a>${m.phone ? `<span class="muted">${esc(m.phone)}</span>` : ''}</div>
      ${(m.replies || []).map((r) => `<div class="thread-msg thread-staff"><span class="thread-who">${ICONS.reply}${esc(r.byName || 'PVO staff')} replied <time datetime="${r.createdAt}">${formatDateTime(r.createdAt)}</time></span><p>${esc(r.text)}</p></div>`).join('')}
      ${replying ? `<form class="reply-form stack-sm" data-reply-form="${m._id}" novalidate>
          <label class="field"><span>Reply to ${esc(m.name.split(' ')[0])}</span><textarea class="input" name="text" maxlength="2000" required placeholder="Write your answer…"></textarea><small class="field-error"></small></label>
          <p class="muted small" style="margin:0">${m.hasAccount ? 'They will see this under Account → Messages.' : 'This sender has no account: the reply is saved here, so also send it by email.'}</p>
          <div class="row"><button class="btn btn-primary btn-sm" type="submit">${ICONS.send}Send reply</button><button class="btn btn-ghost btn-sm" type="button" data-cancel-reply>Cancel</button></div>
        </form>` : ''}
      <div class="row">
        ${!replying && !m.archived ? `<button class="btn ${m.status === 'new' ? 'btn-primary' : 'btn-soft'} btn-sm" type="button" data-reply-msg="${m._id}">${ICONS.reply}${m.replies?.length ? 'Reply again' : 'Reply'}</button>` : ''}
        ${m.archived
          ? `<button class="btn btn-ghost btn-sm" type="button" data-archive-msg="${m._id}" data-to="false">${ICONS.restore}Restore to inbox</button>`
          : `<button class="btn btn-ghost btn-sm" type="button" data-archive-msg="${m._id}" data-to="true">${ICONS.archive}Archive</button>`}
      </div></li>`;
  }
  function renderMessages() {
    Object.entries(MBOX).forEach(([k, f]) => {
      const n = state.messages.filter(f).length;
      const el = $(`[data-mcount="${k}"]`);
      if (el) el.textContent = n || '';
    });
    const list = state.messages.filter(MBOX[state.msgFilter]);
    const [title, text] = MEMPTY[state.msgFilter];
    $('#messages-list').innerHTML = list.map(messageHtml).join('') || `<li>${emptyState(title, text)}</li>`;
    if (state.replying) $(`[data-reply-form="${state.replying}"] textarea`)?.focus();
  }
  $('#messages-list').addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-reply-form]');
    if (!form) return;
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (text.length < 2) return showFieldErrors(form, { text: 'Write a reply first.' });
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Sending…');
    try {
      await api(`/contact/${form.dataset.replyForm}/replies`, { method: 'POST', body: { text } });
      state.replying = null;
      toast('Reply sent. The message is marked replied.');
      await loadAll();
    } catch (err) {
      showFieldErrors(form, err.details || { text: err.message });
      setBusy(btn, false);
    }
  });

  /* ---------- One click handler for every action ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !$('#console').contains(b) && !$('#case-dialog').contains(b)) return;
    const d = b.dataset;
    const pet = (id) => state.pets.find((p) => p._id === id);

    if (d.openReport) openCase(d.openReport);
    if (d.gotoPending !== undefined) { $('#pet-reg').value = 'pending'; renderPets(); location.hash = 'pets'; }
    if (d.verify) act(() => api(`/pets/${d.verify}/verify`, { method: 'PATCH', body: { verified: true } }), `${pet(d.verify).name}'s registration verified.`);
    if (d.vax) openVax(pet(d.vax));
    if (d.delPet && armed(b, 'Delete?')) act(() => api(`/pets/${d.delPet}`, { method: 'DELETE' }), 'Pet removed.');
    if (d.editAnn) openAnnouncement(state.anns.find((a) => a._id === d.editAnn));
    if (d.delAnn && armed(b, 'Delete?')) act(() => api(`/announcements/${d.delAnn}`, { method: 'DELETE' }), 'Announcement deleted.');
    if (d.ban && (d.to === 'false' || armed(b, 'Confirm'))) {
      act(() => api(`/users/${d.ban}/ban`, { method: 'PATCH', body: { banned: d.to === 'true' } }), d.to === 'true' ? 'Account suspended. They can no longer log in.' : 'Account restored.');
    }
    if (d.delUser && armed(b, 'Delete all?')) act(() => api(`/users/${d.delUser}`, { method: 'DELETE' }), 'Account deleted.');
    if (d.replyMsg) { state.replying = d.replyMsg; renderMessages(); }
    if (d.cancelReply !== undefined) { state.replying = null; renderMessages(); }
    if (d.archiveMsg) {
      const archive = d.to === 'true';
      act(() => api(`/contact/${d.archiveMsg}`, { method: 'PATCH', body: { archived: archive } }), archive ? 'Message archived. Find it under Archived.' : 'Message restored to the inbox.');
    }
  });

  loadAll();
}
