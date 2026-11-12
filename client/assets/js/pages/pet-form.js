/**
 * Register a pet (pet-form.html) or edit one (pet-form.html?id=<id>).
 * Owners register their own pets; PVO staff can edit any pet.
 */
import { api } from '../api.js';
import { getUser, isAdmin } from '../store.js';
import { SPECIES, SPECIES_ICON, MUNICIPALITIES } from '../config.js';
import { breedsFor } from '../breeds.js';
import { initPage, requireLogin, toast, setBusy, showFieldErrors, options, createPhotoPicker, emptyState, toDateInput, fromDateInput, ICONS, $ } from '../ui.js';

initPage('pets');


const form = $('#pet-form');
const id = new URLSearchParams(location.search).get('id');
const user = requireLogin(id ? 'Log in to edit this pet.' : 'Log in or create an account to register your pet.');

if (user && isAdmin()) {
  // Staff accounts do not own pets and never edit an owner's details: they review them.
  $('main').innerHTML = id
    ? emptyState("PVO staff can't edit pet details", "The owner's submitted information stays as they entered it. Review it and approve or reject the registration in the admin console.", '<a class="btn btn-primary" href="admin.html#pets">Open the pets list</a>')
    : emptyState('PVO staff accounts do not register pets', 'Owners register their pets from their own accounts. Review registrations in the admin console.', '<a class="btn btn-primary" href="admin.html#pets">Open the pets list</a>');
} else if (user) {
  boot();
}

/** Breed suggestions follow the chosen species, A to Z. */
const BREED_HINT = { dog: 'e.g. Aspin, Shih Tzu, Labrador Retriever', cat: 'e.g. Puspin, Persian, Siamese', rabbit: 'e.g. Holland Lop, Netherland Dwarf', bird: 'e.g. Lovebird, Cockatiel, Budgerigar', other: 'e.g. Guinea Pig, Hamster, Turtle' };
function fillBreeds() {
  const species = form.elements.species.value;
  $('#breeds').innerHTML = options(breedsFor(species));
  form.elements.breed.placeholder = species ? `${BREED_HINT[species] || ''} · type to see more` : 'Choose a species first to see breed suggestions';
}

function setupFields() {
  $('#species').innerHTML = Object.entries(SPECIES).map(([k, label]) =>
    `<label class="choice"><input type="radio" name="species" value="${k}" required>${ICONS[SPECIES_ICON[k]]}<strong>${label}</strong></label>`).join('');
  form.elements.municipality.innerHTML = options(MUNICIPALITIES, user.municipality || '', 'Choose…');
  form.elements.birthDate.max = toDateInput(new Date());
  form.addEventListener('change', (e) => e.target.name === 'species' && fillBreeds());
  fillBreeds();
  form.elements.bio.addEventListener('input', () => ($('#bio-count').textContent = `${form.elements.bio.value.length} / 500`));
}

function fill(p) {
  const f = form.elements;
  f.name.value = p.name;
  f.species.value = p.species;
  f.breed.value = p.breed || '';
  f.color.value = p.color || '';
  f.sex.value = p.sex;
  f.birthDate.value = toDateInput(p.birthDate);
  f.municipality.value = p.municipality;
  f.neutered.checked = !!p.neutered;
  f.bio.value = p.bio || '';
  f.isPublic.checked = p.isPublic !== false;
  f.status.value = p.status;
  $('#bio-count').textContent = `${f.bio.value.length} / 500`;
  fillBreeds();
}

async function boot() {
  setupFields();
  const picker = createPhotoPicker($('#photos'), { max: 6, label: 'Add photos', main: true });

  if (id) {
    try {
      const p = await api(`/pets/${encodeURIComponent(id)}`);
      if (!p.canEdit) throw Object.assign(new Error('Only the owner or the PVO can edit this pet.'), { status: 403 });
      fill(p);
      picker.set(p.photos);
      document.title = `Edit ${p.name} | Alaga`;
      $('#form-eyebrow').textContent = `Registration no. ${p.registrationNo}, ${p.registrationStatus === 'verified' ? 'verified by the PVO' : p.registrationStatus === 'rejected' ? 'rejected by the PVO' : 'waiting for PVO review'}`;
      $('#form-eyebrow').hidden = false;
      $('#form-title').textContent = `Edit ${p.name}'s profile`;
      $('#form-intro').textContent = 'Changes appear on the profile and the community wall right away.';
      $('#save').textContent = 'Save changes';
      $('#cancel').href = `pet.html?id=${p._id}`;
      $('#status-field').hidden = false;
    } catch (err) {
      $('main').innerHTML = emptyState('Cannot edit this pet', err.message, '<a class="btn btn-primary" href="account.html">Back to my pets</a>');
      return;
    }
  }
  form.hidden = false;
  if (!id) form.elements.name.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const errors = {};
    if (!f.name.value.trim()) errors.name = 'Enter your pet\'s name.';
    if (!f.species.value) errors.species = 'Choose a species.';
    if (!f.sex.value) errors.sex = 'Choose male or female.';
    if (!f.municipality.value) errors.municipality = 'Choose where your pet lives.';
    showFieldErrors(form, errors);
    $('[data-for="species"]').textContent = errors.species || '';
    if (Object.keys(errors).length) return;
    if (picker.busy) return toast('Wait for the photos to finish uploading.', 'error');

    const body = {
      name: f.name.value.trim(),
      species: f.species.value,
      breed: f.breed.value.trim(),
      color: f.color.value.trim(),
      sex: f.sex.value,
      birthDate: f.birthDate.value ? fromDateInput(f.birthDate.value) : null,
      municipality: f.municipality.value,
      neutered: f.neutered.checked,
      bio: f.bio.value.trim(),
      isPublic: f.isPublic.checked,
      photos: picker.paths,
      ...(id && { status: f.status.value }),
    };
    const btn = $('#save');
    $('#form-error').hidden = true;
    setBusy(btn, true, id ? 'Saving…' : 'Registering…');
    try {
      const pet = await api(id ? `/pets/${id}` : '/pets', { method: id ? 'PUT' : 'POST', body });
      toast(id ? 'Profile saved.' : `${pet.name} is registered! Registration no. ${pet.registrationNo}`);
      setTimeout(() => (location.href = `pet.html?id=${pet._id}`), 700);
    } catch (err) {
      $('#form-error').textContent = err.message;
      $('#form-error').hidden = false;
      if (err.details) showFieldErrors(form, err.details);
      setBusy(btn, false);
    }
  });
}
