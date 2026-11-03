/**
 * Account page: log in / register when logged out;
 * order history, cancellation and profile when logged in.
 */
import { api } from '../api.js';
import { getUser, setSession, getSession } from '../store.js';
import { initPage, formatPrice, formatDate, esc, toast, showFieldErrors, setBusy, logout, $ } from '../ui.js';

initPage('');
const next = new URLSearchParams(location.search).get('next');

/* ---------- Logged out: tabs + forms ---------- */
function selectTab(which) {
  const login = which === 'login';
  $('#tab-login').setAttribute('aria-selected', String(login));
  $('#tab-register').setAttribute('aria-selected', String(!login));
  $('#login-form').hidden = !login;
  $('#register-form').hidden = login;
}
$('#tab-login').addEventListener('click', () => selectTab('login'));
$('#tab-register').addEventListener('click', () => selectTab('register'));

function afterAuth(session, message) {
  setSession(session);
  toast(message);
  // Admins work in the admin panel, not the customer account page.
  if (session.user.role === 'admin') return void (location.href = 'admin.html');
  if (next && /^[a-z]+\.html$/.test(next)) location.href = next; // only local pages
  else location.reload();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = form.querySelector('[type=submit]');
  $('#login-error').hidden = true;
  setBusy(btn, true, 'Logging in…');
  try {
    const session = await api('/users/login', {
      method: 'POST',
      auth: false,
      body: { email: form.email.value.trim(), password: form.password.value },
    });
    afterAuth(session, `Welcome back, ${session.user.name.split(' ')[0]}.`);
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
  if (form.password.value.length < 8) errors.password = 'Use at least 8 characters.';
  showFieldErrors(form, errors);
  if (Object.keys(errors).length) return;

  const btn = form.querySelector('[type=submit]');
  $('#register-error').hidden = true;
  setBusy(btn, true, 'Creating account…');
  try {
    const session = await api('/users/register', {
      method: 'POST',
      auth: false,
      body: {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        password: form.password.value,
      },
    });
    afterAuth(session, 'Account created.');
  } catch (err) {
    $('#register-error').textContent = err.message;
    $('#register-error').hidden = false;
    if (err.details) showFieldErrors(form, err.details);
    setBusy(btn, false);
  }
});

/* ---------- Logged in ---------- */
function orderCard(o) {
  const lines = o.items
    .map((i) => `<li class="row between"><span>${esc(i.name)}${i.qty > 1 ? ` × ${i.qty}` : ''}${i.preorder ? ' <span class="tag">Pre-order</span>' : ''}</span><span class="mono">${formatPrice(i.price * i.qty)}</span></li>`)
    .join('');
  return `<article class="panel stack">
    <div class="row between">
      <div class="stack" style="gap:2px"><span class="label">${formatDate(o.createdAt)}</span><strong class="mono">${esc(o.reference)}</strong></div>
      <span class="status status-${o.status}">${o.status}</span>
    </div>
    <ul class="stack" style="gap:6px;list-style:none;padding:0;margin:0">${lines}</ul>
    <div class="row between" style="border-top:1px solid var(--line);padding-top:12px">
      <span class="muted">Due now <strong class="mono" style="color:var(--ink)">${formatPrice(o.dueNow)}</strong>${o.balance ? ` · Balance ${formatPrice(o.balance)}` : ''}</span>
      ${o.status === 'pending' ? `<button class="btn btn-danger btn-sm" type="button" data-cancel="${o._id}">Cancel order</button>` : ''}
    </div>
  </article>`;
}

async function loadOrders() {
  const box = $('#orders');
  box.innerHTML = '<div class="skeleton" style="height:140px"></div>';
  try {
    const orders = await api('/orders/mine');
    box.innerHTML = orders.length
      ? `<div class="stack">${orders.map(orderCard).join('')}</div>`
      : `<div class="empty"><p>You have no orders yet.</p><a class="btn btn-accent" href="products.html">Browse inventory</a></div>`;
  } catch (err) {
    box.innerHTML = `<p class="notice notice-error">${esc(err.message)}</p>`;
  }
}

$('#orders').addEventListener('click', async (e) => {
  const id = e.target.closest('[data-cancel]')?.dataset.cancel;
  if (!id) return;
  const btn = e.target.closest('button');
  // Two-step confirm built into the button (no browser dialogs).
  if (btn.dataset.armed !== 'true') {
    btn.dataset.armed = 'true';
    btn.textContent = 'Tap again to cancel';
    setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'Cancel order'; }, 3000);
    return;
  }
  btn.disabled = true; // one request per confirm, even on a double tap
  try {
    await api(`/orders/${id}/cancel`, { method: 'PATCH' });
    toast('Order cancelled. Any reserved car is back on sale.');
    loadOrders();
  } catch (err) {
    btn.disabled = false;
    toast(err.message, 'error');
  }
});

$('#profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const body = { name: form.name.value.trim(), phone: form.phone.value.trim() };
  if (form.password.value) body.password = form.password.value;
  try {
    const user = await api('/users/me', { method: 'PUT', body });
    setSession({ ...getSession(), user });
    form.password.value = '';
    showFieldErrors(form, {});
    toast('Profile saved.');
    $('#who').textContent = `Logged in as ${user.name} (${user.email})`;
  } catch (err) {
    showFieldErrors(form, err.details || {});
    toast(err.message, 'error');
  }
});

$('#logout').addEventListener('click', logout);

/* ---------- Boot ---------- */
async function boot() {
  const cached = getUser();
  if (cached?.role === 'admin') return void location.replace('admin.html');
  if (!cached) {
    $('#account-title').textContent = 'Log in';
    $('#auth').hidden = false;
    return;
  }
  try {
    const user = await api('/users/me'); // confirms the token is still valid
    $('#dashboard').hidden = false;
    $('#account-title').textContent = `Hi, ${user.name.split(' ')[0]}`;
    $('#who').textContent = `Logged in as ${user.name} (${user.email})`;
    $('#admin-link').hidden = user.role !== 'admin';
    $('#p-name').value = user.name;
    $('#p-phone').value = user.phone || '';
    loadOrders();
  } catch {
    $('#account-title').textContent = 'Log in';
    $('#auth').hidden = false;
  }
}
boot();
