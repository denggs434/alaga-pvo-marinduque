/**
 * Pet profile: pet.html?id=<id>
 *  - everyone: photos, facts, rabies status, owner's public name, the pet's posts
 *  - owner / PVO: health records (vaccinations, medical history) + edit actions
 *  - PVO: verify the registration and vaccinations
 */
import { api, qs } from '../api.js';
import { isAdmin } from '../store.js';
import { SPECIES, MEDICAL_TYPES, VACCINES } from '../config.js';
import {
  initPage, toast, armed, setupModal, showFieldErrors, setBusy, options, emptyState, errorState, skeleton,
  esc, ageText, formatDate, toDateInput, fromDateInput, ICONS, $, $$,
} from '../ui.js';
import { petImg, sexIcon, petTags, petSubtitle, rabiesBox, createPostList } from '../components.js';

initPage('pets');

const id = new URLSearchParams(location.search).get('id');
const root = $('#profile');
let pet;

/* ---------- Profile ---------- */
function gallery(p) {
  const photos = p.photos || [];
  return `<div class="gallery">
    <div class="gallery-main">${petImg(photos[0], '', `${p.name}, ${p.breed || SPECIES[p.species]}`)}</div>
    ${photos.length > 1 ? `<div class="gallery-thumbs" role="group" aria-label="Photos">${photos.map((src, i) => `<button type="button" data-photo="${i}" aria-pressed="${i === 0}" aria-label="Photo ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join('')}</div>` : ''}
  </div>`;
}

function ownerActions(p) {
  if (!p.canEdit) return '';
  const staff = isAdmin();
  return `<div class="row">
    <a class="btn btn-primary btn-sm" href="pet-form.html?id=${p._id}">${ICONS.edit}Edit profile</a>
    ${!staff && p.status !== 'missing' ? `<a class="btn btn-ghost btn-sm" href="report.html?type=missing&pet=${p._id}">${ICONS.search}Report missing</a>` : ''}
    ${staff ? `<button class="btn btn-soft btn-sm" type="button" id="verify-btn">${p.registrationStatus === 'verified' ? 'Mark as pending' : `${ICONS.check}Verify registration`}</button>` : ''}
    <button class="btn btn-danger btn-sm" type="button" id="delete-btn">${ICONS.trash}Delete</button>
  </div>`;
}

function renderProfile(p) {
  document.title = `${p.name} | Alaga · PVO Marinduque`;
  const facts = [
    ['Species', SPECIES[p.species]],
    ['Breed', p.breed || 'Not specified'],
    ['Sex', p.sex === 'male' ? 'Male' : 'Female'],
    ['Age', p.birthDate ? `${ageText(p.birthDate)} (born ${formatDate(p.birthDate)})` : 'Unknown'],
    ['Colour', p.color || '—'],
    ['Spayed / neutered', p.neutered ? 'Yes' : 'No'],
    ['Registration no.', p.registrationNo],
    ['Registered', formatDate(p.createdAt)],
  ];
  root.innerHTML = `
    <p class="small" style="margin-top:20px"><a href="pets.html">Pets</a> / ${esc(p.name)}</p>
    ${p.status === 'missing' ? `<p class="notice notice-warn" style="margin-top:12px"><b>${esc(p.name)} is missing.</b> If you have seen this pet, please call the PVO or message us from the <a href="contact.html">contact page</a>.</p>` : ''}
    ${p.isPublic === false ? `<p class="notice" style="margin-top:12px">This profile is <b>private</b>: only the owner and PVO staff can see it.</p>` : ''}
    <div class="profile-hero">
      ${gallery(p)}
      <div class="card profile-card">
        <div class="row" style="gap:6px">${petTags(p)}${p.registrationStatus === 'pending' ? '<span class="tag tag-amber">Registration pending</span>' : ''}</div>
        <h1>${esc(p.name)} ${sexIcon(p.sex)}</h1>
        <p class="muted" style="margin-top:-8px">${esc(petSubtitle(p))} · ${esc(p.municipality)}</p>
        ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
        ${rabiesBox(p.rabies)}
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <div class="owner-line">${ICONS.user}<span>Owner: <b>${esc(p.owner.name)}</b> · ${esc(p.owner.municipality || p.municipality)}
          ${p.owner.email ? `<br><span class="small muted">${esc(p.owner.email)}${p.owner.phone ? ` · ${esc(p.owner.phone)}` : ''}${p.owner.barangay ? ` · Brgy. ${esc(p.owner.barangay)}` : ''}</span>` : ''}</span></div>
        ${ownerActions(p)}
      </div>
    </div>`;

  // Gallery thumbnails
  root.querySelector('.gallery-thumbs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-photo]');
    if (!b) return;
    root.querySelector('.gallery-main').innerHTML = petImg(p.photos[b.dataset.photo], '', p.name);
    $$('[data-photo]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  });

  $('#delete-btn')?.addEventListener('click', async (e) => {
    if (!armed(e.currentTarget, `Delete ${p.name} for good?`)) return;
    try {
      await api(`/pets/${p._id}`, { method: 'DELETE' });
      toast(`${p.name}'s profile was removed.`);
      setTimeout(() => (location.href = isAdmin() ? 'admin.html#pets' : 'account.html'), 600);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('#verify-btn')?.addEventListener('click', async () => {
    try {
      pet = await api(`/pets/${p._id}/verify`, { method: 'PATCH', body: { verified: p.registrationStatus !== 'verified' } });
      toast(pet.registrationStatus === 'verified' ? 'Registration verified.' : 'Registration set to pending.');
      render();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* ---------- Health records (owner / PVO) ---------- */
function renderHealth(p) {
  $('#vax-list').innerHTML = p.vaccinations.length
    ? p.vaccinations.map((v) => `<li class="record">
        <span class="record-icon">${ICONS.syringe}</span>
        <div><strong>${esc(v.vaccine)}</strong>
          <p>Given ${formatDate(v.dateGiven)}${v.administeredBy ? ` by ${esc(v.administeredBy)}` : ''}${v.nextDue ? ` · next due ${formatDate(v.nextDue)}` : ''}</p></div>
        <div class="record-side">
          ${v.verified ? `<span class="tag tag-green">${ICONS.shieldCheck}PVO verified</span>` : '<span class="tag">Owner entry</span>'}
          ${isAdmin() && !v.verified ? `<button class="btn btn-soft btn-sm" type="button" data-verify-vax="${v._id}">Verify</button>` : ''}
          ${isAdmin() || !v.verified ? `<button class="btn btn-danger btn-sm" type="button" data-del-vax="${v._id}" aria-label="Delete ${esc(v.vaccine)} record">${ICONS.trash}</button>` : ''}
        </div></li>`).join('')
    : `<li>${emptyState('No vaccinations recorded', 'Add shots given at a clinic, or join a free PVO drive.')}</li>`;

  $('#med-list').innerHTML = p.medicalHistory.length
    ? p.medicalHistory.map((m) => `<li class="record">
        <span class="record-icon">${ICONS.stethoscope}</span>
        <div><strong>${esc(m.title)}</strong> <span class="tag">${esc(MEDICAL_TYPES[m.type] || m.type)}</span>
          <p>${formatDate(m.date)}${m.vet ? ` · ${esc(m.vet)}` : ''}</p>${m.notes ? `<p style="color:var(--ink-2)">${esc(m.notes)}</p>` : ''}</div>
        <div class="record-side"><button class="btn btn-danger btn-sm" type="button" data-del-med="${m._id}" aria-label="Delete record">${ICONS.trash}</button></div></li>`).join('')
    : `<li>${emptyState('No medical history yet', 'Check-ups, illnesses, surgeries and deworming go here.')}</li>`;
}

$('#panel-health').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  try {
    if (d.verifyVax) pet = await api(`/pets/${id}/vaccinations/${d.verifyVax}/verify`, { method: 'PATCH' });
    else if (d.delVax && armed(b, 'Delete?')) pet = await api(`/pets/${id}/vaccinations/${d.delVax}`, { method: 'DELETE' });
    else if (d.delMed && armed(b, 'Delete?')) pet = await api(`/pets/${id}/medical/${d.delMed}`, { method: 'DELETE' });
    else return;
    toast('Health record updated.');
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/** Open a record dialog and submit it to the given endpoint. */
function recordDialog(dialog, form, errorBox, endpoint, read) {
  setupModal(dialog);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const body = read(form.elements);
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Saving…');
    try {
      pet = await api(`/pets/${id}/${endpoint}`, { method: 'POST', body });
      dialog.close();
      toast('Record added.');
      render();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      if (err.details) showFieldErrors(form, Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k.split('.').pop(), v])));
    } finally {
      setBusy(btn, false);
    }
  });
}

const today = toDateInput(new Date());
$('#vaccine-list').innerHTML = options(VACCINES);
$('#med-type').innerHTML = options(MEDICAL_TYPES, 'checkup');
recordDialog($('#vax-dialog'), $('#vax-form'), $('#vax-error'), 'vaccinations', (f) => ({
  vaccine: f.vaccine.value.trim(), dateGiven: fromDateInput(f.dateGiven.value), nextDue: fromDateInput(f.nextDue.value), administeredBy: f.administeredBy.value.trim(),
}));
recordDialog($('#med-dialog'), $('#med-form'), $('#med-error'), 'medical', (f) => ({
  date: fromDateInput(f.date.value), type: f.type.value, title: f.title.value.trim(), notes: f.notes.value.trim(), vet: f.vet.value.trim(),
}));
$('#add-vax').addEventListener('click', () => {
  const f = $('#vax-form');
  f.reset();
  showFieldErrors(f, {});
  f.elements.dateGiven.max = today;
  f.elements.dateGiven.value = today;
  $('#vax-note').textContent = isAdmin() ? 'Saved as PVO verified.' : 'Your entry is marked "Owner entry" until the PVO verifies it at your next visit.';
  $('#vax-dialog').showModal();
});
$('#add-med').addEventListener('click', () => {
  const f = $('#med-form');
  f.reset();
  showFieldErrors(f, {});
  f.elements.date.max = today;
  f.elements.date.value = today;
  $('#med-dialog').showModal();
});

/* ---------- Tabs ---------- */
function selectTab(which) {
  ['posts', 'health'].forEach((t) => {
    $(`#tab-${t}`).setAttribute('aria-selected', String(t === which));
    $(`#panel-${t}`).hidden = t !== which;
  });
  history.replaceState(null, '', `${location.pathname}${location.search}${which === 'health' ? '#health' : ''}`);
}
$('#tab-posts').addEventListener('click', () => selectTab('posts'));
$('#tab-health').addEventListener('click', () => selectTab('health'));

/* ---------- Posts ---------- */
let postPage = 1;
const postList = createPostList($('#pet-posts'), { onEmpty: () => ($('#pet-posts').innerHTML = emptyState(`No posts about ${pet.name}`)) });
async function loadPosts() {
  $('#posts-more').innerHTML = '';
  if (postPage === 1) $('#pet-posts').innerHTML = skeleton(2, 200);
  try {
    const data = await api(`/posts${qs({ pet: id, page: postPage, limit: 6 })}`);
    if (postPage === 1) $('#pet-posts').innerHTML = '';
    if (!data.items.length && postPage === 1) {
      $('#pet-posts').innerHTML = emptyState(`No posts about ${pet.name}`, pet.canEdit && !isAdmin() ? 'Share photos and updates on the community wall.' : '', pet.canEdit && !isAdmin() ? '<a class="btn btn-primary" href="index.html">Go to the wall</a>' : '');
      return;
    }
    postList.append(data.items);
    if (data.page < data.pages) {
      $('#posts-more').innerHTML = '<button class="btn btn-ghost" type="button">Load more</button>';
      $('#posts-more button').addEventListener('click', () => { postPage += 1; loadPosts(); });
    }
  } catch (err) {
    $('#pet-posts').innerHTML = errorState(err.message);
  }
}

/* ---------- Boot ---------- */
let postCount = 0;
function render() {
  // Update responses (verify, health records) do not include postCount: keep the last known one.
  if (pet.postCount !== undefined) postCount = pet.postCount;
  renderProfile(pet);
  $('#post-count').textContent = postCount;
  if (pet.canEdit) {
    $('#tab-health').hidden = false;
    renderHealth(pet);
  }
}

async function boot() {
  if (!id) {
    root.innerHTML = emptyState('No pet selected', '', '<a class="btn btn-primary" href="pets.html">Browse pets</a>');
    return;
  }
  try {
    pet = await api(`/pets/${encodeURIComponent(id)}`);
    $('#tabs-wrap').hidden = false;
    render();
    if (location.hash === '#health' && pet.canEdit) selectTab('health');
    loadPosts();
  } catch (err) {
    root.innerHTML = `<div style="margin-top:32px">${emptyState(err.status === 404 ? 'Pet not found' : 'Could not load this pet', err.message, '<a class="btn btn-primary" href="pets.html">Browse pets</a>')}</div>`;
  }
}
boot();
