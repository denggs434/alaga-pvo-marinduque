/**
 * Account page.
 *  - logged out: log in / create an owner account
 *  - logged in (owner):
 *      Profile  (#pets, #reports, #messages): My pets, My reports (status tracking), Messages (PVO replies)
 *      Settings (#settings): your details and password
 *  - Log out lives only in the account menu in the header
 *  - PVO staff are sent to the admin console
 */
import { api } from '../api.js';
import { getUser, setSession, updateSessionUser, isAdmin } from '../store.js';
import { MUNICIPALITIES, SPECIES, CONTACT_TOPICS } from '../config.js';
import { refreshUnread } from '../nav.js';
import { initPage, toast, showFieldErrors, setBusy, options, emptyState, errorState, skeleton, esc, initials, ageText, formatDate, formatDateTime, ICONS, $ } from '../ui.js';
import { petImg, petTags, reportCard } from '../components.js';

initPage('');

const params = new URLSearchParams(location.search);
const next = params.get('next');
/** Only same-site pages may be used as the "next" redirect (no open redirects). */
const safeNext = next && /^[a-z-]+\.html(\?[\w=&%.-]*)?$/i.test(next) ? next : null;

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
  if (session.user.role === 'admin') return void location.replace('admin.html');
  location.replace(safeNext || 'account.html');
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
const TABS = ['pets', 'reports', 'messages'];
function selectTab(which) {
  TABS.forEach((t) => {
    $(`#tab-${t}`).setAttribute('aria-selected', String(t === which));
    $(`#panel-${t}`).hidden = t !== which;
  });
  history.replaceState(null, '', `#${which}`);
  if (which === 'messages') markMessagesRead();
}

/** #settings (or the old #profile link) shows Settings; anything else shows the Profile tabs. */
function route() {
  const hash = location.hash.slice(1);
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

/* ---------- Messages: what I sent the PVO, and the replies ---------- */
let unreadIds = new Set();
async function loadMessages() {
  const box = $('#my-messages');
  box.innerHTML = skeleton(2, 120);
  try {
    const list = await api('/contact/mine');
    unreadIds = new Set(list.filter((m) => m.unread).map((m) => m._id));
    $('#messages-count').textContent = unreadIds.size ? `${unreadIds.size} new` : list.length;
    $('#messages-count').classList.toggle('tag-solid-green', unreadIds.size > 0);
    box.innerHTML = list.length
      ? list.map((m) => `<article class="card thread${m.unread ? ' is-unread' : ''}">
          <header class="row between"><div class="row" style="gap:8px"><span class="tag tag-blue">${esc(CONTACT_TOPICS[m.topic] || m.topic)}</span>
            ${m.replies.length ? `<span class="tag tag-green">${ICONS.check}Replied</span>` : '<span class="tag">Waiting for a reply</span>'}${m.unread ? '<span class="tag tag-solid-green">New reply</span>' : ''}</div>
            <time class="muted small" datetime="${m.createdAt}">${formatDateTime(m.createdAt)}</time></header>
          <div class="thread-msg thread-mine"><span class="thread-who">You wrote</span><p>${esc(m.message)}</p></div>
          ${m.replies.map((r) => `<div class="thread-msg thread-staff"><span class="thread-who">${ICONS.shield}${esc(r.by)} · PVO Marinduque <time datetime="${r.createdAt}">${formatDateTime(r.createdAt)}</time></span><p>${esc(r.text)}</p></div>`).join('')}
          ${m.replies.length ? '' : '<p class="muted small" style="margin:0">The office usually replies within one working day. The reply will appear here.</p>'}
        </article>`).join('')
      : emptyState('No messages yet', 'Questions about registration, vaccination or a report? Send the PVO a message and the reply will appear here.', '<a class="btn btn-primary" href="contact.html">Message the PVO</a>');
    if (!$('#panel-messages').hidden) markMessagesRead();
  } catch (err) {
    box.innerHTML = errorState(err.message);
  }
}

async function markMessagesRead() {
  if (!unreadIds.size) return;
  unreadIds = new Set();
  try {
    await api('/contact/mine/read', { method: 'PATCH' });
    refreshUnread();
  } catch { /* try again next visit */ }
}

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
    box.innerHTML = pets.length
      ? pets.map((p) => `<article class="card my-pet">
          <a href="pet.html?id=${p._id}">${petImg(p.photos?.[0], '', p.name)}</a>
          <div class="stack-sm" style="gap:4px">
            <div class="row" style="gap:6px"><h3><a href="pet.html?id=${p._id}">${esc(p.name)}</a></h3>${petTags(p)}${p.registrationStatus === 'pending' ? '<span class="tag tag-amber">Verification pending</span>' : ''}</div>
            <span class="muted small">${esc(p.breed || SPECIES[p.species])}${p.birthDate ? ` · ${ageText(p.birthDate)}` : ''} · <span class="mono">${esc(p.registrationNo)}</span></span>
            <div class="row" style="gap:6px">${rabiesLine(p.rabies)}</div>
          </div>
          <div class="row" style="gap:6px">
            <a class="btn btn-ghost btn-sm" href="pet.html?id=${p._id}#health">Health records</a>
            <a class="btn btn-soft btn-sm" href="pet-form.html?id=${p._id}">${ICONS.edit}Edit</a>
          </div>
        </article>`).join('')
      : emptyState('No pets yet', 'Register your first pet to get a PVO registration number and a profile on the wall.', '<a class="btn btn-primary" href="pet-form.html">Register a pet</a>');
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
    box.innerHTML = reports.length
      ? reports.map(reportCard).join('')
      : emptyState('No reports filed', 'Report animal bites, missing pets, strays or welfare concerns to the PVO.', '<a class="btn btn-primary" href="report.html">Report an incident</a>');
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
  $('#dash-name').textContent = `Hi, ${user.name.split(' ')[0]}!`;
  $('#dash-who').textContent = `${user.email}${user.municipality ? ` · ${user.municipality}` : ''}`;
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
  if (user.role === 'admin') return void location.replace('admin.html');
  $('#dashboard').hidden = false;
  paintHead(user);
  TABS.forEach((t) => $(`#tab-${t}`).addEventListener('click', () => selectTab(t)));
  route();
  addEventListener('hashchange', route);
  setupProfile(user);
  loadPets();
  loadReports();
  loadMessages();
}

/* ---------- Boot ---------- */
if (isAdmin()) location.replace('admin.html');
else if (getUser()) showDashboard();
else showAuth();
