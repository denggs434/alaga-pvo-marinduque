/**
 * Account page.
 *  - logged out: log in / create an owner account
 *  - logged in (owner):
 *      Profile  (#pets, #reports, #orders): profile card with stats, My pets, My reports
 *               (status tracking), My orders (what I bought)
 *      Messages (/messages) and the Seller Center (/seller) have their own pages
 *      Settings (#settings): your details and password
 *  - Log out lives only in the account menu in the header
 *  - PVO staff are sent to the admin console
 */
import { api } from '../api.js';
import { getUser, setSession, updateSessionUser, isAdmin } from '../store.js';
import { MUNICIPALITIES, SPECIES } from '../config.js';
import { refreshUnread } from '../nav.js';
import { initPage, toast, showFieldErrors, setBusy, options, emptyState, errorState, skeleton, esc, initials, ageText, formatDate, formatDateTime, ICONS, $ } from '../ui.js';
import { petImg, petTags, reportCard, orderCard } from '../components.js';

initPage('');

const params = new URLSearchParams(location.search);
const next = params.get('next');
/** Only same-site pages may be used as the "next" redirect (no open redirects). */
const safeNext = next && /^\/[a-z0-9/-]*(\?[\w=&%.-]*)?$/i.test(next) && !next.startsWith('//') ? next : null;

/* =========================================================================
   Logged out
   ========================================================================= */
function selectAuthTab(which) {
  const login = which === 'login';
  $('#tab-login').setAttribute('aria-selected', String(login));
  $('#tab-register').setAttribute('aria-selected', String(!login));
  $('#login-form').hidden = !login;
  $('#register-form').hidden = login;
  $('#auth-title').textContent = login ? 'Welcome back' : 'Join the pet community';
}

function afterAuth(session, message) {
  setSession(session);
  toast(message);
  if (session.user.role === 'admin') return void location.replace('/admin');
  location.replace(safeNext || '/account');
}

function showAuth() {
  $('#auth').hidden = false;
  let flash = null;
  try {
    flash = sessionStorage.getItem('alaga.flash');
    sessionStorage.removeItem('alaga.flash');
  } catch { /* storage blocked */ }
  if (flash) {
    $('#flash').textContent = flash;
    $('#flash').hidden = false;
  }
  $('#register-form').elements.municipality.innerHTML = options(MUNICIPALITIES, '', 'Choose…');
  $('#tab-login').addEventListener('click', () => selectAuthTab('login'));
  $('#tab-register').addEventListener('click', () => selectAuthTab('register'));
  if (params.get('mode') === 'register') selectAuthTab('register');

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector('[type=submit]');
    $('#login-error').hidden = true;
    setBusy(btn, true, 'Logging in…');
    try {
      const session = await api('/users/login', { method: 'POST', auth: false, body: { email: form.email.value.trim(), password: form.password.value } });
      afterAuth(session, `Welcome back, ${session.user.name.split(' ')[0]}!`);
    } catch (err) {
      $('#login-error').textContent = err.message;
      $('#login-error').hidden = false;
      setBusy(btn, false);
    }
  });

  $('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const errors = {};
    if (!form.name.value.trim()) errors.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.value.trim())) errors.email = 'Enter a valid email address.';
    if (form.phone.value.trim() && !/^[0-9+()\s-]{7,20}$/.test(form.phone.value.trim())) errors.phone = 'Enter a valid mobile number.';
    if (!form.municipality.value) errors.municipality = 'Choose your municipality.';
    if (form.password.value.length < 8) errors.password = 'Use at least 8 characters.';
    showFieldErrors(form, errors);
    $('[data-for="agree"]').textContent = form.agree.checked ? '' : 'Please agree so we can keep your records.';
    if (Object.keys(errors).length || !form.agree.checked) return;

    const btn = form.querySelector('[type=submit]');
    $('#register-error').hidden = true;
    setBusy(btn, true, 'Creating account…');
    try {
      const session = await api('/users/register', {
        method: 'POST',
        auth: false,
        body: {
          name: form.name.value.trim(), email: form.email.value.trim(), phone: form.phone.value.trim(),
          municipality: form.municipality.value, barangay: form.barangay.value.trim(), password: form.password.value,
        },
      });
      afterAuth(session, 'Account created. Welcome to Alaga!');
    } catch (err) {
      $('#register-error').textContent = err.message;
      $('#register-error').hidden = false;
      if (err.details) showFieldErrors(form, err.details);
      setBusy(btn, false);
    }
  });
}

/* =========================================================================
   Logged in
   ========================================================================= */
const TABS = ['pets', 'reports', 'orders'];
function selectTab(which) {
  TABS.forEach((t) => {
    $(`#tab-${t}`).setAttribute('aria-selected', String(t === which));
    $(`#panel-${t}`).hidden = t !== which;
  });
  history.replaceState(null, '', `#${which}`);
}

/** #settings (or the old #profile link) shows Settings; anything else shows the Profile tabs. */
function route() {
  const hash = location.hash.slice(1);
  if (hash === 'messages') return void location.replace('/messages');
  if (hash === 'shop') return void location.replace('/seller');
  const settings = hash === 'settings' || hash === 'profile';
  $('#profile-view').hidden = settings;
  $('#settings-view').hidden = !settings;
  document.title = `${settings ? 'Settings' : 'My profile'} | Alaga · PVO Marinduque`;
  if (settings) {
    if (hash === 'profile') history.replaceState(null, '', '#settings');
    window.scrollTo(0, 0);
  } else {
    selectTab(TABS.includes(hash) ? hash : 'pets');
  }
}

/* ---------- My orders: what I bought ---------- */
async function loadOrders() {
  const box = $('#my-orders');
  box.innerHTML = skeleton(2, 160);
  try {
    const orders = await api('/shop/orders/mine');
    const open = orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length;
    $('#orders-count').textContent = orders.length;
    $('#stat-orders').textContent = orders.length;
    box.innerHTML = orders.length
      ? `${open ? `<p class="muted small" style="margin:0">${open} order${open === 1 ? '' : 's'} in progress. You get a notification at every step.</p>` : ''}${orders.map((o) => orderCard(o, 'buyer')).join('')}`
      : emptyState('No orders yet', 'Food, toys, collars and more from shops around Marinduque.', '<a class="btn btn-primary" href="/market">Browse Alaga Market</a>');
  } catch (err) {
    box.innerHTML = errorState(err.message);
  }
}
$('#my-orders').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-cancel-order]');
  if (!b) return;
  if (b.dataset.armed !== 'true') {
    b.dataset.armed = 'true';
    b.textContent = 'Tap again to cancel';
    setTimeout(() => { if (b.isConnected) { b.dataset.armed = ''; b.textContent = 'Cancel order'; } }, 3500);
    return;
  }
  b.disabled = true;
  try {
    await api(`/shop/orders/${b.dataset.cancelOrder}/cancel`, { method: 'PATCH' });
    toast('Order cancelled.');
    loadOrders();
  } catch (err) {
    b.disabled = false;
    toast(err.message, 'error');
  }
});

function rabiesLine(r) {
  if (r.status === 'current') return `<span class="tag tag-green">${ICONS.shieldCheck}Rabies OK until ${formatDate(r.due)}</span>`;
  if (r.status === 'overdue') return `<span class="tag tag-amber">${ICONS.alert}Rabies booster overdue</span>`;
  return '<span class="tag">No rabies record</span>';
}

async function loadPets() {
  const box = $('#my-pets');
  box.innerHTML = skeleton(2, 96);
  try {
    const pets = await api('/pets/mine');
    $('#pets-count').textContent = pets.length;
    const ok = pets.filter((p) => p.rabies?.status === 'current').length;
    $('#stat-pets').textContent = pets.length;
    $('#stat-rabies').textContent = pets.length ? `${ok} of ${pets.length}` : '–';
    box.innerHTML = pets.map((p) => `<article class="card pet-tile">
        <a class="pet-tile-photo" href="/pets/${p._id}">${petImg(p.photos?.[0], '', p.name)}
          ${p.registrationStatus === 'pending' ? '<span class="tag tag-amber">Pending review</span>' : p.registrationStatus === 'rejected' ? '<span class="tag tag-red">Rejected</span>' : ''}</a>
        <div class="pet-tile-body">
          <div class="row" style="gap:6px;justify-content:space-between;flex-wrap:nowrap"><h3><a href="/pets/${p._id}">${esc(p.name)}</a></h3>${petTags(p)}</div>
          <span class="muted small">${esc(p.breed || SPECIES[p.species])}${p.birthDate ? ` · ${ageText(p.birthDate)}` : ''}</span>
          <span class="mono small pet-tile-reg">${esc(p.registrationNo)}</span>
          ${rabiesLine(p.rabies)}
          ${p.registrationStatus === 'rejected' ? `<p class="small" style="color:var(--bad);margin:0">PVO: ${esc(p.rejectionReason || 'Please check the details.')} Edit the pet to resubmit.</p>` : ''}
          <div class="pet-tile-actions"><a class="btn btn-ghost btn-sm" href="/pets/${p._id}#health">${ICONS.syringe}Health</a><a class="btn btn-ghost btn-sm" href="/pets/${p._id}/edit">${ICONS.edit}Edit</a></div>
        </div>
      </article>`).join('') + `<a class="pet-tile-add" href="/pets/new">${ICONS.plus}<strong>${pets.length ? 'Register another pet' : 'Register your first pet'}</strong><span>Free. You get a PVO registration number right away.</span></a>`;
  } catch (err) {
    box.innerHTML = errorState(err.message);
  }
}

async function loadReports() {
  const box = $('#my-reports');
  box.innerHTML = skeleton(2, 120);
  try {
    const reports = await api('/reports/mine');
    $('#reports-count').textContent = reports.length;
    $('#stat-reports').textContent = reports.filter((r) => !['resolved', 'closed'].includes(r.status)).length;
    box.innerHTML = reports.length
      ? reports.map(reportCard).join('')
      : emptyState('No reports filed', 'Report animal bites, missing pets, strays or welfare concerns to the PVO.', '<a class="btn btn-primary" href="/report">Report an incident</a>');
    // Open the newest open report so its timeline is visible at a glance.
    box.querySelector('.report-card details')?.setAttribute('open', '');
  } catch (err) {
    box.innerHTML = errorState(err.message);
  }
}

$('#my-reports').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-withdraw]');
  if (!b) return;
  if (b.dataset.armed !== 'true') {
    b.dataset.armed = 'true';
    b.textContent = 'Tap again to withdraw';
    setTimeout(() => { if (b.isConnected) { b.dataset.armed = ''; b.textContent = 'Withdraw'; } }, 3500);
    return;
  }
  b.disabled = true; // one request per confirm
  try {
    await api(`/reports/${b.dataset.withdraw}/withdraw`, { method: 'PATCH' });
    toast('Report withdrawn.');
    loadReports();
  } catch (err) {
    b.disabled = false;
    toast(err.message, 'error');
  }
});

function setupProfile(user) {
  const pf = $('#profile-form');
  pf.elements.municipality.innerHTML = options(MUNICIPALITIES, user.municipality || '', 'Choose…');
  pf.name.value = user.name;
  pf.phone.value = user.phone || '';
  pf.barangay.value = user.barangay || '';

  pf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = pf.querySelector('[type=submit]');
    setBusy(btn, true, 'Saving…');
    try {
      const { user: saved } = await api('/users/me', {
        method: 'PUT',
        body: { name: pf.name.value.trim(), phone: pf.phone.value.trim(), municipality: pf.municipality.value, barangay: pf.barangay.value.trim() },
      });
      updateSessionUser(saved);
      showFieldErrors(pf, {});
      paintHead(saved);
      toast('Details saved.');
    } catch (err) {
      showFieldErrors(pf, err.details || {});
      toast(err.message, 'error');
    } finally {
      setBusy(btn, false);
    }
  });

  const pw = $('#password-form');
  pw.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errors = {};
    if (!pw.currentPassword.value) errors.currentPassword = 'Enter your current password.';
    if (pw.newPassword.value.length < 8) errors.newPassword = 'Use at least 8 characters.';
    if (pw.newPassword.value !== pw.repeat.value) errors.repeat = 'The passwords do not match.';
    showFieldErrors(pw, errors);
    if (Object.keys(errors).length) return;
    const btn = pw.querySelector('[type=submit]');
    setBusy(btn, true, 'Changing…');
    try {
      const { user: saved, token } = await api('/users/me', { method: 'PUT', body: { currentPassword: pw.currentPassword.value, newPassword: pw.newPassword.value } });
      updateSessionUser(saved, token);
      pw.reset();
      toast('Password changed. Other devices were logged out.');
    } catch (err) {
      showFieldErrors(pw, err.details || {});
      toast(err.message, 'error');
    } finally {
      setBusy(btn, false);
    }
  });
}

function paintHead(user) {
  // The site header was drawn at load; keep its avatar and menu in step with a renamed profile.
  const headAvatar = $('#account-btn .avatar');
  if (headAvatar) headAvatar.textContent = initials(user.name);
  const headName = $('#account-menu .popover-head strong');
  if (headName) headName.textContent = user.name;
  $('#dash-avatar').textContent = initials(user.name);
  $('#dash-name').textContent = user.name;
  $('#dash-who').innerHTML = [user.municipality && `${ICONS.pin}${esc([user.barangay, user.municipality].filter(Boolean).join(', '))}`, `${ICONS.calendar}Member since ${formatDate(user.createdAt)}`].filter(Boolean).map((x) => `<span>${x}</span>`).join('');
  $('#settings-link').innerHTML = ICONS.gear;
  $('#settings-who').textContent = `Signed in as ${user.email}`;
}

async function showDashboard() {
  let user;
  try {
    user = await api('/users/me'); // confirms the token is still valid
  } catch (err) {
    // 401 means the session ended (api() already cleared it): show the login form.
    // Anything else (server down, offline) keeps the session and offers a retry.
    if (err.status === 401) return showAuth();
    $('main').innerHTML = `<div class="wrap" style="padding-block:48px">${errorState(err.message)}</div>`;
    return;
  }
  updateSessionUser(user);
  if (user.role === 'admin') return void location.replace('/admin');
  $('#dashboard').hidden = false;
  paintHead(user);
  TABS.forEach((t) => $(`#tab-${t}`).addEventListener('click', () => selectTab(t)));
  route();
  addEventListener('hashchange', route);
  setupProfile(user);
  loadPets();
  loadReports();
  loadOrders();
}

/* ---------- Boot ---------- */
if (isAdmin()) location.replace('/admin');
else if (getUser()) showDashboard();
else showAuth();
