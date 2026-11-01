/**
 * Admin "lot console".
 *
 * Views (switched with the URL hash so each can be bookmarked):
 *   #today      what needs attention right now + lot status bar
 *   #sales      sales figures and charts (admin-sales.js)
 *   #lot        every listing, with inline status / stock changes
 *   #orders     pipeline: pending → confirmed → ready → completed
 *   #messages   customer inbox
 *   #customers  accounts
 *
 * Every request carries the admin's token; the server enforces the admin role,
 * this page only decides what to show.
 */
import { api, apiUpload, qs } from '../api.js';
import { isAdmin, getUser, setSession, clearSession } from '../store.js';
import { showroomStatus } from '../nav.js';
import { createSalesView } from './admin-sales.js';
import { initAdminPage, formatPrice, formatPriceShort, formatDate, esc, toast, showFieldErrors, setBusy, ICONS, $, $$ } from '../ui.js';

const signedIn = isAdmin();
initAdminPage({ header: !signedIn }); // the console has its own sidebar

if (signedIn) boot();
else if (getUser()) showDenied();
else showLogin();

/* =========================================================================
   Sign-in states
   ========================================================================= */
function showDenied() {
  $('#denied').hidden = false;
  $('#denied [data-logout]').addEventListener('click', () => { clearSession(); location.reload(); });
}

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
      const session = await api('/users/login', {
        method: 'POST',
        auth: false,
        body: { email: form.elements.email.value.trim(), password: form.elements.password.value },
      });
      if (session.user.role !== 'admin') throw new Error('That account is not an admin. Use a staff account.');
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
  const state = { products: [], orders: [], messages: [], users: [], lotFilter: 'all', msgFilter: 'open' };
  const TOPIC = { 'test-drive': 'Test drive', financing: 'Financing', 'trade-in': 'Trade-in', general: 'Question' };
  const STAGES = [
    { key: 'pending', label: 'Pending', hint: 'Call to confirm', next: 'confirmed', action: 'Confirm' },
    { key: 'confirmed', label: 'Confirmed', hint: 'Prepare the car', next: 'ready', action: 'Mark ready' },
    { key: 'ready', label: 'Ready', hint: 'Waiting for handover', next: 'completed', action: 'Complete sale' },
    { key: 'completed', label: 'Completed', hint: 'Handed over' },
  ];

  /* ---------- Chrome ---------- */
  const user = getUser();
  $('#admin').hidden = false;
  $('#admin-name').textContent = user.name;
  $('#admin-avatar').textContent = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  $('#admin-date').textContent = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });
  $$('[data-icon]').forEach((el) => (el.innerHTML = ICONS[el.dataset.icon] || ''));
  $$('[data-logout]').forEach((b) => b.addEventListener('click', () => { clearSession(); location.href = 'admin.html'; }));
  $('#console-theme').addEventListener('click', () => {
    const dark = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('voltyard.theme', document.documentElement.dataset.theme); } catch { /* ignore */ }
  });

  /* ---------- Views (hash routing) ---------- */
  const VIEWS = ['today', 'sales', 'lot', 'orders', 'messages', 'customers'];
  const sales = createSalesView();
  function showView() {
    const view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
    $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== view));
    $$('[data-view]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.view === view));
    document.title = `${view[0].toUpperCase()}${view.slice(1)} | Voltyard admin`;
  }
  addEventListener('hashchange', showView);
  showView();

  // Number keys 1–6 jump between views (ignored while typing in a field).
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || $('dialog[open]')) return;
    const view = VIEWS[Number(e.key) - 1];
    if (view) location.hash = view;
  });

  // Showroom open/closed, same rule as the public site.
  const paintStatus = () => {
    const s = showroomStatus();
    $('#console-status').classList.toggle('is-open', s.open);
    $('#console-status span').textContent = s.text;
  };
  paintStatus();
  setInterval(paintStatus, 60000);

  /* ---------- Data ---------- */
  async function loadAll() {
    try {
      const [products, orders, messages, users] = await Promise.all([
        api(`/products${qs({ all: 'true', limit: 100, sort: 'newest' })}`).then((d) => d.items),
        api('/orders'),
        api('/contact'),
        api('/users'),
      ]);
      Object.assign(state, { products, orders, messages, users });
      renderAll();
      sales.load(); // order changes move the sales numbers too
    } catch (err) {
      toast(err.message, 'error');
      if (err.status === 401 || err.status === 403) setTimeout(() => location.reload(), 1200);
    }
  }
  function renderAll() {
    renderToday();
    renderLot();
    renderOrders();
    renderMessages();
    renderCustomers();
    renderBadges();
  }

  /** Run an update, then refresh everything so every view stays consistent. */
  async function act(request, success) {
    try {
      await request();
      if (success) toast(success);
      await loadAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /** Two-step confirm built into the button (browser dialogs are avoided). */
  function armed(btn, label = 'Tap again') {
    if (btn.dataset.armed === 'true') return true;
    btn.dataset.armed = 'true';
    const original = btn.textContent;
    btn.textContent = label;
    btn.classList.add('is-armed');
    setTimeout(() => { btn.dataset.armed = ''; btn.textContent = original; btn.classList.remove('is-armed'); }, 3000);
    return false;
  }

  /* ---------- Derived numbers ---------- */
  const vehicles = () => state.products.filter((p) => p.category === 'vehicle');
  const parts = () => state.products.filter((p) => p.category === 'accessory');
  const lowStock = () => parts().filter((p) => p.stock <= 3);
  const openOrders = () => state.orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function renderBadges() {
    const set = (k, n, urgent) => {
      const b = $(`[data-badge="${k}"]`);
      b.textContent = n || '';
      b.hidden = !n;
      b.classList.toggle('is-urgent', !!urgent);
    };
    set('lot', lowStock().length, true);
    set('orders', state.orders.filter((o) => o.status === 'pending').length, true);
    set('messages', state.messages.filter((m) => m.status === 'new').length, true);
  }

  /* ---------- Today ---------- */
  function renderToday() {
    const v = vehicles();
    const groups = [
      { key: 'available', label: 'Available', n: v.filter((p) => p.status === 'available' && p.condition !== 'pre-order').length },
      // Order chosen so no two hard-to-separate colours touch (validated with the dataviz script).
      { key: 'preorder', label: 'Pre-order', n: v.filter((p) => p.condition === 'pre-order').length },
      { key: 'reserved', label: 'Reserved', n: v.filter((p) => p.status === 'reserved').length },
      { key: 'sold', label: 'Sold', n: v.filter((p) => p.status === 'sold').length },
    ];
    const pending = state.orders.filter((o) => o.status === 'pending');
    const fresh = state.messages.filter((m) => m.status === 'new');

    const todo = [];
    if (pending.length) todo.push(plural(pending.length, 'order') + ' to call');
    if (fresh.length) todo.push(plural(fresh.length, 'message') + ' to answer');
    if (lowStock().length) todo.push(plural(lowStock().length, 'part') + ' running low');
    $('#today-line').innerHTML = `${groups[0].n} cars on the lot.<br><span>${todo.length ? todo.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.' : 'Nothing waiting on you.'}</span>`;

    const total = groups.reduce((s, g) => s + g.n, 0) || 1;
    $('#lotbar').innerHTML = groups.filter((g) => g.n).map((g) => `<span class="lb-${g.key}" style="flex-grow:${g.n}" title="${g.label}: ${g.n}"></span>`).join('');
    $('#lotbar').setAttribute('aria-label', groups.map((g) => `${g.label} ${g.n}`).join(', '));
    $('#lotbar-legend').innerHTML = groups.map((g) => `<li><i class="lb-${g.key}"></i>${g.label}<b>${g.n}</b><small>${Math.round((g.n / total) * 100)}%</small></li>`).join('');

    const items = [
      ...pending.map((o) => `<li class="q q-order">
        <div class="q-body"><span class="q-kind">Order to confirm</span>
          <strong>Call ${esc(o.fulfillment.fullName)} · <span class="mono">${esc(o.fulfillment.phone)}</span></strong>
          <span>${esc(o.items.map((i) => i.name).join(', '))} · <span class="mono">${esc(o.reference)}</span> · due now ${formatPrice(o.dueNow)}</span></div>
        <div class="q-actions"><button class="btn btn-sm btn-accent" type="button" data-order-next="${o._id}" data-to="confirmed">Confirm</button></div></li>`),
      ...fresh.map((m) => `<li class="q q-msg">
        <div class="q-body"><span class="q-kind">${TOPIC[m.topic]}${m.preferredDate ? ` · ${formatDate(m.preferredDate)}` : ''}</span>
          <strong>${esc(m.name)}${m.product ? ` about <span class="mono">${esc(m.product.stockNumber || m.product.name)}</span>` : ''}</strong>
          <span class="q-snippet">“${esc(m.message)}”</span></div>
        <div class="q-actions"><button class="btn btn-sm btn-ghost" type="button" data-msg="${m._id}" data-to="replied">Mark replied</button></div></li>`),
      ...lowStock().map((p) => `<li class="q q-stock">
        <div class="q-body"><span class="q-kind">Low stock</span><strong>${esc(p.name)}</strong><span>${p.stock === 0 ? 'Out of stock' : `Only ${p.stock} left`}</span></div>
        <div class="q-actions"><button class="btn btn-sm btn-ghost" type="button" data-edit="${p._id}">Restock</button></div></li>`),
    ];
    $('#queue').innerHTML = items.join('') || '<li class="q-empty">All clear. New orders and messages will show up here.</li>';

    const collected = state.orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.dueNow, 0);
    const openValue = openOrders().reduce((s, o) => s + o.subtotal, 0);
    $('#money-collected').textContent = formatPrice(collected);
    $('#money-booked').textContent = formatPrice(openValue);
    $('#money-customers').textContent = state.users.filter((u) => u.role === 'customer').length;
  }

  /* ---------- Lot ---------- */
  function lotRow(p) {
    const isVehicle = p.category === 'vehicle';
    const pre = p.condition === 'pre-order';
    const stateKey = !isVehicle ? (p.stock <= 3 ? 'low' : 'stocked') : pre ? 'preorder' : p.status;
    const meta = isVehicle
      ? `${esc(p.year)} · ${esc(p.color)} · ${pre ? 'pre-order' : esc(p.condition)}`
      : `Fits ${(p.compatibleWith || []).length >= 5 ? 'all models' : esc((p.compatibleWith || []).join(', '))}`;
    let control;
    if (!isVehicle) {
      control = `<div class="stepper" aria-label="Units in stock">
        <button type="button" data-stock="${p._id}" data-delta="-1" aria-label="One fewer" ${p.stock <= 0 ? 'disabled' : ''}>−</button>
        <span class="mono">${p.stock}</span>
        <button type="button" data-stock="${p._id}" data-delta="1" aria-label="One more">+</button></div>`;
    } else if (pre) {
      control = '<span class="lot-state">Taking reservations</span>';
    } else {
      control = `<select class="state-select" data-status="${p._id}" aria-label="Status of ${esc(p.stockNumber)}">
        ${['available', 'reserved', 'sold'].map((s) => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
      </select>`;
    }
    return `<article class="lot-row st-${stateKey}">
      <img src="${esc(p.image)}" alt="" width="96" height="72" loading="lazy">
      <div class="lot-id">
        <span class="lot-stock mono">${esc(p.stockNumber || 'PART')}</span>
        <a href="product.html?slug=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">${esc(p.name)}</a>
        <span class="lot-meta">${meta}</span>
      </div>
      <span class="lot-price mono">${formatPrice(p.price)}</span>
      <div class="lot-control">${control}</div>
      <div class="lot-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-edit="${p._id}">Edit</button>
        <button class="btn btn-danger btn-sm" type="button" data-delete="${p._id}">Delete</button>
      </div>
    </article>`;
  }

  function renderLot() {
    const term = $('#inv-search').value.trim().toLowerCase();
    const f = state.lotFilter;
    const rows = state.products
      .filter((p) => (f === 'all' ? true : f === 'accessory' ? p.category === 'accessory' : p.category === 'vehicle' && p.status === f && p.condition !== 'pre-order'))
      .filter((p) => !term || `${p.name} ${p.stockNumber || ''} ${p.color || ''}`.toLowerCase().includes(term));
    $('#inv-table').innerHTML = rows.map(lotRow).join('') || '<p class="q-empty">No listings match.</p>';
  }
  $('#inv-search').addEventListener('input', renderLot);
  $$('[data-filter]').forEach((c) => c.addEventListener('click', () => {
    state.lotFilter = c.dataset.filter;
    $$('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    renderLot();
  }));

  /* ---------- Orders pipeline ---------- */
  function orderCard(o, stage) {
    const final = ['completed', 'cancelled'].includes(o.status);
    return `<article class="ticket">
      <header><span class="mono">${esc(o.reference)}</span><time>${formatDate(o.createdAt)}</time></header>
      <strong>${esc(o.fulfillment.fullName)}</strong>
      <span class="mono ticket-phone">${esc(o.fulfillment.phone)}</span>
      <ul>${o.items.map((i) => `<li>${esc(i.name)}${i.qty > 1 ? ` × ${i.qty}` : ''}${i.preorder ? ' <em>pre-order</em>' : ''}</li>`).join('')}</ul>
      <p class="ticket-where">${o.fulfillment.method === 'delivery' ? `Deliver to ${esc(o.fulfillment.address)}${o.fulfillment.city ? `, ${esc(o.fulfillment.city)}` : ''}` : 'Showroom pickup'}</p>
      <div class="ticket-money"><span>Due now <b class="mono">${formatPrice(o.dueNow)}</b></span><span>Total <b class="mono">${formatPriceShort(o.subtotal)}</b></span></div>
      ${final ? '' : `<div class="ticket-actions">
        ${stage?.next ? `<button class="btn btn-sm btn-accent" type="button" data-order-next="${o._id}" data-to="${stage.next}">${stage.action}</button>` : ''}
        <button class="btn btn-sm btn-danger" type="button" data-order-cancel="${o._id}">Cancel</button></div>`}
    </article>`;
  }

  function renderOrders() {
    const cancelled = state.orders.filter((o) => o.status === 'cancelled');
    $('#orders-table').innerHTML = STAGES.map((s) => {
      const list = state.orders.filter((o) => o.status === s.key);
      const shown = s.key === 'completed' ? list.slice(0, 6) : list;
      return `<section class="lane lane-${s.key}" aria-label="${s.label}">
        <header><h2>${s.label}</h2><b>${list.length}</b><small>${s.hint}</small></header>
        <div class="lane-body">${shown.map((o) => orderCard(o, s)).join('') || '<p class="lane-empty">Nothing here.</p>'}</div>
      </section>`;
    }).join('') + (cancelled.length ? `<details class="lane-cancelled"><summary>${plural(cancelled.length, 'cancelled order')}</summary><div class="lane-body">${cancelled.map((o) => orderCard(o)).join('')}</div></details>` : '');
  }

  /* ---------- Messages ---------- */
  function renderMessages() {
    const list = state.messages.filter((m) => (state.msgFilter === 'open' ? m.status !== 'closed' : true));
    $('#messages-table').innerHTML = list.map((m) => `<li class="mail st-${m.status}">
      <div class="mail-head">
        <span class="topic topic-${m.topic}">${TOPIC[m.topic]}</span>
        <strong>${esc(m.name)}</strong>
        <time>${formatDate(m.createdAt)}</time>
      </div>
      <p>${esc(m.message)}</p>
      <div class="mail-meta">
        <span class="mono">${esc(m.email)}</span>${m.phone ? `<span class="mono">${esc(m.phone)}</span>` : ''}
        ${m.preferredDate ? `<span>Preferred ${formatDate(m.preferredDate)}</span>` : ''}
        ${m.product ? `<a href="product.html?slug=${encodeURIComponent(m.product.slug)}" target="_blank" rel="noopener">${esc(m.product.stockNumber || m.product.name)}</a>` : ''}
      </div>
      <div class="mail-actions">
        ${m.status === 'new' ? `<button class="btn btn-sm btn-accent" type="button" data-msg="${m._id}" data-to="replied">Mark replied</button>` : ''}
        ${m.status !== 'closed' ? `<button class="btn btn-sm btn-ghost" type="button" data-msg="${m._id}" data-to="closed">Close</button>` : `<button class="btn btn-sm btn-ghost" type="button" data-msg="${m._id}" data-to="new">Reopen</button>`}
      </div>
    </li>`).join('') || `<li class="q-empty">${state.msgFilter === 'open' ? 'Inbox zero. Closed messages are under All.' : 'No messages yet.'}</li>`;
  }
  $$('[data-mfilter]').forEach((c) => c.addEventListener('click', () => {
    state.msgFilter = c.dataset.mfilter;
    $$('[data-mfilter]').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    renderMessages();
  }));

  /* ---------- Customers ---------- */
  function renderCustomers() {
    const ordersBy = (id) => state.orders.filter((o) => String(o.user?._id || o.user) === String(id) && o.status !== 'cancelled');
    $('#customers-table').innerHTML = `
      <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th class="num">Orders</th><th>Joined</th></tr></thead>
      <tbody>${state.users.filter((u) => u.role === 'customer').map((u) => `<tr>
        <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td class="mono">${esc(u.phone || '—')}</td>
        <td class="num">${ordersBy(u._id).length}</td><td>${formatDate(u.createdAt)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No customers yet.</td></tr>'}</tbody>`;
  }

  /* ---------- One click handler for every action in the console ---------- */
  $('.console-main').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.orderNext) act(() => api(`/orders/${d.orderNext}/status`, { method: 'PATCH', body: { status: d.to } }), `Order moved to ${d.to}.`);
    if (d.orderCancel && armed(b, 'Confirm cancel')) act(() => api(`/orders/${d.orderCancel}/status`, { method: 'PATCH', body: { status: 'cancelled' } }), 'Order cancelled. Stock released.');
    if (d.msg) act(() => api(`/contact/${d.msg}`, { method: 'PATCH', body: { status: d.to } }), `Message marked ${d.to}.`);
    if (d.stock) {
      const p = state.products.find((x) => x._id === d.stock);
      act(() => api(`/products/${p._id}`, { method: 'PUT', body: { stock: Math.max(0, p.stock + Number(d.delta)) } }));
    }
    if (d.edit) openProductDialog(state.products.find((x) => x._id === d.edit));
    if (d.delete && armed(b, 'Confirm')) act(() => api(`/products/${d.delete}`, { method: 'DELETE' }), 'Listing deleted.');
  });
  $('.console-main').addEventListener('change', (e) => {
    const id = e.target.dataset.status;
    if (id) act(() => api(`/products/${id}`, { method: 'PUT', body: { status: e.target.value } }), `Marked ${e.target.value}.`);
  });

  /* ---------- Listing dialog (create / edit) ---------- */
  const dialog = $('#product-dialog');
  const pform = $('#product-form');
  let editingId = null;
  let pendingFile = null; // photo chosen in the dialog, uploaded on save

  /* Photo upload: click or drag a file onto the drop zone, preview it, upload on save */
  const MAX_PHOTO = 5 * 1024 * 1024;
  const dz = $('#dropzone');
  const preview = $('#photo-preview');
  function setPreview(src) {
    preview.hidden = !src;
    preview.style.backgroundImage = src ? `url("${src}")` : '';
    dz.classList.toggle('has-photo', !!src);
  }
  function pickFile(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast('Choose a JPG, PNG or WebP photo.', 'error');
    if (file.size > MAX_PHOTO) return toast('That photo is over 5 MB. Export a smaller version.', 'error');
    pendingFile = file;
    setPreview(URL.createObjectURL(file));
    showFieldErrors(pform, {});
  }
  $('#f-file').addEventListener('change', (e) => pickFile(e.target.files[0]));
  ['dragenter', 'dragover'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove('is-over'); }));
  dz.addEventListener('drop', (e) => pickFile(e.dataTransfer.files[0]));
  pform.elements.image.addEventListener('change', () => { pendingFile = null; setPreview(pform.elements.image.value.trim()); });

  function toggleCategoryFields() {
    const isVehicle = pform.elements.category.value === 'vehicle';
    $$('[data-v]', pform).forEach((el) => (el.hidden = !isVehicle));
    $$('[data-a]', pform).forEach((el) => (el.hidden = isVehicle));
  }
  pform.elements.category.addEventListener('change', toggleCategoryFields);
  $$('[data-close]', dialog).forEach((b) => b.addEventListener('click', () => dialog.close()));

  function openProductDialog(p = null) {
    editingId = p?._id || null;
    $('#dialog-title').textContent = p ? `Edit ${p.name}` : 'Add listing';
    pform.reset();
    pendingFile = null;
    setPreview(p?.image || '');
    showFieldErrors(pform, {});
    $('#product-error').hidden = true;
    if (p) {
      const f = pform.elements;
      ['name', 'category', 'price', 'model', 'stockNumber', 'condition', 'status', 'year', 'trim', 'color', 'deposit', 'stock', 'image', 'summary', 'description', 'disclaimer']
        .forEach((k) => { if (f[k] && p[k] !== undefined) f[k].value = p[k]; });
      f.compatibleWith.value = (p.compatibleWith || []).join(', ');
      f.features.value = (p.features || []).join('\n');
      f.featured.checked = !!p.featured;
      Object.entries(p.specs || {}).forEach(([k, v]) => { if (f[`s-${k}`]) f[`s-${k}`].value = v ?? ''; });
    }
    toggleCategoryFields();
    dialog.showModal();
  }
  $('#add-product').addEventListener('click', () => openProductDialog());

  function readProductForm() {
    const f = pform.elements;
    const n = (v) => (v === '' ? undefined : Number(v));
    const body = {
      name: f.name.value.trim(),
      category: f.category.value,
      price: n(f.price.value),
      image: f.image.value.trim(),
      summary: f.summary.value.trim(),
      description: f.description.value.trim(),
      features: f.features.value.split('\n').map((s) => s.trim()).filter(Boolean),
      featured: f.featured.checked,
    };
    if (body.category === 'vehicle') {
      Object.assign(body, {
        model: f.model.value, stockNumber: f.stockNumber.value.trim(), condition: f.condition.value,
        status: f.status.value, year: n(f.year.value), trim: f.trim.value.trim(), color: f.color.value.trim(),
        deposit: n(f.deposit.value), disclaimer: f.disclaimer.value.trim(),
        specs: Object.fromEntries(
          ['rangeKm', 'zeroTo100', 'topSpeedKph', 'batteryKwh', 'drive', 'seats', 'odometerKm', 'batteryHealth']
            .map((k) => [k, k === 'drive' ? f[`s-${k}`].value : n(f[`s-${k}`].value)])
            .filter(([, v]) => v !== undefined)
        ),
      });
    } else {
      Object.assign(body, {
        model: '',
        stock: n(f.stock.value) ?? 0,
        compatibleWith: f.compatibleWith.value.split(',').map((s) => s.trim()).filter(Boolean),
      });
    }
    return body;
  }

  pform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = readProductForm();
    const errors = {};
    if (!body.name) errors.name = 'Name is required.';
    if (body.price === undefined || body.price < 0) errors.price = 'Enter a price of 0 or more.';
    if (!body.image && !pendingFile) errors.image = 'Add a photo of the car or part.';
    showFieldErrors(pform, errors);
    if (Object.keys(errors).length) return;

    const btn = $('#save-product');
    setBusy(btn, true, pendingFile ? 'Uploading photo…' : 'Saving…');
    try {
      if (pendingFile) {
        body.image = (await apiUpload('/uploads', pendingFile)).path;
        pform.elements.image.value = body.image;
        pendingFile = null;
        btn.textContent = 'Saving…';
      }
      await api(editingId ? `/products/${editingId}` : '/products', { method: editingId ? 'PUT' : 'POST', body });
      toast(editingId ? 'Listing updated.' : 'Listing added.');
      dialog.close();
      await loadAll();
    } catch (err) {
      $('#product-error').textContent = err.message;
      $('#product-error').hidden = false;
      if (err.details) showFieldErrors(pform, err.details);
    } finally {
      setBusy(btn, false);
    }
  });

  // Suggest existing image paths in the dialog.
  fetch('assets/img/credits.json')
    .then((r) => r.json())
    .then((list) => ($('#image-paths').innerHTML = list.map((c) => `<option value="${esc(c.image)}"></option>`).join('')))
    .catch(() => {});

  loadAll();
}
