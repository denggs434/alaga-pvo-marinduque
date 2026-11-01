/**
 * Product detail page: product.html?slug=<slug>
 */
import { api } from '../api.js';
import { addToCart, DEFAULT_DEPOSIT, isAdmin } from '../store.js';
import { initPage, productCard, errorState, formatPrice, formatNumber, batteryGauge, conditionTag, toast, esc, openCartDrawer, $ } from '../ui.js';

initPage('inventory');

const root = $('#product');
const slug = new URLSearchParams(location.search).get('slug');

function specSheet(p) {
  const s = p.specs || {};
  const claim = p.condition === 'pre-order' ? '*' : '';
  const cells = [
    ['Range', `${formatNumber(s.rangeKm)}<small> km${claim}</small>`],
    ['0–100 km/h', `${Number(s.zeroTo100).toFixed(1)}<small> s${claim}</small>`],
    ['Top speed', `${s.topSpeedKph}<small> km/h${claim}</small>`],
    ['Battery', `${s.batteryKwh}<small> kWh${claim}</small>`],
    ['Drive', esc(s.drive)],
    ['Seats', s.seats],
    ['Odometer', `${formatNumber(s.odometerKm)}<small> km</small>`],
    ['Battery health', s.batteryHealth != null ? batteryGauge(s.batteryHealth) : '<small>n/a</small>'],
  ];
  return `<section class="spec-sheet" aria-label="Specifications">
    <header><span>${esc(p.year)} ${esc(p.model)} · ${esc(p.trim)}</span><span>Stock ${esc(p.stockNumber)}</span></header>
    <dl>${cells.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
  </section>`;
}

function buyBox(p) {
  const isVehicle = p.category === 'vehicle';
  const deposit = p.deposit ?? DEFAULT_DEPOSIT;
  const staff = isAdmin(); // admins manage listings; only customers can buy
  const unavailable = staff || p.status !== 'available' || (!isVehicle && p.stock < 1);

  let note;
  if (!isVehicle) note = p.stock > 0 ? `<strong>${p.stock} in stock.</strong> Paid in full at checkout.` : 'Out of stock. Contact us for the next shipment.';
  else if (p.condition === 'pre-order') note = `Reserve with a <strong>${formatPrice(deposit)}</strong> refundable deposit. The balance is due when Tesla confirms your build.`;
  else if (p.status === 'available') note = `Reserve with a <strong>${formatPrice(deposit)}</strong> refundable deposit. Pay the remaining <strong>${formatPrice(p.price - deposit)}</strong> at handover.`;
  else note = `This car is ${p.status}. Browse similar listings below or ask us to find one for you.`;

  const qty = !isVehicle && !unavailable
    ? `<div class="row"><span class="label">Qty</span>
        <div class="qty"><button type="button" data-step="-1" aria-label="Fewer">−</button>
        <input id="qty" type="number" min="1" max="${p.stock}" value="1" aria-label="Quantity">
        <button type="button" data-step="1" aria-label="More">+</button></div></div>`
    : '';

  const cta = staff
    ? 'Admins cannot order'
    : isVehicle ? (p.condition === 'pre-order' ? 'Reserve build slot' : 'Reserve this car') : 'Add to cart';

  return `<aside class="pdp-buy">
    <div class="stack" style="gap:8px">
      <div class="row">${conditionTag(p)}<span class="label">${isVehicle ? esc(p.color) : 'Accessory'}</span></div>
      <h1 style="font-size:var(--step-3)">${esc(p.name)}</h1>
      <p class="muted">${esc(p.summary)}</p>
    </div>
    <div class="price">${formatPrice(p.price)}</div>
    <p class="deposit-note">${note}</p>
    ${qty}
    <div class="pdp-actions">
      <button class="btn btn-accent btn-block" id="add" type="button" ${unavailable ? 'disabled' : ''}>${cta}</button>
      ${isVehicle ? `<a class="btn btn-ghost btn-block" href="contact.html?topic=test-drive&product=${p._id}">${p.condition === 'pre-order' ? 'Ask about this pre-order' : 'Book a test drive'}</a>` : ''}
    </div>
  </aside>`;
}

function render(p) {
  document.title = `${p.name} | Voltyard Motors`;
  const credit = p.imageCredit
    ? `Photo: ${esc(p.imageCredit.author)}, ${esc(p.imageCredit.license)}, <a href="${esc(p.imageCredit.source)}" target="_blank" rel="noopener">Wikimedia Commons</a>`
    : '';
  const back = p.category === 'vehicle' ? ['products.html', 'Inventory'] : ['products.html?category=accessory', 'Charging & parts'];

  root.innerHTML = `
    <p class="crumbs"><a href="index.html">Home</a> / <a href="${back[0]}">${back[1]}</a> / ${esc(p.name)}</p>
    <div class="pdp">
      <div class="stack" style="min-width:0">
        <figure class="pdp-photo" style="margin:0">
          <img src="${esc(p.image)}" alt="${esc(p.name)}${p.color ? `, ${esc(p.color)}` : ''}" width="1400" height="1050">
          <figcaption class="photo-credit">${credit}</figcaption>
        </figure>
        ${p.disclaimer ? `<p class="disclaimer"><strong>Read before reserving.</strong> ${esc(p.disclaimer)}</p>` : ''}
        ${p.category === 'vehicle' ? specSheet(p) : ''}
        ${p.condition === 'pre-order' ? '<p class="photo-credit">* Manufacturer claim for the prototype, not independently verified.</p>' : ''}
        <div class="stack">
          <h2 style="font-size:var(--step-2)">About this ${p.category === 'vehicle' ? 'car' : 'item'}</h2>
          <p>${esc(p.description)}</p>
          ${p.features?.length ? `<ul class="features">${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
      ${buyBox(p)}
    </div>`;

  const qtyInput = $('#qty');
  root.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]')?.dataset.step;
    if (step && qtyInput) qtyInput.value = Math.min(p.stock, Math.max(1, Number(qtyInput.value) + Number(step)));
  });

  $('#add')?.addEventListener('click', () => {
    const result = addToCart(p, qtyInput ? Number(qtyInput.value) || 1 : 1);
    toast(result.message, result.ok ? 'info' : 'error');
    if (result.ok) openCartDrawer();
  });
}

async function load() {
  if (!slug) {
    root.innerHTML = errorState('No listing was selected.', 'Reload');
    return;
  }
  try {
    const { product, related } = await api(`/products/${encodeURIComponent(slug)}`);
    render(product);
    if (related.length) {
      $('#related-section').hidden = false;
      $('#related-title').textContent = product.category === 'vehicle' ? `More ${product.model} listings and parts` : 'More charging & parts';
      $('#related').innerHTML = related.map(productCard).join('');
    }
  } catch (err) {
    root.innerHTML = `<div class="empty" style="margin-top:32px"><h2>Listing not found</h2>
      <p class="muted">${esc(err.message)}</p><a class="btn" href="products.html">Back to inventory</a></div>`;
  }
}

load();
