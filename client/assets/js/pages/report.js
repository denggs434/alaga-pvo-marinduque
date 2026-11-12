/**
 * Online report form: animal bite, missing pet, stray/abandoned, welfare concern.
 * Requires a pet-owner account (so the reporter can track the status).
 * Supports report.html?type=missing&pet=<id> links from a pet's profile.
 */
import { api } from '../api.js';
import { isAdmin } from '../store.js';
import { REPORT_TYPES, MUNICIPALITIES, SITE } from '../config.js';
import { initPage, requireLogin, toast, setBusy, showFieldErrors, options, createPhotoPicker, emptyState, toDateTimeInput, fromDateTimeInput, esc, ICONS, $ } from '../ui.js';

initPage('report');
$('#hotline').textContent = SITE.hotline;

const PLACEHOLDER = {
  bite: 'What animal bit or scratched whom, where on the body, and what was done (wound washed, went to a bite center). Is the animal someone\'s pet? Where is it now?',
  missing: 'Name, colour, size, collar or tags, how and where your pet got lost, and anything that will help people recognise it.',
  stray: 'How many animals, what they look like, how long they have been there, and whether any look sick, injured or aggressive.',
  welfare: 'What you saw, how often it happens, and the condition of the animal. Please do not confront the owner yourself.',
};

const form = $('#report-form');
const params = new URLSearchParams(location.search);
const user = requireLogin('Log in or create a free account to file a report and track its status.');

if (user && isAdmin()) {
  $('#report-root').innerHTML = emptyState('Reports are filed by pet owners', 'PVO staff manage reports from the admin console.', '<a class="btn btn-primary" href="admin.html#reports">Open reports</a>');
} else if (user) {
  boot();
}

async function boot() {
  const f = form.elements;
  $('#types').innerHTML = Object.entries(REPORT_TYPES).map(([k, t]) =>
    `<label class="choice"><input type="radio" name="type" value="${k}" required>${ICONS[t.icon]}<strong>${t.label}</strong><small>${t.hint}</small></label>`).join('');
  f.municipality.innerHTML = options(MUNICIPALITIES, user.municipality || '', 'Choose…');
  f.barangay.value = user.barangay || '';
  f.name.value = user.name;
  f.phone.value = user.phone || '';
  f.email.value = user.email || '';
  const now = new Date(Date.now() - 60e3);
  f.incidentDate.max = toDateTimeInput(new Date());
  f.incidentDate.value = toDateTimeInput(now);
  const picker = createPhotoPicker($('#photos'), { max: 4, label: 'Add photos' });

  // The reporter's own pets, for missing-pet reports.
  let myPets = [];
  try { myPets = await api('/pets/mine'); } catch { /* the form still works without them */ }
  $('#pet-select').innerHTML = '<option value="">A pet not registered on Alaga</option>' +
    myPets.filter((p) => p.status !== 'deceased').map((p) => `<option value="${p._id}">${esc(p.name)} (${esc(p.registrationNo)})</option>`).join('');

  function syncType() {
    const type = f.type.value;
    const missing = type === 'missing';
    $('#pet-field').hidden = !missing || !myPets.length;
    $('#alert-field').hidden = !missing;
    $('#species-field').hidden = missing && !!f.pet.value;
    $('#date-label').textContent = missing ? 'When was your pet last seen?' : 'When did it happen?';
    f.description.placeholder = PLACEHOLDER[type] || 'Describe what happened.';
  }
  form.addEventListener('change', (e) => ['type', 'pet'].includes(e.target.name) && syncType());
  f.description.addEventListener('input', () => ($('#desc-count').textContent = `${f.description.value.length} / 3000 (at least 20 characters)`));

  // Prefill from links such as report.html?type=missing&pet=<id>
  if (REPORT_TYPES[params.get('type')]) f.type.value = params.get('type');
  if (params.get('pet') && myPets.some((p) => p._id === params.get('pet'))) f.pet.value = params.get('pet');
  syncType();
  form.hidden = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errors = {};
    if (!f.type.value) errors.type = 'Choose what you are reporting.';
    if (f.description.value.trim().length < 20) errors.description = 'Add a little more detail (at least 20 characters).';
    if (!f.incidentDate.value) errors.incidentDate = 'Enter when it happened.';
    else if (new Date(fromDateTimeInput(f.incidentDate.value)) > new Date()) errors.incidentDate = 'The date cannot be in the future.';
    if (!f.municipality.value) errors.municipality = 'Choose the municipality.';
    if (!f.barangay.value.trim()) errors.barangay = 'Enter the barangay.';
    if (!f.name.value.trim()) errors.name = 'Enter a contact name.';
    if (!/^[0-9+()\s-]{7,20}$/.test(f.phone.value.trim())) errors.phone = 'Enter a mobile number we can call.';
    if (!f.confirm.checked) errors.confirm = 'Please confirm the information is true.';
    showFieldErrors(form, errors);
    $('[data-for="type"]').textContent = errors.type || '';
    $('[data-for="confirm"]').textContent = errors.confirm || '';
    if (Object.keys(errors).length) return;
    if (picker.busy) return toast('Wait for the photos to finish uploading.', 'error');

    const missing = f.type.value === 'missing';
    const body = {
      type: f.type.value,
      animalSpecies: f.animalSpecies.value,
      pet: missing && f.pet.value ? f.pet.value : undefined,
      description: f.description.value.trim(),
      incidentDate: fromDateTimeInput(f.incidentDate.value),
      location: { municipality: f.municipality.value, barangay: f.barangay.value.trim(), details: f.details.value.trim() },
      photos: picker.paths,
      contact: { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim() },
      publicAlert: missing && f.publicAlert.checked,
    };
    const btn = $('#submit');
    $('#form-error').hidden = true;
    setBusy(btn, true, 'Submitting…');
    try {
      const report = await api('/reports', { method: 'POST', body });
      showDone(report);
    } catch (err) {
      $('#form-error').textContent = err.message;
      $('#form-error').hidden = false;
      if (err.details) showFieldErrors(form, err.details);
      setBusy(btn, false);
    }
  });
}

function showDone(r) {
  $('#report-root').innerHTML = `<div class="card form-section" style="text-align:center;justify-items:center">
    <span class="record-icon" style="width:56px;height:56px">${ICONS.check}</span>
    <h2 style="font-size:1.75rem">Reference <span class="mono">${esc(r.reference)}</span></h2>
    <p class="muted" style="max-width:52ch">${r.type === 'bite'
      ? 'Bite reports are high priority. Our team will call you. If the wound is not yet treated, go to an Animal Bite Treatment Center today.'
      : 'PVO staff will review your report and post updates on its timeline. We may call you for more details.'}</p>
    ${r.publicAlert ? '<p class="notice notice-warn">Your missing-pet alert is now on the community wall.</p>' : ''}
    <div class="row" style="justify-content:center"><a class="btn btn-primary" href="account.html#reports">Track my reports</a><a class="btn btn-ghost" href="index.html">Back to the wall</a></div>
  </div>`;
  toast('Report submitted.');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
