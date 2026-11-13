/**
 * Account page.
 *  - logged out: log in / create an owner account
 *  - logged in (owner):
 *      Profile  (#pets, #reports, #orders, #shop, #messages): My pets, My reports (status tracking),
 *               My orders (what I bought), My shop (sell: name the shop, list products, handle orders),
 *               Messages (PVO replies)
 *      Settings (#settings): your details and password
 *  - Log out lives only in the account menu in the header
 *  - PVO staff are sent to the admin console
 */
import { api } from '../api.js';
import { getUser, setSession, updateSessionUser, isAdmin } from '../store.js';
import { MUNICIPALITIES, SPECIES, CONTACT_TOPICS } from '../config.js';
import { refreshUnread } from '../nav.js';
import { initPage, toast, showFieldErrors, setBusy, options, emptyState, errorState, skeleton, esc, initials, ageText, formatDate, formatDateTime, ICONS, $ } from '../ui.js';
import { petImg, petTags, reportCard, orderCard, productImg } from '../components.js';
import { productEditor } from '../product-editor.js';
import { peso, PRODUCT_CATEGORIES } from '../config.js';

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
const TABS = ['pets', 'reports', 'orders', 'shop', 'messages'];
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

/* ---------- My orders: what I bought ---------- */
async function loadOrders() {
  const box = $('#my-orders');
  box.innerHTML = skeleton(2, 160);
  try {
    const orders = await api('/shop/orders/mine');
    const open = orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length;
    $('#orders-count').textContent = orders.length;
    box.innerHTML = orders.length
      ? `${open ? `<p class="muted small" style="margin:0">${open} order${open === 1 ? '' : 's'} in progress. You get a notification at every step.</p>` : ''}${orders.map((o) => orderCard(o, 'buyer')).join('')}`
      : emptyState('No orders yet', 'Food, toys, collars and more from shops around Marinduque.', '<a class="btn btn-primary" href="shop.html">Go to the shop</a>');
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

/* ---------- My shop: sell on Alaga ---------- */
const shopState = { shop: null, products: [], orders: [], filter: 'open' };
let editor;
async function loadShop() {
  const box = $('#my-shop');
  box.innerHTML = skeleton(2, 120);
  try {
    const [mine, orders] = await Promise.all([api('/shop/mine'), api('/shop/orders/selling')]);
    Object.assign(shopState, mine, { orders });
    const waiting = orders.filter((o) => o.status === 'placed').length;
    $('#shop-count').textContent = waiting ? `${waiting} new` : mine.shop.status === 'pending' ? 'In review' : mine.products.length || '';
    $('#shop-count').classList.toggle('tag-solid-green', waiting > 0);
    renderShop();
  } catch (err) {
    box.innerHTML = errorState(err.message);
  }
}

function renderShop() {
  const { shop, products, orders } = shopState;
  const box = $('#my-shop');
  if (shop.status !== 'approved' && shop.status !== 'suspended') {
    box.innerHTML = shop.status === 'pending' ? pendingHtml(shop) : applyHtml(shop);
    return;
  }
  if (shopState.editing) {
    box.innerHTML = applyHtml(shop, true);
    return;
  }
  const shown = orders.filter((o) => (shopState.filter === 'open' ? !['completed', 'cancelled'].includes(o.status) : true));
  const sales = orders.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0);
  box.innerHTML = `${shop.status === 'suspended' ? `<p class="notice notice-error" style="margin-bottom:14px"><strong>Your shop is suspended.</strong> Your products are hidden from the shop. Reason: ${esc(shop.reason || 'not given')}. <a href="contact.html">Message the PVO</a> to have it restored.</p>` : ''}<div class="my-shop-head">
      <div class="row" style="gap:12px;flex-wrap:nowrap"><span class="shop-avatar" aria-hidden="true">${esc(shop.name[0])}</span>
        <div><h2 style="font-size:1.25rem">${esc(shop.name)}</h2><p class="muted small" style="margin:0">${products.length} product${products.length === 1 ? '' : 's'} · ${orders.filter((o) => o.status === 'completed').length} completed orders · ${peso(sales)} sales</p></div></div>
      <div class="row" style="gap:8px"><button class="btn btn-ghost btn-sm" type="button" data-edit-shop>Edit shop details</button><a class="btn btn-ghost btn-sm" href="shop.html?shop=${esc(shop.id)}">View my shop</a>${shop.status === 'approved' ? '<button class="btn btn-primary btn-sm" type="button" data-new-product>+ Add product</button>' : ''}</div>
    </div>
    <div class="panel-head" style="margin-top:8px"><h3>Orders</h3>
      <div class="chips" role="group" aria-label="Show"><button class="chip" type="button" data-ofilter="open" aria-pressed="${shopState.filter === 'open'}">To do</button><button class="chip" type="button" data-ofilter="all" aria-pressed="${shopState.filter === 'all'}">All</button></div></div>
    <div class="stack">${shown.map((o) => orderCard(o, 'seller')).join('') || emptyState(shopState.filter === 'open' ? 'No orders to handle' : 'No orders yet', 'New orders show up here and in your notifications.')}</div>
    <div class="panel-head" style="margin-top:24px"><h3>Products</h3></div>
    <div class="seller-products">${products.map((p) => `<article class="card seller-product${p.active ? '' : ' is-hidden'}">
      ${productImg(p)}
      <div class="stack-sm" style="gap:2px"><strong>${esc(p.name)}</strong>
        <span class="small">${peso(p.price)} · ${p.stock < 1 ? '<span style="color:var(--bad)">Sold out</span>' : `${p.stock} in stock`} · ${p.sold} sold${p.active ? '' : ' · <span class="tag">Hidden</span>'}</span></div>
      <div class="cell-actions"><button class="btn btn-ghost btn-sm" type="button" data-edit-product="${p._id}">${ICONS.edit}<span class="sr-only">Edit</span></button><button class="btn btn-danger btn-sm" type="button" data-del-product="${p._id}">${ICONS.trash}<span class="sr-only">Delete</span></button></div>
    </article>`).join('') || emptyState('No products yet', 'Add your first product: a clear photo, a fair price and how many you have.', '<button class="btn btn-primary" type="button" data-new-product>+ Add product</button>')}</div>`;
}

/** The seller application (also used to edit an approved shop's details). */
function applyHtml(shop, editing = false) {
  const rejected = shop.status === 'rejected';
  return `<form class="card form-section" id="shop-form" novalidate style="max-width:640px">
    <h2>${editing ? 'Edit shop details' : rejected ? 'Apply again to sell' : 'Apply to sell on Alaga'}</h2>
    ${rejected ? `<p class="notice notice-error" style="margin:0"><strong>Your last application was not approved.</strong> PVO: ${esc(shop.reason || 'no reason given')}</p>` : ''}
    ${editing ? '' : `<ol class="apply-steps"><li><strong>Apply</strong><span>Tell the PVO about your shop.</span></li><li><strong>PVO review</strong><span>Usually within 1 to 2 working days.</span></li><li><strong>Start selling</strong><span>List products; buyers pay cash on pickup or delivery.</span></li></ol>`}
    <label class="field"><span>Shop name</span><input class="input" name="shopName" maxlength="60" required value="${esc(shop.named ? shop.name : '')}" placeholder="e.g. Bantay Pet Supplies"><small class="field-error"></small></label>
    <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field-label" style="margin-bottom:6px">What will you sell?</legend>
      <div class="species-checks">${Object.entries(PRODUCT_CATEGORIES).map(([k, c]) => `<label class="check"><input type="checkbox" name="sells" value="${k}" ${shop.sells?.includes(k) ? 'checked' : ''}><span>${esc(c.label)}</span></label>`).join('')}</div>
      <small class="field-error" data-for="sells"></small></fieldset>
    <label class="field"><span>Pickup point</span><input class="input" name="pickup" maxlength="120" required value="${esc(shop.pickup || '')}" placeholder="Barangay, town and a landmark"><small class="field-error"></small></label>
    <label class="field"><span>About your shop</span><textarea class="input" name="about" maxlength="300" required style="min-height:90px" placeholder="What you sell, where it comes from, delivery areas">${esc(shop.about || '')}</textarea><small class="field-error"></small></label>
    ${editing ? '' : `<label class="check"><input type="checkbox" name="agree" required><span>I will sell only safe, legal pet products, describe them honestly, and hand over orders on time. The PVO may suspend shops that break these rules.</span></label><small class="field-error" data-for="agree"></small>`}
    <div class="row">${editing ? '<button class="btn btn-ghost" type="button" data-cancel-edit>Cancel</button>' : ''}<button class="btn btn-primary" type="submit">${editing ? 'Save details' : 'Send application'}</button></div>
  </form>`;
}

function pendingHtml(shop) {
  return `<section class="card form-section" style="max-width:640px">
    <div class="row" style="gap:8px"><span class="tag tag-amber">Under review</span><span class="muted small">Sent ${formatDateTime(shop.appliedAt)}</span></div>
    <h2>${esc(shop.name)}</h2>
    <p style="margin:0">Thanks for applying. PVO staff are checking your application, usually within 1 to 2 working days. You will get a notification when it is approved, and you can then list products here.</p>
    <dl class="pd-facts"><dt>Sells</dt><dd>${shop.sells.map((c) => esc(PRODUCT_CATEGORIES[c]?.label || c)).join(', ')}</dd><dt>Pickup</dt><dd>${esc(shop.pickup)}</dd><dt>About</dt><dd>${esc(shop.about)}</dd></dl>
  </section>`;
}

$('#my-shop').addEventListener('submit', async (e) => {
  if (e.target.id !== 'shop-form') return;
  e.preventDefault();
  const form = e.target;
  const f = form.elements;
  const sells = [...form.querySelectorAll('[name=sells]:checked')].map((c) => c.value);
  const errors = {};
  if (f.shopName.value.trim().length < 3) errors.shopName = 'Give your shop a name (at least 3 characters).';
  if (!sells.length) errors.sells = 'Choose at least one kind of product.';
  if (f.pickup.value.trim().length < 5) errors.pickup = 'Enter where buyers can pick up orders.';
  if (f.about.value.trim().length < 20) errors.about = 'Tell buyers and the PVO what you sell (at least 20 characters).';
  if (f.agree && !f.agree.checked) errors.agree = 'Please agree to the seller rules.';
  form.querySelectorAll('[data-for]').forEach((el) => { el.textContent = errors[el.dataset.for] || ''; });
  showFieldErrors(form, errors);
  if (Object.keys(errors).length) return;
  const btn = form.querySelector('[type=submit]');
  setBusy(btn, true, 'Sending…');
  try {
    await api('/shop/mine', { method: 'PUT', body: { name: f.shopName.value.trim(), about: f.about.value.trim(), pickup: f.pickup.value.trim(), sells } });
    toast(shopState.editing ? 'Shop details saved.' : 'Application sent. The PVO will review it soon.');
    shopState.editing = false;
    await loadShop();
  } catch (err) {
    setBusy(btn, false);
    showFieldErrors(form, err.details || { shopName: err.message });
    form.querySelectorAll('[data-for]').forEach((el) => { el.textContent = err.details?.[el.dataset.for] || ''; });
  }
});
$('#my-shop').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  editor ||= productEditor({ onSaved: loadShop });
  if (d.newProduct !== undefined) editor.open();
  if (d.editShop !== undefined) { shopState.editing = true; renderShop(); }
  if (d.cancelEdit !== undefined) { shopState.editing = false; renderShop(); }
  if (d.editProduct) editor.open(shopState.products.find((p) => p._id === d.editProduct));
  if (d.ofilter) { shopState.filter = d.ofilter; renderShop(); }
  const confirmFirst = (label) => {
    if (b.dataset.armed === 'true') return true;
    b.dataset.armed = 'true';
    const html = b.innerHTML;
    b.textContent = label;
    setTimeout(() => { if (b.isConnected) { b.dataset.armed = ''; b.innerHTML = html; } }, 3500);
    return false;
  };
  try {
    if (d.delProduct && confirmFirst('Delete?')) {
      await api(`/shop/products/${d.delProduct}`, { method: 'DELETE' });
      toast('Product deleted.');
      loadShop();
    }
    if (d.orderStatus && (d.orderStatus !== 'cancelled' || confirmFirst('Cancel order?'))) {
      b.disabled = true;
      await api(`/shop/orders/${d.order}`, { method: 'PATCH', body: { status: d.orderStatus } });
      toast(d.orderStatus === 'cancelled' ? 'Order cancelled. The items are back in stock.' : 'Order updated. The buyer was notified.');
      loadShop();
    }
  } catch (err) {
    b.disabled = false;
    toast(err.message, 'error');
  }
});

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
            <div class="row" style="gap:6px"><h3><a href="pet.html?id=${p._id}">${esc(p.name)}</a></h3>${petTags(p)}${p.registrationStatus === 'pending' ? '<span class="tag tag-amber">Verification pending</span>' : ''}${p.registrationStatus === 'rejected' ? '<span class="tag tag-red">Registration rejected</span>' : ''}</div>
            <span class="muted small">${esc(p.breed || SPECIES[p.species])}${p.birthDate ? ` · ${ageText(p.birthDate)}` : ''} · <span class="mono">${esc(p.registrationNo)}</span></span>
            <div class="row" style="gap:6px">${rabiesLine(p.rabies)}</div>
            ${p.registrationStatus === 'rejected' ? `<p class="small" style="color:var(--bad);margin:0">PVO: ${esc(p.rejectionReason || 'Please check the details.')} Edit the pet to resubmit.</p>` : ''}
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
  loadOrders();
  loadShop();
  loadMessages();
}

/* ---------- Boot ---------- */
if (isAdmin()) location.replace('admin.html');
else if (getUser()) showDashboard();
else showAuth();
