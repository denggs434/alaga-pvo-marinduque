/**
 * Home page: live lot numbers, model counts, featured cars, accessories.
 */
import { api, qs } from '../api.js';
import { initPage, productCard, skeletonCards, errorState, formatPrice, formatNumber, $, $$ } from '../ui.js';
import { countUp } from '../motion.js';

initPage('home');

const featuredEl = $('#featured');
const accEl = $('#accessories');
featuredEl.innerHTML = skeletonCards(4);
accEl.innerHTML = skeletonCards(3);

async function loadLotStats() {
  // One request for every vehicle on sale gives us all four numbers.
  const { items, facets } = await api(`/products${qs({ category: 'vehicle', limit: 100 })}`);
  const forSale = items.filter((p) => p.status === 'available' && p.condition !== 'pre-order');
  const preOwned = forSale.filter((p) => p.condition === 'pre-owned');

  // Numbers count up like an instrument cluster settling after power-on.
  const km = (n) => `${formatNumber(Math.round(n))} km`;
  countUp($('#stat-count'), forSale.length);
  if (forSale.length) {
    countUp($('#stat-from'), Math.min(...forSale.map((p) => p.price)), (n) => formatPrice(Math.round(n / 1000) * 1000));
    countUp($('#stat-range'), Math.max(...forSale.map((p) => p.specs?.rangeKm || 0)), km);
  }
  if (preOwned.length) countUp($('#stat-km'), Math.min(...preOwned.map((p) => p.specs?.odometerKm ?? Infinity)), km);

  $$('[data-model]').forEach((el) => {
    const n = facets.models[el.dataset.model] || 0;
    el.textContent = n === 1 ? '1 listing' : `${n} listings`;
  });

  const roadster = items.find((p) => p.condition === 'pre-order');
  if (roadster) $('#roadster-link').href = `product.html?slug=${encodeURIComponent(roadster.slug)}`;
}

async function loadFeatured() {
  const { items } = await api(`/products${qs({ featured: 'true', category: 'vehicle', limit: 8 })}`);
  const picks = items.filter((p) => p.condition !== 'pre-order').slice(0, 4);
  featuredEl.innerHTML = picks.map(productCard).join('');
}

async function loadAccessories() {
  const { items } = await api(`/products${qs({ category: 'accessory', limit: 3, sort: 'price-asc' })}`);
  accEl.innerHTML = items.map(productCard).join('');
}

loadLotStats().catch(() => {});
loadFeatured().catch((err) => (featuredEl.innerHTML = errorState(err.message)));
loadAccessories().catch((err) => (accEl.innerHTML = errorState(err.message)));
