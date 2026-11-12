/**
 * Pet directory: search + filters (species chips, municipality, sex, sort) and paging.
 * Filter state lives in the URL, so a filtered view can be bookmarked or shared.
 */
import { api, qs } from '../api.js';
import { SPECIES_PLURAL, SPECIES_ICON, MUNICIPALITIES } from '../config.js';
import { initPage, options, emptyState, errorState, skeleton, debounce, plural, ICONS, $ } from '../ui.js';
import { petCard } from '../components.js';

initPage('pets');

const PAGE_SIZE = 12;
const form = $('#filters');
const results = $('#results');
const params = new URLSearchParams(location.search);
const state = {
  q: params.get('q') || '',
  species: params.get('species') || '',
  municipality: params.get('municipality') || '',
  sex: params.get('sex') || '',
  sort: params.get('sort') || 'newest',
  page: Number(params.get('page')) || 1,
};

form.elements.municipality.innerHTML = options(MUNICIPALITIES, state.municipality, 'All municipalities');
['q', 'sex', 'sort'].forEach((k) => (form.elements[k].value = state[k]));

function renderChips(facets = {}) {
  const total = Object.values(facets).reduce((a, b) => a + b, 0);
  const chip = (value, label, n) =>
    `<button class="chip" type="button" data-species="${value}" aria-pressed="${state.species === value}">${value ? ICONS[SPECIES_ICON[value]] : ''}${label}${n !== undefined ? ` <b>${n}</b>` : ''}</button>`;
  $('#species-chips').innerHTML = chip('', 'All pets', total) +
    Object.entries(SPECIES_PLURAL).map(([k, label]) => chip(k, label, facets[k] || 0)).join('');
}

function renderPager(pages) {
  $('#pager').innerHTML = pages > 1
    ? Array.from({ length: pages }, (_, i) => `<button type="button" data-page="${i + 1}" ${i + 1 === state.page ? 'aria-current="true"' : ''} aria-label="Page ${i + 1}">${i + 1}</button>`).join('')
    : '';
}

async function load() {
  history.replaceState(null, '', `pets.html${qs({ ...state, sort: state.sort === 'newest' ? '' : state.sort, page: state.page > 1 ? state.page : '' })}`);
  results.innerHTML = skeleton(6, 280);
  try {
    const data = await api(`/pets${qs({ ...state, limit: PAGE_SIZE })}`);
    renderChips(data.facets.species);
    $('#result-count').textContent = `${plural(data.total, 'pet')} found`;
    results.innerHTML = data.items.length
      ? data.items.map(petCard).join('')
      : emptyState('No pets match', 'Try another name or clear the filters.', '<button class="btn btn-ghost" type="button" id="clear">Clear filters</button>');
    $('#clear')?.addEventListener('click', () => update({ q: '', species: '', municipality: '', sex: '' }, true));
    renderPager(data.pages);
  } catch (err) {
    results.innerHTML = errorState(err.message);
  }
}

function update(changes, syncForm = false) {
  Object.assign(state, changes, { page: changes.page || 1 });
  if (syncForm) ['q', 'municipality', 'sex', 'sort'].forEach((k) => (form.elements[k].value = state[k]));
  load();
}

form.addEventListener('submit', (e) => e.preventDefault());
form.elements.q.addEventListener('input', debounce((e) => update({ q: e.target.value.trim() })));
['municipality', 'sex', 'sort'].forEach((k) => form.elements[k].addEventListener('change', (e) => update({ [k]: e.target.value })));
$('#species-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-species]');
  if (b) update({ species: b.dataset.species });
});
$('#pager').addEventListener('click', (e) => {
  const b = e.target.closest('[data-page]');
  if (!b) return;
  update({ page: Number(b.dataset.page) });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

renderChips();
load();
