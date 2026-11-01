/**
 * Admin panel. Every request goes through the API with the admin's token;
 * the server enforces the admin role, this page only hides the UI.
 */
import { api, qs } from '../api.js';
import { isAdmin } from '../store.js';
import { initPage, formatPrice, formatNumber, formatDate, esc, toast, showFieldErrors, setBusy, $, $$ } from '../ui.js';

initPage('admin');

if (!isAdmin()) {
  $('#denied').hidden = false;
  throw new Error('Not an admin'); // stop this module; the page shows the login prompt
}
$('#admin').hidden = false;

/* ---------- Tabs ---------- */
const loaders = {};
$$('[data-tab]').forEach((tab) =>
  tab.addEventListener('click', () => {
    $$('[data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.tab));
    loaders[tab.dataset.tab]?.();
  })
);

const statusSelect = (id, current, options, kind) =>
  `<select class="input" style="min-height:34px;padding:4px 8px;width:auto" data-${kind}="${id}" aria-label="Status">
    ${options.map((o) => `<option value="${o}" ${o === current ? 'selected' : ''}>${o}</option>`).join('')}
  </select>`;

/* ---------- Summary tiles ---------- */
async function loadStats() {
  try {
    const s = await api('/admin/stats');
    const v = s.vehicles;
    $('#tiles').innerHTML = `
      <div class="tile"><span class="label">Cars available</span><strong>${v.available || 0}</strong><small>${v.reserved || 0} reserved · ${v.sold || 0} sold</small></div>
      <div class="tile"><span class="label">Pending orders</span><strong>${s.orders.pending || 0}</strong><small>${s.orders.confirmed || 0} confirmed · ${s.orders.ready || 0} ready</small></div>
      <div class="tile"><span class="label">New messages</span><strong>${s.newMessages}</strong><small>${s.customers} customer accounts</small></div>
      <div class="tile"><span class="label">Deposits & sales booked</span><strong>${formatPrice(s.collected)}</strong><small>${s.lowStockAccessories} accessories low on stock</small></div>`;
  } catch (err) {
    $('#tiles').innerHTML = `<p class="notice notice-error">${esc(err.message)}</p>`;
  }
}

/* ---------- Inventory ---------- */
let inventory = [];
function renderInventory() {
  const term = $('#inv-search').value.trim().toLowerCase();
  const rows = inventory.filter((p) => !term || `${p.name} ${p.stockNumber || ''}`.toLowerCase().includes(term));
  $('#inv-table').innerHTML = `
    <thead><tr><th></th><th>Listing</th><th>Type</th><th>Status</th><th class="num">Stock</th><th class="num">Price</th><th></th></tr></thead>
    <tbody>${rows.map((p) => `<tr>
      <td><img class="thumb" src="${esc(p.image)}" alt=""></td>
      <td><a href="product.html?slug=${encodeURIComponent(p.slug)}">${esc(p.name)}</a><br><span class="mono muted" style="font-size:.8125rem">${esc(p.stockNumber || '')}</span></td>
      <td>${p.category === 'vehicle' ? esc(p.condition) : 'accessory'}</td>
      <td><span class="status status-${p.status}">${p.status}</span></td>
      <td class="num">${p.condition === 'pre-order' ? '∞' : p.stock}</td>
      <td class="num">${formatPrice(p.price)}</td>
      <td><div class="row" style="flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-edit="${p._id}">Edit</button><button class="btn btn-danger btn-sm" data-delete="${p._id}">Delete</button></div></td>
    </tr>`).join('') || '<tr><td colspan="7" class="muted">No listings match.</td></tr>'}</tbody>`;
}
loaders.inventory = async () => {
  try {
    const { items } = await api(`/products${qs({ all: 'true', limit: 100, sort: 'newest' })}`);
    inventory = items;
    renderInventory();
  } catch (err) {
    $('#inv-table').innerHTML = `<tr><td class="notice-error">${esc(err.message)}</td></tr>`;
  }
};
$('#inv-search').addEventListener('input', renderInventory);

$('#inv-table').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.edit) openProductDialog(inventory.find((p) => p._id === btn.dataset.edit));
  if (btn.dataset.delete) {
    if (btn.dataset.armed !== 'true') {
      btn.dataset.armed = 'true';
      btn.textContent = 'Confirm';
      setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'Delete'; }, 3000);
      return;
    }
    try {
      const res = await api(`/products/${btn.dataset.delete}`, { method: 'DELETE' });
      toast(res.message);
      loaders.inventory();
      loadStats();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

/* ---------- Listing dialog ---------- */
const dialog = $('#product-dialog');
const pform = $('#product-form');
let editingId = null;

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
  if (!body.image) errors.image = 'Pick an image path.';
  showFieldErrors(pform, errors);
  if (Object.keys(errors).length) return;

  const btn = $('#save-product');
  setBusy(btn, true, 'Saving…');
  try {
    await api(editingId ? `/products/${editingId}` : '/products', { method: editingId ? 'PUT' : 'POST', body });
    toast(editingId ? 'Listing updated.' : 'Listing added.');
    dialog.close();
    loaders.inventory();
    loadStats();
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

/* ---------- Orders ---------- */
const ORDER_STATUSES = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];
loaders.orders = async () => {
  try {
    const orders = await api('/orders');
    $('#orders-table').innerHTML = `
      <thead><tr><th>Reference</th><th>Date</th><th>Customer</th><th>Items</th><th>Fulfilment</th><th class="num">Due now</th><th class="num">Total</th><th>Status</th></tr></thead>
      <tbody>${orders.map((o) => `<tr>
        <td class="mono">${esc(o.reference)}</td>
        <td>${formatDate(o.createdAt)}</td>
        <td>${esc(o.fulfillment.fullName)}<br><span class="muted mono" style="font-size:.8125rem">${esc(o.fulfillment.phone)}</span></td>
        <td>${o.items.map((i) => `${esc(i.name)}${i.qty > 1 ? ` × ${i.qty}` : ''}`).join('<br>')}</td>
        <td>${o.fulfillment.method === 'delivery' ? `Delivery: ${esc(o.fulfillment.address)}${o.fulfillment.city ? `, ${esc(o.fulfillment.city)}` : ''}` : 'Pickup'}</td>
        <td class="num">${formatPrice(o.dueNow)}</td>
        <td class="num">${formatPrice(o.subtotal)}</td>
        <td>${['completed', 'cancelled'].includes(o.status) ? `<span class="status status-${o.status}">${o.status}</span>` : statusSelect(o._id, o.status, ORDER_STATUSES, 'order')}</td>
      </tr>`).join('') || '<tr><td colspan="8" class="muted">No orders yet.</td></tr>'}</tbody>`;
  } catch (err) {
    $('#orders-table').innerHTML = `<tr><td>${esc(err.message)}</td></tr>`;
  }
};
$('#orders-table').addEventListener('change', async (e) => {
  const id = e.target.dataset.order;
  if (!id) return;
  try {
    await api(`/orders/${id}/status`, { method: 'PATCH', body: { status: e.target.value } });
    toast(`Order marked ${e.target.value}.`);
    loaders.orders();
    loadStats();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Messages ---------- */
const TOPIC_LABEL = { 'test-drive': 'Test drive', financing: 'Financing', 'trade-in': 'Trade-in', general: 'General' };
loaders.messages = async () => {
  try {
    const msgs = await api('/contact');
    $('#messages-table').innerHTML = `
      <thead><tr><th>Received</th><th>From</th><th>Topic</th><th>Message</th><th>Status</th></tr></thead>
      <tbody>${msgs.map((m) => `<tr>
        <td>${formatDate(m.createdAt)}</td>
        <td>${esc(m.name)}<br><span class="muted" style="font-size:.8125rem">${esc(m.email)}${m.phone ? ` · ${esc(m.phone)}` : ''}</span></td>
        <td>${TOPIC_LABEL[m.topic]}${m.preferredDate ? `<br><span class="muted mono" style="font-size:.8125rem">${formatDate(m.preferredDate)}</span>` : ''}${m.product ? `<br><a href="product.html?slug=${encodeURIComponent(m.product.slug)}">${esc(m.product.stockNumber || m.product.name)}</a>` : ''}</td>
        <td style="min-width:240px">${esc(m.message)}</td>
        <td>${statusSelect(m._id, m.status, ['new', 'replied', 'closed'], 'message')}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted">No messages yet.</td></tr>'}</tbody>`;
  } catch (err) {
    $('#messages-table').innerHTML = `<tr><td>${esc(err.message)}</td></tr>`;
  }
};
$('#messages-table').addEventListener('change', async (e) => {
  const id = e.target.dataset.message;
  if (!id) return;
  try {
    await api(`/contact/${id}`, { method: 'PATCH', body: { status: e.target.value } });
    toast(`Message marked ${e.target.value}.`);
    loadStats();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Customers ---------- */
loaders.customers = async () => {
  try {
    const users = await api('/users');
    $('#customers-table').innerHTML = `
      <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Role</th><th>Joined</th></tr></thead>
      <tbody>${users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td class="mono">${esc(u.phone || '—')}</td><td>${u.role}</td><td>${formatDate(u.createdAt)}</td></tr>`).join('')}</tbody>`;
  } catch (err) {
    $('#customers-table').innerHTML = `<tr><td>${esc(err.message)}</td></tr>`;
  }
};

loadStats();
loaders.inventory();
