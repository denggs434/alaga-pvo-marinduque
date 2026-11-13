/**
 * Shop: the marketplace.
 *  - catalog with search, category chips, "for" species and sorting; "Show more" pages
 *  - ?shop=<id>|official shows one shop with its banner
 *  - "Picked for your pets": products for the species of the user's own pets
 *  - product dialog (?p=<id> opens one): photos, details, quantity, add to cart,
 *    "often bought together" from real orders
 *  - cart drawer (#cart opens it), grouped by shop, then checkout: pickup or
 *    delivery, cash; one order per shop
 */
import { api, qs } from '../api.js';
import { cart } from '../cart.js';
import { getUser, isAdmin } from '../store.js';
import { SPECIES, MUNICIPALITIES, PRODUCT_CATEGORIES, SHOP, peso } from '../config.js';
import { initPage, requireLogin, toast, setupModal, showFieldErrors, setBusy, options, emptyState, errorState, skeleton, debounce, esc, formatDate, ICONS, $, $$ } from '../ui.js';
import { productCard, productImg } from '../components.js';

initPage('shop');

const params = new URLSearchParams(location.search);
const state = { q: '', category: params.get('category') || '', species: '', sort: 'popular', shop: params.get('shop') || '', page: 1, pages: 1 };
const known = new Map(); // product id -> product, for the add buttons
const grid = $('#shop-grid');
const remember = (list) => list.forEach((p) => known.set(p._id, p));
if (isAdmin()) $('#sell-link').hidden = true;

/* ---------- Catalog ---------- */
$('#shop-species').innerHTML = options(SPECIES, '', 'For any pet');
function renderChips() {
  const chip = (k, label, icon) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${state.category === k}">${icon ? ICONS[icon] : ''}${label}</button>`;
  $('#shop-cats').innerHTML = chip('', 'All') + Object.entries(PRODUCT_CATEGORIES).map(([k, c]) => chip(k, c.label, c.icon)).join('');
}

async function load(append = false) {
  if (!append) { state.page = 1; grid.innerHTML = skeleton(8, 260); }
  try {
    const data = await api(`/shop/products${qs({ q: state.q, category: state.category, species: state.species, sort: state.sort, shop: state.shop, page: state.page, limit: 24 })}`);
    remember(data.items);
    state.pages = data.pages;
    const html = data.items.map(productCard).join('');
    if (append) grid.insertAdjacentHTML('beforeend', html);
    else grid.innerHTML = html || emptyState('No products found', 'Try another category or search word.');
    $('#shop-count').textContent = `${data.total} product${data.total === 1 ? '' : 's'}`;
    $('#shop-more').hidden = state.page >= state.pages;
    if (data.shop) banner(data.shop);
  } catch (err) {
    grid.innerHTML = errorState(err.message);
  }
}

function banner(s) {
  const el = $('#shop-banner');
  el.hidden = false;
  el.innerHTML = `<span class="shop-avatar${s.official ? ' is-official' : ''}" aria-hidden="true">${s.official ? ICONS.shieldCheck : esc(s.name[0])}</span>
    <div class="stack-sm" style="gap:2px">
      <h2>${esc(s.name)}${s.official ? ' <span class="tag tag-green">PVO</span>' : ''}</h2>
      <p class="muted small">${esc(s.about || (s.official ? 'Run by the Provincial Veterinary Office. Pick up at the PVO office in Boac.' : ''))}</p>
      <p class="small">${s.products} product${s.products === 1 ? '' : 's'} · ${s.sold} sold${s.municipality ? ` · ${esc(s.municipality)}` : ''}${s.since ? ` · on Alaga since ${formatDate(s.since)}` : ''}</p>
    </div>
    <a class="btn btn-ghost btn-sm" href="shop.html">All shops</a>`;
  $('h1').textContent = s.name;
  document.title = `${s.name} | Alaga Shop`;
}

async function loadExtras() {
  if (state.shop) return;
  api('/shop/shops').then((shops) => {
    if (!shops.length) return;
    $('#shops').hidden = false;
    $('#shops-list').innerHTML = shops.map((s) => `<a class="shop-chip" href="shop.html?shop=${esc(s.id)}">
      <span class="shop-avatar${s.official ? ' is-official' : ''}" aria-hidden="true">${s.official ? ICONS.shieldCheck : esc(s.name[0])}</span>
      <span><strong>${esc(s.name)}</strong><small>${s.products} items · ${s.sold} sold</small></span></a>`).join('');
  }).catch(() => {});
  if (!getUser() || isAdmin()) return;
  try {
    const { pets, items } = await api('/shop/picks');
    if (!items.length) return;
    remember(items);
    const names = pets.map((p) => p.name);
    $('#picks-title').textContent = `Picked for ${names.length > 2 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more` : names.join(' and ')}`;
    $('#picks-why').textContent = 'Best sellers for your pets';
    $('#picks-list').innerHTML = items.map(productCard).join('');
    $('#picks').hidden = false;
  } catch { /* picks are a nicety */ }
}

/* ---------- Product dialog ---------- */
const productDialog = setupModal($('#product-dialog'));
productDialog.addEventListener('close', () => { if (params.has('p')) { params.delete('p'); history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`); } });

async function openProduct(id) {
  const body = $('#product-body');
  body.innerHTML = skeleton(1, 320);
  if (!productDialog.open) productDialog.showModal();
  try {
    const p = await api(`/shop/products/${id}`);
    remember([p, ...p.related]);
    $('#product-title').textContent = PRODUCT_CATEGORIES[p.category]?.label || 'Product';
    const out = p.stock < 1;
    const forWho = p.species.length ? p.species.map((s) => SPECIES[s]).join(', ') : 'Any pet';
    body.innerHTML = `<div class="pd">
      <div class="pd-photo">${productImg(p)}</div>
      <div class="stack-sm pd-info">
        <h3 class="pd-name">${esc(p.name)}</h3>
        <div class="row" style="gap:10px"><span class="pd-price">${peso(p.price)}</span>${p.sold ? `<span class="muted small">${p.sold} sold</span>` : ''}</div>
        <a class="pd-shop" href="shop.html?shop=${esc(p.shop.id)}">${p.shop.official ? ICONS.shieldCheck : ICONS.bag}<span><strong>${esc(p.shop.name)}</strong><small>${esc(p.shop.municipality || 'Marinduque')} · view shop</small></span></a>
        <dl class="pd-facts"><dt>For</dt><dd>${esc(forWho)}</dd>${p.brand ? `<dt>Brand</dt><dd>${esc(p.brand)}</dd>` : ''}<dt>Stock</dt><dd>${out ? 'Sold out' : `${p.stock} available`}</dd><dt>Payment</dt><dd>Cash on pickup or delivery</dd></dl>
        <p class="pd-desc">${esc(p.description)}</p>
        ${out ? '<p class="notice">Sold out for now. Check back soon.</p>' : `<div class="row pd-buy">
          <div class="stepper" role="group" aria-label="Quantity"><button type="button" data-step="-1" aria-label="Fewer">${ICONS.minus}</button><input id="pd-qty" type="number" min="1" max="${Math.min(20, p.stock)}" value="1" aria-label="Quantity"><button type="button" data-step="1" aria-label="More">${ICONS.plus}</button></div>
          <button class="btn btn-soft" type="button" data-pd-add="${p._id}">${ICONS.bag}Add to cart</button>
          <button class="btn btn-primary" type="button" data-pd-buy="${p._id}">Buy now</button>
        </div>`}
      </div>
    </div>
    ${p.related.length ? `<section class="stack-sm"><h3 style="font-size:1rem">${p.related.some((r) => r.together) ? 'Often bought together' : 'You may also like'}</h3>
      <div class="product-row">${p.related.map(productCard).join('')}</div></section>` : ''}`;
    params.set('p', p._id);
    history.replaceState(null, '', `${location.pathname}?${params}${location.hash}`);
  } catch (err) {
    body.innerHTML = errorState(err.message);
  }
}

$('#product-body').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const qty = $('#pd-qty');
  if (b.dataset.step) qty.value = Math.max(1, Math.min(Number(qty.max), Number(qty.value || 1) + Number(b.dataset.step)));
  if (b.dataset.pdAdd || b.dataset.pdBuy) {
    const p = known.get(b.dataset.pdAdd || b.dataset.pdBuy);
    addToCart(p, Math.max(1, Number(qty.value) || 1));
    if (b.dataset.pdBuy) { productDialog.close(); openCart(); }
  }
});

/* ---------- Cart ---------- */
const drawer = $('#cart-drawer');
$$('[data-close]', drawer).forEach((b) => b.addEventListener('click', () => drawer.close()));
drawer.addEventListener('click', (e) => e.target === drawer && drawer.close());
drawer.addEventListener('close', () => { if (location.hash === '#cart') history.replaceState(null, '', location.pathname + location.search); });

function addToCart(p, qty = 1) {
  if (!p) return;
  if (isAdmin()) return toast('Staff accounts cannot buy. Log in with a pet owner account.', 'error');
  const before = cart.qtyOf(p._id);
  const now = cart.add(p, qty);
  toast(now === before ? `You already have all ${p.stock} in your cart.` : `Added to cart: ${p.name}`);
}

/** Cart lines grouped by shop: [{ shop, shopId, lines, subtotal }] */
function byShop(lines = cart.lines()) {
  const groups = new Map();
  for (const l of lines) {
    const key = l.shopId || 'official';
    if (!groups.has(key)) groups.set(key, { shop: l.shop || 'Alaga Official Store', shopId: key, lines: [], subtotal: 0 });
    const g = groups.get(key);
    g.lines.push(l);
    g.subtotal += l.price * l.qty;
  }
  return [...groups.values()];
}

function renderCart() {
  const groups = byShop();
  const body = $('#cart-body');
  if (!groups.length) {
    body.innerHTML = emptyState('Your cart is empty', 'Add food, toys or gear for your pets.');
    $('#cart-foot').innerHTML = '';
    return;
  }
  body.innerHTML = groups.map((g) => `<section class="cart-shop">
    <a class="cart-shop-name" href="shop.html?shop=${esc(g.shopId)}">${ICONS.bag}${esc(g.shop)}</a>
    <ul>${g.lines.map((l) => `<li class="cart-line">
      ${productImg(l)}
      <div class="stack-sm" style="gap:4px"><span class="cart-name">${esc(l.name)}</span><b>${peso(l.price)}</b>
        <div class="row" style="gap:8px"><div class="stepper stepper-sm" role="group" aria-label="Quantity of ${esc(l.name)}"><button type="button" data-qty="${l.id}" data-d="-1" aria-label="Fewer" ${l.qty <= 1 ? 'disabled' : ''}>${ICONS.minus}</button><span>${l.qty}</span><button type="button" data-qty="${l.id}" data-d="1" aria-label="More" ${l.qty >= Math.min(20, l.stock || 20) ? 'disabled' : ''}>${ICONS.plus}</button></div>
        <button class="link-btn small" type="button" data-remove="${l.id}">Remove</button></div>
      </div></li>`).join('')}</ul>
  </section>`).join('');
  const total = cart.subtotal();
  $('#cart-foot').innerHTML = `<div class="row between"><span>Subtotal (${cart.count()} item${cart.count() === 1 ? '' : 's'})</span><strong style="font-size:1.25rem">${peso(total)}</strong></div>
    <p class="muted small" style="margin:0">${groups.length > 1 ? `From ${groups.length} shops: you will get ${groups.length} orders. ` : ''}Delivery ${peso(SHOP.deliveryFee)} per shop, free from ${peso(SHOP.freeDeliveryFrom)}.</p>
    <button class="btn btn-primary btn-block" type="button" id="to-checkout">Checkout</button>`;
}

function openCart() {
  renderCart();
  if (!drawer.open) drawer.showModal();
}
drawer.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.qty) cart.setQty(b.dataset.qty, cart.qtyOf(b.dataset.qty) + Number(b.dataset.d));
  if (b.dataset.remove) cart.remove(b.dataset.remove);
  if (b.id === 'to-checkout') openCheckout();
});
document.addEventListener('cart:change', () => drawer.open && renderCart());
// The header cart button opens the drawer here instead of reloading the page.
$('#cart-btn')?.addEventListener('click', (e) => { e.preventDefault(); openCart(); });

/* ---------- Checkout ---------- */
const coDialog = setupModal($('#checkout-dialog'));
const coForm = $('#checkout-form');
$('#co-town').innerHTML = options(MUNICIPALITIES, '', 'Choose');
const delivery = () => coForm.elements.fulfillment.value === 'delivery';

function renderSummary() {
  const groups = byShop();
  const fee = (g) => (delivery() && g.subtotal < SHOP.freeDeliveryFrom ? SHOP.deliveryFee : 0);
  const total = groups.reduce((s, g) => s + g.subtotal + fee(g), 0);
  $('#address-fields').hidden = !delivery();
  $('#co-summary').innerHTML = `${groups.map((g) => `<div class="row between"><span>${esc(g.shop)} <span class="muted">(${g.lines.reduce((n, l) => n + l.qty, 0)})</span></span><span>${peso(g.subtotal)}${fee(g) ? ` + ${peso(fee(g))}` : ''}</span></div>`).join('')}
    <div class="row between co-total"><strong>Total, cash</strong><strong>${peso(total)}</strong></div>`;
}
coForm.addEventListener('change', renderSummary);

function openCheckout() {
  if (isAdmin()) return toast('Staff accounts cannot buy. Log in with a pet owner account.', 'error');
  if (!getUser()) {
    drawer.close();
    return requireLogin('Log in to check out. Your cart is saved.');
  }
  const u = getUser();
  const f = coForm.elements;
  if (!f.name.value) f.name.value = u.name || '';
  if (!f.phone.value) f.phone.value = u.phone || '';
  if (!f.municipality.value) f.municipality.value = u.municipality || '';
  if (!f.barangay.value) f.barangay.value = u.barangay || '';
  showFieldErrors(coForm, {});
  $('#co-error').hidden = true;
  renderSummary();
  drawer.close();
  coDialog.showModal();
}

coForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = coForm.elements;
  const errors = {};
  if (!f.name.value.trim()) errors.name = 'Enter your name.';
  if (!/^[0-9+()\s-]{7,20}$/.test(f.phone.value.trim())) errors.phone = 'Enter a mobile number the seller can text.';
  if (delivery()) {
    if (!f.municipality.value) errors.municipality = 'Choose the municipality.';
    if (!f.barangay.value.trim()) errors.barangay = 'Enter the barangay.';
  }
  showFieldErrors(coForm, errors);
  if (Object.keys(errors).length) return;
  const btn = $('#co-submit');
  setBusy(btn, true, 'Placing order…');
  try {
    const { orders } = await api('/shop/orders', {
      method: 'POST',
      body: {
        items: cart.lines().map((l) => ({ product: l.id, qty: l.qty })),
        fulfillment: f.fulfillment.value,
        contact: { name: f.name.value.trim(), phone: f.phone.value.trim() },
        address: { municipality: f.municipality.value, barangay: f.barangay.value.trim(), details: f.details.value.trim() },
        note: f.note.value.trim(),
      },
    });
    cart.clear();
    coForm.reset();
    $('#checkout-title').textContent = 'Order placed';
    coForm.querySelector('.modal-body').innerHTML = `<div class="empty" style="padding:8px 0">${ICONS.check}<h3>Thank you! ${orders.length > 1 ? `${orders.length} orders placed` : 'Your order is placed'}.</h3>
      <p>${orders.map((o) => `<span class="mono">${esc(o.reference)}</span> · ${esc(o.shopName)} · ${peso(o.total)}`).join('<br>')}</p>
      <p>The seller will confirm by text. Track it under My orders; you will get a notification at every step.</p></div>`;
    coForm.querySelector('.modal-foot').innerHTML = '<a class="btn btn-ghost" href="shop.html">Keep shopping</a><a class="btn btn-primary" href="account.html#orders">View my orders</a>';
    load();
  } catch (err) {
    $('#co-error').textContent = err.message;
    $('#co-error').hidden = false;
    if (err.details?.product) load();
    setBusy(btn, false);
  }
});

/* ---------- Events ---------- */
document.querySelector('main').addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) return addToCart(known.get(add.dataset.add));
  const open = e.target.closest('[data-product]');
  if (open) openProduct(open.dataset.product);
});
$('#product-body').addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) return addToCart(known.get(add.dataset.add));
  const open = e.target.closest('[data-product]');
  if (open) openProduct(open.dataset.product);
});
$('#shop-cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  state.category = b.dataset.cat;
  $$('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  load();
});
$('#shop-q').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); load(); }));
$('#shop-species').addEventListener('change', (e) => { state.species = e.target.value; load(); });
$('#shop-sort').addEventListener('change', (e) => { state.sort = e.target.value; load(); });
$('#shop-more').addEventListener('click', () => { state.page += 1; load(true); });

renderChips();
load();
loadExtras();
if (params.get('p')) openProduct(params.get('p'));
if (location.hash === '#cart') openCart();
