/**
 * Home: the Community Wall.
 *  - hero with live counts and a collage of newly registered pets
 *  - composer: owners post as one of their pets (text + optional photo)
 *  - feed: newest posts first, "Load more" pages through the rest
 *  - side widgets: missing-pet alerts, upcoming schedules, announcements, new pets
 */
import { api, qs } from '../api.js';
import { getUser, isOwner, isAdmin } from '../store.js';
import { initPage, toast, setBusy, emptyState, errorState, skeleton, createPhotoPicker, esc, initials, formatDate, timeAgo, ICONS, $, $$ } from '../ui.js';
import { createPostList, petImg, scheduleItem, alertCard, categoryTag } from '../components.js';

initPage('wall');

const user = getUser();
const postsEl = $('#posts');
const moreEl = $('#feed-more');
let page = 1;
let myPets = [];

const feed = createPostList(postsEl, { onEmpty: showEmptyFeed });

function showEmptyFeed() {
  postsEl.innerHTML = emptyState('The wall is quiet', 'Be the first to share a pet update.', isOwner() ? '' : '<a class="btn btn-primary" href="account.html">Join Alaga</a>');
}

/* ---------- Feed ---------- */
async function loadPosts() {
  moreEl.innerHTML = '';
  if (page === 1) postsEl.innerHTML = skeleton(3, 220);
  try {
    const data = await api(`/posts${qs({ page, limit: 8 })}`);
    if (page === 1) postsEl.innerHTML = '';
    if (!data.items.length && page === 1) return showEmptyFeed();
    feed.append(data.items);
    if (data.page < data.pages) {
      moreEl.innerHTML = '<button class="btn btn-ghost" type="button" id="load-more">Load more posts</button>';
      $('#load-more').addEventListener('click', () => { page += 1; loadPosts(); });
    } else if (page > 1) {
      moreEl.innerHTML = '<p class="muted small">You are all caught up.</p>';
    }
  } catch (err) {
    if (page === 1) postsEl.innerHTML = errorState(err.message);
    else toast(err.message, 'error');
  }
}

/* ---------- Composer ---------- */
function renderComposer() {
  const box = $('#composer');
  if (isAdmin()) {
    box.innerHTML = `<div class="card join-card"><strong>You are signed in as PVO staff.</strong>
      <p class="muted">Publish news and schedules from the admin console. You can remove posts or comments here if they break community rules.</p>
      <a class="btn btn-primary" href="admin.html#announcements">Write an announcement</a></div>`;
    return;
  }
  if (!user) {
    box.innerHTML = `<div class="card join-card">
      <strong style="font-family:var(--font-display);font-size:1.125rem">Share your pet's day with the community</strong>
      <p class="muted">Create a free account to register your pets, post updates, and get reminders for vaccination drives.</p>
      <div class="row"><a class="btn btn-primary" href="account.html?mode=register">Create an account</a><a class="btn btn-ghost" href="account.html">Log in</a></div></div>`;
    return;
  }
  if (!active.length) {
    // No pets, or only pets kept "in memory": nobody can post yet.
    box.innerHTML = `<div class="card join-card"><strong>${myPets.length ? 'Register a pet to keep posting' : 'Register your first pet to start posting'}</strong>
      <p class="muted">Every post on the wall is written as one of your pets.</p>
      <a class="btn btn-primary" href="pet-form.html">${ICONS.plus}Register a pet</a></div>`;
    return;
  }
  box.innerHTML = `<form class="card composer" id="composer-form" novalidate>
    <div class="composer-top">
      <span id="composer-avatar">${petImg(active[0]?.photos?.[0], 'pet-avatar', active[0]?.name)}</span>
      <label class="sr-only" for="post-text">What's new?</label>
      <textarea id="post-text" name="text" maxlength="1000" placeholder="What's new with ${esc(active[0]?.name)}?" required></textarea>
    </div>
    <div id="composer-photo" hidden></div>
    <div class="composer-bar">
      <label class="sr-only" for="post-pet">Posting as</label>
      <select class="input" id="post-pet" name="pet">${active.map((p) => `<option value="${p._id}">Posting as ${esc(p.name)}</option>`).join('')}</select>
      <button class="btn btn-soft btn-sm" type="button" id="add-photo">${ICONS.image}Photo</button>
      <span class="count" id="post-count">0 / 1000</span>
      <button class="btn btn-primary btn-sm" type="submit" id="post-btn">Post</button>
    </div>
    <p class="field-error" id="post-error" role="alert"></p>
  </form>`;

  const form = $('#composer-form');
  const picker = createPhotoPicker($('#composer-photo'), { max: 1, label: 'Add a photo' });
  $('#add-photo').addEventListener('click', () => {
    $('#composer-photo').hidden = !$('#composer-photo').hidden;
    if (!$('#composer-photo').hidden) $('#composer-photo input[type=file]')?.click();
  });
  form.elements.pet.addEventListener('change', () => {
    const p = active.find((x) => x._id === form.elements.pet.value);
    $('#composer-avatar').innerHTML = petImg(p.photos?.[0], 'pet-avatar', p.name);
    form.elements.text.placeholder = `What's new with ${p.name}?`;
  });
  form.elements.text.addEventListener('input', () => ($('#post-count').textContent = `${form.elements.text.value.length} / 1000`));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.elements.text.value.trim();
    $('#post-error').textContent = '';
    if (!text) return void ($('#post-error').textContent = 'Write something to post.');
    if (picker.busy) return void ($('#post-error').textContent = 'Wait for the photo to finish uploading.');
    const btn = $('#post-btn');
    setBusy(btn, true, 'Posting…');
    try {
      const post = await api('/posts', { method: 'POST', body: { pet: form.elements.pet.value, text, photo: picker.paths[0] } });
      if (!feed.size) postsEl.innerHTML = '';
      feed.prepend(post);
      form.elements.text.value = '';
      $('#post-count').textContent = '0 / 1000';
      picker.set([]);
      $('#composer-photo').hidden = true;
      toast('Posted to the wall.');
    } catch (err) {
      $('#post-error').textContent = err.message;
    } finally {
      setBusy(btn, false);
    }
  });
}

/* ---------- Left column: who am I ---------- */
function renderMeCard() {
  const card = $('#me-card');
  if (!user) {
    card.innerHTML = `<div class="me-card"><strong>Welcome to Alaga</strong><p class="muted small">Browse pets and PVO news as a visitor, or join to register your own pets.</p>
      <a class="btn btn-primary btn-sm" href="account.html?mode=register">Join now</a></div>`;
    return;
  }
  card.innerHTML = `<div class="me-card">
    <div class="row"><span class="avatar">${esc(initials(user.name))}</span><span><strong>${esc(user.name)}</strong><br><span class="muted small">${isAdmin() ? 'PVO staff' : esc(user.municipality || 'Pet owner')}</span></span></div>
    ${isAdmin()
      ? '<a class="btn btn-soft btn-sm" href="admin.html">Open admin console</a>'
      : `<div class="me-pets">${myPets.map((p) => `<a href="pet.html?id=${p._id}" title="${esc(p.name)}">${petImg(p.photos?.[0], '', p.name)}</a>`).join('')}
         <a href="pet-form.html" title="Register a pet" class="pet-placeholder" style="width:40px;height:40px;border-radius:999px">${ICONS.plus}</a></div>
         <a class="small" href="account.html">My pets and reports →</a>`}
  </div>`;
}

/* ---------- Side widgets ---------- */
async function loadSide() {
  const [alerts, upcoming, news, pets] = await Promise.allSettled([
    api('/reports/alerts'),
    api(`/announcements${qs({ upcoming: 'true', limit: 4 })}`),
    api(`/announcements${qs({ limit: 4 })}`),
    api(`/pets${qs({ limit: 8, sort: 'newest' })}`),
  ]);

  if (alerts.status === 'fulfilled' && alerts.value.length) {
    $('#alerts-panel').hidden = false;
    $('#alerts').innerHTML = alerts.value.map(alertCard).join('');
  }

  if (upcoming.status === 'fulfilled') {
    $('[data-stat="upcoming"]').textContent = upcoming.value.total;
    $('#schedules').innerHTML = upcoming.value.items.map(scheduleItem).join('') || '<li class="muted small">No activities scheduled right now.</li>';
  } else $('#schedules').innerHTML = '<li class="muted small">Could not load schedules.</li>';

  if (news.status === 'fulfilled') {
    $('#news').innerHTML = news.value.items.map((a) => `<li><a href="announcements.html#a-${a._id}">${esc(a.title)}</a>
      <small>${categoryTag(a.category)} · ${formatDate(a.createdAt)}</small></li>`).join('') || '<li class="muted small">No announcements yet.</li>';
  } else $('#news').innerHTML = '<li class="muted small">Could not load announcements.</li>';

  if (pets.status === 'fulfilled') {
    const items = pets.value.items;
    $('[data-stat="pets"]').textContent = pets.value.total;
    $('#new-pets').innerHTML = items.map((p) => `<a href="pet.html?id=${p._id}">${petImg(p.photos?.[0], '', p.name)}<span>${esc(p.name)}</span></a>`).join('');
    $('#collage').innerHTML = items.filter((p) => p.photos?.length).slice(0, 5)
      .map((p) => `<a href="pet.html?id=${p._id}">${petImg(p.photos[0], '', `${p.name}, ${p.breed}`)}<span>${esc(p.name)}</span></a>`).join('');
  }
}

/* ---------- Boot ---------- */
async function boot() {
  if (isOwner()) {
    try { myPets = await api('/pets/mine'); } catch { myPets = []; }
  }
  if (isAdmin()) $('#hero-register').href = 'admin.html#pets';
  renderMeCard();
  renderComposer();
  loadPosts();
  loadSide();
}
boot();

// Keep "2 h ago" labels fresh while the page stays open.
setInterval(() => $$('.post-meta time').forEach((t) => (t.textContent = timeAgo(t.dateTime))), 60000);
