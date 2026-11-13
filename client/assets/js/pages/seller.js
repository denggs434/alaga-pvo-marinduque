/**
 * Seller Center: everything a seller does on Alaga Market.
 *  - not a seller yet: the application (shop name, what you sell, pickup point,
 *    about, seller rules); rejected applications show the PVO's reason
 *  - under review: what was sent and what happens next
 *  - approved (or suspended): dashboard with orders to handle, sales, items sold
 *    and stock; Orders (to do / completed / cancelled / all) and Products
 *    (add, edit, delete); shop details
 */
import { api } from '../api.js';
import { initPage, requireLogin, toast, showFieldErrors, setBusy, emptyState, errorState, skeleton, esc, formatDateTime, ICONS, $ } from '../ui.js';
import { orderCard, productImg } from '../components.js';
import { productEditor } from '../product-editor.js';
import { peso, PRODUCT_CATEGORIES } from '../config.js';

initPage('seller');
const user = requireLogin('Log in to open the Seller Center.');

const shopState = { shop: null, products: [], orders: [], filter: 'open', view: 'orders' };
let editor;
async function loadShop() {
  const box = $('#seller-root');
  box.innerHTML = skeleton(2, 120);
  try {
    const [mine, orders] = await Promise.all([api('/shop/mine'), api('/shop/orders/selling')]);
    Object.assign(shopState, mine, { orders });
    renderShop();
  } catch (err) {
    box.innerHTML = errorState(err.message);
  }
}

function renderShop() {
  const { shop, products, orders } = shopState;
  const box = $('#seller-root');
  if (shop.status !== 'approved' && shop.status !== 'suspended') {
    box.innerHTML = shop.status === 'pending' ? pendingHtml(shop) : applyHtml(shop);
    return;
  }
  if (shopState.editing) {
    box.innerHTML = applyHtml(shop, true);
    return;
  }
  const done = orders.filter((o) => o.status === 'completed');
  const sales = done.reduce((s, o) => s + o.total, 0);
  const month = done.filter((o) => new Date(o.updatedAt || o.createdAt) > new Date(Date.now() - 30 * 864e5)).reduce((s, o) => s + o.total, 0);
  const todo = orders.filter((o) => ['placed', 'confirmed', 'ready'].includes(o.status));
  const fresh = orders.filter((o) => o.status === 'placed').length;
  const low = products.filter((p) => p.active && p.stock <= 5);
  const FILTERS = { open: ['To do', todo.length], completed: ['Completed', done.length], cancelled: ['Cancelled', orders.filter((o) => o.status === 'cancelled').length], all: ['All', orders.length] };
  const shown = orders.filter((o) => (shopState.filter === 'all' ? true : shopState.filter === 'open' ? todo.includes(o) : o.status === shopState.filter));
  const tile = (label, value, note, warn) => `<div class="kpi${warn ? ' is-warn' : ''}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
  box.innerHTML = `${shop.status === 'suspended' ? `<p class="notice notice-error" style="margin-bottom:14px"><strong>Your shop is suspended.</strong> Your products are hidden from Alaga Market. Reason: ${esc(shop.reason || 'not given')}. <a href="messages.html">Message the PVO</a> to have it restored.</p>` : ''}
    <header class="sc-head">
      <div class="row" style="gap:14px;flex-wrap:nowrap"><span class="shop-avatar sc-avatar" aria-hidden="true">${esc(shop.name[0])}</span>
        <div><p class="sc-kicker">Seller Center</p><h1>${esc(shop.name)}</h1><p class="muted small" style="margin:0">${esc(shop.pickup || '')}${shop.status === 'approved' ? ' · <span class="sc-live">Open for orders</span>' : ''}</p></div></div>
      <div class="row" style="gap:8px"><a class="btn btn-ghost btn-sm" href="shop.html?shop=${esc(shop.id)}">${ICONS.eye}View shop</a><button class="btn btn-ghost btn-sm" type="button" data-edit-shop>${ICONS.edit}Shop details</button>${shop.status === 'approved' ? `<button class="btn btn-primary btn-sm" type="button" data-new-product>${ICONS.plus}Add product</button>` : ''}</div>
    </header>
    <div class="kpi-row">
      ${tile('Orders to handle', todo.length, fresh ? `${fresh} new, confirm them first` : 'All caught up', fresh > 0)}
      ${tile('Sales, last 30 days', peso(month), `${peso(sales)} all time`)}
      ${tile('Items sold', products.reduce((n, p) => n + p.sold, 0), `${done.length} completed orders`)}
      ${tile('Products live', products.filter((p) => p.active).length, low.length ? `${low.length} low on stock` : `${products.length} listed`, low.length > 0)}
    </div>
    <div class="seg sc-switch" role="tablist" aria-label="Seller Center">
      <button type="button" role="tab" data-scview="orders" aria-pressed="${shopState.view === 'orders'}">Orders${todo.length ? ` <b>${todo.length}</b>` : ''}</button>
      <button type="button" role="tab" data-scview="products" aria-pressed="${shopState.view === 'products'}">Products <b>${products.length}</b></button>
    </div>
    ${shopState.view === 'orders' ? `<div class="chips" role="group" aria-label="Show" style="margin:12px 0">${Object.entries(FILTERS).map(([k, [l, n]]) => `<button class="chip" type="button" data-ofilter="${k}" aria-pressed="${shopState.filter === k}">${l} <b>${n}</b></button>`).join('')}</div>
    <div class="stack">${shown.map((o) => orderCard(o, 'seller')).join('') || emptyState(shopState.filter === 'open' ? 'No orders to handle' : 'No orders here', 'New orders show up here and in your notifications.')}</div>`
    : `<div class="sc-products">${products.map((p) => `<article class="card sc-product${p.active ? '' : ' is-hidden'}">
      <div class="sc-product-photo">${productImg(p)}${p.active ? '' : '<span class="tag">Hidden</span>'}${p.active && p.stock <= 5 ? `<span class="tag ${p.stock ? 'tag-amber' : 'tag-red'}">${p.stock ? `${p.stock} left` : 'Sold out'}</span>` : ''}</div>
      <div class="sc-product-body"><strong>${esc(p.name)}</strong><span class="product-price">${peso(p.price)}</span><span class="muted small">${p.stock} in stock · ${p.sold} sold</span></div>
      <div class="sc-product-actions"><button class="btn btn-ghost btn-sm" type="button" data-edit-product="${p._id}">${ICONS.edit}Edit</button><button class="btn btn-danger btn-sm" type="button" data-del-product="${p._id}" aria-label="Delete ${esc(p.name)}">${ICONS.trash}</button></div>
    </article>`).join('')}${shop.status === 'approved' ? `<button class="pet-tile-add sc-add" type="button" data-new-product>${ICONS.plus}<strong>Add a product</strong><span>A clear photo, a fair price and how many you have.</span></button>` : ''}</div>`}`;
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

$('#seller-root').addEventListener('submit', async (e) => {
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
    window.scrollTo(0, 0);
    shopState.editing = false;
    await loadShop();
  } catch (err) {
    setBusy(btn, false);
    showFieldErrors(form, err.details || { shopName: err.message });
    form.querySelectorAll('[data-for]').forEach((el) => { el.textContent = err.details?.[el.dataset.for] || ''; });
  }
});
$('#seller-root').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  editor ||= productEditor({ onSaved: loadShop });
  if (d.newProduct !== undefined) editor.open();
  if (d.editShop !== undefined) { shopState.editing = true; renderShop(); }
  if (d.cancelEdit !== undefined) { shopState.editing = false; renderShop(); }
  if (d.editProduct) editor.open(shopState.products.find((p) => p._id === d.editProduct));
  if (d.ofilter) { shopState.filter = d.ofilter; renderShop(); }
  if (d.scview) { shopState.view = d.scview; renderShop(); }
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


if (user) {
  if (user.role === 'admin') location.replace('admin.html#sellers');
  else loadShop();
}
