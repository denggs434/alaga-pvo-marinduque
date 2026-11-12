/**
 * Shared UI: page bootstrap, footer, toasts, form helpers, dialogs and the
 * photo picker. The header lives in nav.js, scroll animation in motion.js.
 * Every public page calls initPage(); the admin console calls initAdminPage().
 */
import { apiUpload } from './api.js';
import { getUser } from './store.js';
import { SITE } from './config.js';
import { esc, $, $$ } from './format.js';
import { ICONS, BRAND_MARK } from './icons.js';
import { renderHeader } from './nav.js';
import { initMotion } from './motion.js';

export * from './format.js';
export { ICONS, BRAND_MARK } from './icons.js';

// Apply a saved theme as early as possible to avoid a flash of the wrong theme.
try {
  const saved = localStorage.getItem('alaga.theme');
  if (saved) document.documentElement.dataset.theme = saved;
} catch { /* ignore */ }

/* ---------- Footer ---------- */
function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="wrap footer-grid">
      <div class="stack-sm">
        <a class="brand" href="index.html">${BRAND_MARK}<span class="brand-word">${SITE.name}<small>${SITE.office}</small></span></a>
        <p class="muted">The pet community of ${SITE.province}: register your pets, keep their health records, stay updated on vaccination drives and report animal incidents to the PVO.</p>
      </div>
      <div>
        <h4>Community</h4>
        <ul>
          <li><a href="index.html">Community wall</a></li>
          <li><a href="pets.html">Browse pets</a></li>
          <li><a href="pet-form.html">Register a pet</a></li>
          <li><a href="announcements.html">Announcements</a></li>
        </ul>
      </div>
      <div>
        <h4>PVO</h4>
        <ul>
          <li><a href="services.html">Services</a></li>
          <li><a href="report.html">Report an incident</a></li>
          <li><a href="about.html">About the office</a></li>
          <li><a href="contact.html">Contact us</a></li>
        </ul>
      </div>
      <div>
        <h4>Visit us</h4>
        <ul class="muted">
          <li>${SITE.address}</li>
          <li>${SITE.hours}</li>
          <li>Tel. ${SITE.phone}</li>
          <li>Animal bite hotline ${SITE.hotline}</li>
        </ul>
      </div>
    </div>
    <div class="wrap footer-base">
      <span>© ${new Date().getFullYear()} ${SITE.name}. A student project; not an official government website. Names, records and contact numbers are samples.</span>
      <span><a href="about.html#credits">Photo credits</a> · <a href="about.html#privacy">Privacy</a></span>
    </div>`;
  document.body.append(footer);
}

/* ---------- Page bootstrap ---------- */
export function initPage(active) {
  const main = $('main');
  if (main && !main.id) main.id = 'main';
  document.body.insertAdjacentHTML('afterbegin', '<a class="skip-link" href="#main">Skip to content</a>');
  renderHeader(active);
  document.body.prepend($('.skip-link')); // keep it first in tab order
  renderFooter();
  initMotion();
}

export function initAdminPage() {
  const main = $('main');
  if (main && !main.id) main.id = 'main';
  document.body.classList.add('admin-body');
  initMotion();
}

/** Send visitors to the login page and back here afterwards. Returns the user or null. */
export function requireLogin(message = 'Please log in first.') {
  const user = getUser();
  if (user) return user;
  const next = location.pathname.split('/').pop() + location.search;
  try { sessionStorage.setItem('alaga.flash', message); } catch { /* storage blocked: skip the message */ }
  location.replace(`account.html?next=${encodeURIComponent(next || 'index.html')}`);
  return null;
}

/* ---------- Toasts ---------- */
export function toast(message, type = 'info') {
  let host = $('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  host.append(el);
  setTimeout(() => el.remove(), 4000);
}

/* ---------- States ---------- */
export const skeleton = (n = 3, height = 120) =>
  Array.from({ length: n }, () => `<div class="skeleton" style="height:${height}px"></div>`).join('');

export function emptyState(title, text = '', action = '') {
  return `<div class="empty">${ICONS.paw}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}

export function errorState(message) {
  return `<div class="empty">${ICONS.alert}<h3>Could not load this</h3><p>${esc(message)}</p>
    <button class="btn btn-ghost" type="button" data-reload>Try again</button></div>`;
}
document.addEventListener('click', (e) => e.target.closest('[data-reload]') && location.reload());

/* ---------- Forms ---------- */

/** Show server-side field errors next to inputs (matching by name, e.g. "location.barangay" -> "barangay"). */
export function showFieldErrors(form, details = {}) {
  $$('.field-error', form).forEach((el) => (el.textContent = ''));
  $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  let first;
  Object.entries(details).forEach(([name, msg]) => {
    const input = form.elements[name] || form.elements[name.split('.').pop()];
    if (!input || !input.closest) return;
    input.setAttribute('aria-invalid', 'true');
    first ||= input;
    const slot = input.closest('.field')?.querySelector('.field-error');
    if (slot) slot.textContent = msg;
  });
  first?.focus?.();
}

export function setBusy(button, busy, busyLabel) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    if (button.dataset.label) button.innerHTML = button.dataset.label;
    button.disabled = false;
  }
}

/** <option> list from an array or a { value: label } map. */
export function options(list, selected = '', placeholder = '') {
  const entries = Array.isArray(list) ? list.map((v) => [v, v]) : Object.entries(list).map(([v, l]) => [v, typeof l === 'object' ? l.label : l]);
  return (placeholder ? `<option value="">${esc(placeholder)}</option>` : '') +
    entries.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(l)}</option>`).join('');
}

/** Two-step confirm built into a button (no browser dialogs). Returns true on the second press. */
export function armed(btn, label = 'Tap again to confirm') {
  if (btn.dataset.armed === 'true') return true;
  btn.dataset.armed = 'true';
  const original = btn.innerHTML;
  btn.textContent = label;
  btn.classList.add('is-armed');
  setTimeout(() => {
    if (!btn.isConnected) return;
    btn.dataset.armed = '';
    btn.innerHTML = original;
    btn.classList.remove('is-armed');
  }, 3500);
  return false;
}

/** Wire a <dialog class="modal">: [data-close] buttons and clicks on the backdrop close it. */
export function setupModal(dialog) {
  if (dialog.dataset.bound) return dialog;
  dialog.dataset.bound = '1';
  $$('[data-close]', dialog).forEach((b) => b.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  return dialog;
}

/* ---------- Photo picker ---------- */
const MAX_PHOTO = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * A grid of photo tiles plus an "add" tile. Photos upload as soon as they are
 * chosen (POST /api/uploads) and the picker keeps the returned paths.
 *   const picker = createPhotoPicker(el, { max: 6, label: 'Add photos', main: true });
 *   picker.paths            -> ['assets/img/uploads/…']
 *   picker.set([...])       -> show existing photos
 *   picker.busy             -> true while an upload is running
 */
export function createPhotoPicker(root, { max = 1, label = 'Add photo', main = false, onChange = () => {} } = {}) {
  let paths = [];
  let uploading = 0;
  root.classList.add('photo-picker');

  function render() {
    root.innerHTML =
      paths.map((p, i) => `<div class="photo-tile">
        <img src="${esc(p)}" alt="Photo ${i + 1}">
        ${main && i === 0 && paths.length > 1 ? '<span class="main-flag">Main</span>' : ''}
        <div class="photo-actions">
          ${main && i > 0 ? `<button type="button" data-main="${i}" aria-label="Make photo ${i + 1} the main photo" title="Make main photo">${ICONS.star}</button>` : ''}
          <button type="button" data-remove="${i}" aria-label="Remove photo ${i + 1}" title="Remove">${ICONS.trash}</button>
        </div>
      </div>`).join('') +
      Array.from({ length: uploading }, () => '<div class="photo-tile is-uploading skeleton"></div>').join('') +
      (paths.length + uploading < max
        ? `<label class="photo-add">${ICONS.camera}<span>${esc(label)}</span><small class="muted">JPG, PNG, WebP · 4 MB</small>
            <input type="file" accept="image/jpeg,image/png,image/webp" ${max - paths.length > 1 ? 'multiple' : ''}></label>`
        : '');
  }

  async function add(files) {
    const room = max - paths.length - uploading;
    const list = [...files].slice(0, room);
    if (files.length > room) toast(`You can add ${room} more photo${room === 1 ? '' : 's'}.`, 'error');
    for (const file of list) {
      if (!TYPES.includes(file.type)) { toast('Choose a JPG, PNG or WebP photo.', 'error'); continue; }
      if (file.size > MAX_PHOTO) { toast(`${file.name} is over 4 MB. Choose a smaller photo.`, 'error'); continue; }
      uploading += 1;
      render();
      try {
        const { path } = await apiUpload('/uploads', file);
        paths.push(path);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        uploading -= 1;
        render();
        onChange(paths);
      }
    }
  }

  root.addEventListener('change', (e) => {
    if (e.target.type === 'file') add(e.target.files);
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.remove) paths.splice(Number(b.dataset.remove), 1);
    if (b.dataset.main) paths.unshift(...paths.splice(Number(b.dataset.main), 1));
    render();
    onChange(paths);
  });
  // Drag and drop onto the "add" tile.
  root.addEventListener('dragover', (e) => { e.preventDefault(); $('.photo-add', root)?.classList.add('is-over'); });
  root.addEventListener('dragleave', () => $('.photo-add', root)?.classList.remove('is-over'));
  root.addEventListener('drop', (e) => { e.preventDefault(); $('.photo-add', root)?.classList.remove('is-over'); add(e.dataTransfer.files); });

  render();
  return {
    get paths() { return [...paths]; },
    get busy() { return uploading > 0; },
    set(list = []) { paths = [...list]; render(); },
  };
}
