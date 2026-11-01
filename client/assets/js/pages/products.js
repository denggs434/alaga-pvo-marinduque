/**
 * Inventory page. Filter state lives in the URL query string, so filtered
 * views can be bookmarked and shared (e.g. products.html?model=Model%20Y).
 */
import { api, qs } from '../api.js';
import { initPage, productCard, skeletonCards, errorState, formatPrice, esc, $, $$ } from '../ui.js';

const MODELS = ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck', 'Roadster'];
const PAGE_SIZE = 12;
const PRICE_MAX = 15000000;

const params = new URLSearchParams(location.search);
const state = {
  category: params.get('category') || 'vehicle',
  model: params.get('model') ? params.get('model').split(',') : [],
  condition: params.get('condition') || '',
  maxPrice: Number(params.get('maxPrice')) || PRICE_MAX,
  minRange: Number(params.get('minRange')) || 0,
  q: params.get('q') || '',
  sort: params.get('sort') || '',
  page: Number(params.get('page')) || 1,
};

initPage(state.category === 'accessory' ? 'accessories' : state.condition === 'pre-order' ? 'preorder' : 'inventory');

const form = $('#filters');
const results = $('#results');

/* ---------- Render controls from state ---------- */
function renderModelOptions(counts = {}) {
  $('#model-options').innerHTML = MODELS.map(
    (m) => `<label class="check">
      <input type="checkbox" name="model" value="${m}" ${state.model.includes(m) ? 'checked' : ''}>
      ${m}<span class="count">${counts[m] ?? 0}</span>
    </label>`
  ).join('');
}

function syncControls() {
  $$('[data-category]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.category === state.category)));
  const isVehicle = state.category === 'vehicle';
  $('#model-filter').hidden = !isVehicle;
  $('#condition-filter').hidden = !isVehicle;
  $('#range-filter').hidden = !isVehicle;
  form.elements.condition.value = state.condition;
  $('#maxPrice').value = state.maxPrice;
  $('#minRange').value = state.minRange;
  $('#q').value = state.q;
  $('#sort').value = state.sort;
  $('#maxPrice-out').textContent = state.maxPrice >= PRICE_MAX ? 'Any' : `Up to ${formatPrice(state.maxPrice)}`;
  $('#minRange-out').textContent = state.minRange ? `${state.minRange}+ km` : 'Any';

  const titles = {
    vehicle: ['Inventory', 'Every car listed here is on our lot in Mogpog, Marinduque, except pre-orders.'],
    accessory: ['Charging & parts', 'Home chargers, wheels and parts for your Tesla. Paid in full at checkout.'],
  };
  let [title, lede] = titles[state.category];
  if (isVehicle && state.condition === 'pre-order') {
    title = 'Pre-order';
    lede = 'Vehicles Tesla has announced but not yet built. Reserve a build slot with a refundable deposit.';
  }
  $('#page-title').textContent = title;
  $('#crumb-current').textContent = title;
  $('#page-lede').textContent = lede;
  document.title = `${title} | Voltyard Motors`;
}

/* ---------- Load ---------- */
function apiParams() {
  const isVehicle = state.category === 'vehicle';
  return {
    category: state.category,
    model: isVehicle ? state.model.join(',') : '',
    condition: isVehicle ? state.condition : '',
    maxPrice: state.maxPrice < PRICE_MAX ? state.maxPrice : '',
    minRange: isVehicle && state.minRange ? state.minRange : '',
    q: state.q,
    sort: state.sort,
    page: state.page > 1 ? state.page : '',
  };
}

let requestId = 0;
async function load() {
  const id = ++requestId;
  const p = apiParams();
  history.replaceState(null, '', `products.html${qs(p)}`);
  results.innerHTML = skeletonCards(6);
  $('#result-count').textContent = 'Loading…';

  try {
    const data = await api(`/products${qs({ ...p, limit: PAGE_SIZE })}`);
    if (id !== requestId) return; // a newer request replaced this one
    if (state.category === 'vehicle') renderModelOptions(data.facets.models);

    const noun = state.category === 'vehicle' ? 'vehicle' : 'item';
    $('#result-count').textContent = `${data.total} ${noun}${data.total === 1 ? '' : 's'}`;
    results.innerHTML = data.items.length
      ? data.items.map(productCard).join('')
      : `<div class="empty" style="grid-column:1/-1">
           <h3>No matches</h3>
           <p class="muted">Nothing fits those filters${state.q ? ` and the search “${esc(state.q)}”` : ''}. Widen the price or range, or clear the filters.</p>
           <button class="btn btn-ghost" type="button" id="empty-reset">Clear filters</button>
         </div>`;
    $('#empty-reset')?.addEventListener('click', resetFilters);
    renderPager(data.page, data.pages);
  } catch (err) {
    results.innerHTML = errorState(err.message);
    $('#result-count').textContent = '';
  }
}

function renderPager(page, pages) {
  const pager = $('#pager');
  if (pages <= 1) return (pager.innerHTML = '');
  pager.innerHTML = Array.from({ length: pages }, (_, i) => i + 1)
    .map((n) => `<button class="btn btn-sm ${n === page ? '' : 'btn-ghost'}" type="button" data-page="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`)
    .join('');
}

/* ---------- Events ---------- */
const debounce = (fn, ms = 250) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
const update = (patch) => {
  Object.assign(state, patch, patch.page ? {} : { page: 1 });
  syncControls();
  load();
};

$$('[data-category]').forEach((b) =>
  b.addEventListener('click', () => update({ category: b.dataset.category, model: [], condition: '', minRange: 0 }))
);
form.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'model') update({ model: $$('input[name=model]:checked').map((i) => i.value) });
  if (t.name === 'condition') update({ condition: t.value });
});
$('#maxPrice').addEventListener('input', (e) => {
  state.maxPrice = Number(e.target.value);
  syncControls();
});
$('#maxPrice').addEventListener('change', () => update({}));
$('#minRange').addEventListener('input', (e) => {
  state.minRange = Number(e.target.value);
  syncControls();
});
$('#minRange').addEventListener('change', () => update({}));
$('#q').addEventListener('input', debounce((e) => update({ q: e.target.value.trim() })));
$('#sort').addEventListener('change', (e) => update({ sort: e.target.value }));
$('#pager').addEventListener('click', (e) => {
  const n = e.target.closest('[data-page]')?.dataset.page;
  if (n) { update({ page: Number(n) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

function resetFilters() {
  update({ model: [], condition: '', maxPrice: PRICE_MAX, minRange: 0, q: '', sort: '' });
}
form.addEventListener('reset', (e) => { e.preventDefault(); resetFilters(); });

$('#filters-toggle').addEventListener('click', (e) => {
  const open = form.classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

renderModelOptions();
syncControls();
load();
