/**
 * Home: the Community Wall.
 *  - visitors: hero with live counts and a collage of newly registered pets
 *  - logged in: a short welcome instead, so the wall itself is the first thing seen
 *  - composer: owners post text, photos (up to 4) or both, under their own name
 *  - "Pets in the community": other owners' pets with photo, species and breed
 *  - feed: "For you" (a mixed order that changes each visit, today's posts first) or "Latest"
 *  - side widgets: missing-pet alerts, upcoming schedules, announcements, new pets
 */
import { api, qs } from '../api.js';
import { getUser, isOwner, isAdmin } from '../store.js';
import { SPECIES } from '../config.js';
import { initPage, toast, setBusy, setupModal, emptyState, errorState, skeleton, createPhotoPicker, esc, initials, formatDate, ICONS, $, $$ } from '../ui.js';
import { createPostList, petImg, scheduleItem, alertCard, categoryTag, dateTile } from '../components.js';

initPage('wall');

const user = getUser();
const postsEl = $('#posts');
const moreEl = $('#feed-more');
const MAX_PHOTOS = 4;
let page = 1;
let myPets = [];
let order = 'discover';
let seed = 1 + Math.floor(Math.random() * 1000000);
let loading = false;

const feed = createPostList(postsEl, { onEmpty: showEmptyFeed });

function showEmptyFeed() {
  postsEl.innerHTML = emptyState('The wall is quiet', 'Be the first to share a pet update.', user ? '' : '<a class="btn btn-primary" href="account.html?mode=register">Join Alaga</a>');
}

/* ---------- Welcome (logged in) ---------- */
function renderWelcome() {
  if (!user) return;
  const hour = Number(new Date().toLocaleString('en-PH', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' }));
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const hero = $('.hero');
  hero.classList.add('hero-compact');
  $('.hero-inner > div', hero).innerHTML = `
    <h1>${hello}, ${esc(user.name.split(' ')[0])}</h1>
    <p>${isAdmin() ? 'Here is what pet owners are sharing today.' : 'Here is what pets around the island are up to.'}</p>
    <a class="hero-next" id="hero-next" href="announcements.html?view=schedules" hidden></a>`;
}

/** "Next PVO activity" line in the hero, from the real schedule. */
function renderNextActivity(item) {
  const el = $('#hero-next');
  if (!el || !item) return;
  el.href = `announcements.html#a-${item._id}`;
  el.innerHTML = `${dateTile(item.event.startsAt)}<span><strong>Next PVO activity</strong><br>${esc(item.title)}${item.event.venue ? `, ${esc(item.event.venue)}` : ''}${item.event.municipality && !`${item.title} ${item.event.venue || ''}`.includes(item.event.municipality) ? `, ${esc(item.event.municipality)}` : ''}</span>`;
  el.hidden = false;
}

/* ---------- One post from a notification (index.html?post=<id>) ---------- */
const focusId = new URLSearchParams(location.search).get('post');
async function showFocusedPost() {
  if (!focusId || !/^[a-f\d]{24}$/i.test(focusId)) return;
  const box = $('#focus-post');
  try {
    const post = await api(`/posts/${focusId}`);
    box.hidden = false;
    focusList.prepend(post, { open: true });
    requestAnimationFrame(() => box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  } catch (err) {
    box.hidden = false;
    box.querySelector('#focus-list').innerHTML = `<p class="notice">${esc(err.message)}</p>`;
  }
}
const focusList = createPostList($('#focus-list'));

/* ---------- Feed: keeps loading as you scroll (no "Load more" button) ---------- */
let hasMore = false;
async function loadPosts() {
  if (loading) return;
  loading = true;
  if (page === 1) {
    postsEl.innerHTML = skeleton(3, 220);
    moreEl.innerHTML = '';
  } else {
    moreEl.innerHTML = `<div class="feed-loading" role="status">${skeleton(1, 160)}<span class="sr-only">Loading more posts</span></div>`;
  }
  try {
    const data = await api(`/posts${qs({ page, limit: 8, order, seed: order === 'discover' ? seed : '' })}`);
    if (page === 1) feed.clear();
    if (!data.items.length && page === 1) { hasMore = false; moreEl.innerHTML = ''; return showEmptyFeed(); }
    feed.append(data.items.filter((p) => p._id !== focusId)); // the opened post is already shown above
    hasMore = data.page < data.pages;
    moreEl.innerHTML = hasMore ? '' : (page > 1 || data.total > 3 ? `<p class="feed-end">${ICONS.check}You're all caught up</p>` : '');
  } catch (err) {
    moreEl.innerHTML = '';
    if (page === 1) postsEl.innerHTML = errorState(err.message);
    else { page -= 1; toast(err.message, 'error'); }
  } finally {
    loading = false;
  }
  // If the page is still short (big screen), keep filling it.
  requestAnimationFrame(() => { if (hasMore && sentinelVisible) nextPage(); });
}

function nextPage() {
  if (loading || !hasMore) return;
  page += 1;
  loadPosts();
}

let sentinelVisible = false;
function setupInfiniteScroll() {
  const sentinel = document.createElement('div');
  sentinel.className = 'feed-sentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  moreEl.after(sentinel);
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver((entries) => {
    sentinelVisible = entries[0].isIntersecting;
    if (sentinelVisible) nextPage();
  }, { rootMargin: '0px 0px 600px 0px' }).observe(sentinel);
}

function setupFeedTabs() {
  $$('[data-feed]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.feed === order && order === 'latest') return;
    // Tapping "For you" again reshuffles.
    if (b.dataset.feed === 'discover') seed = 1 + Math.floor(Math.random() * 1000000);
    order = b.dataset.feed;
    $$('[data-feed]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    page = 1;
    hasMore = false;
    loadPosts();
  }));
}

/* ---------- Composer ---------- */
function renderComposer() {
  const box = $('#composer');
  if (isAdmin()) {
    box.innerHTML = `<div class="card join-card"><strong>You are signed in as PVO staff.</strong>
      <p class="muted">Publish news and schedules from the admin console. You can remove posts or comments here if they break community rules.</p>
      <a class="btn btn-primary" href="admin.html#announcements" style="justify-self:start">Write an announcement</a></div>`;
    return;
  }
  if (!user) {
    box.innerHTML = `<div class="card join-card">
      <strong style="font-family:var(--font-display);font-size:1.125rem">Share your pet's day with the community</strong>
      <p class="muted">Create a free account to register your pets, post updates, and get reminders for vaccination drives.</p>
      <div class="row"><a class="btn btn-primary" href="account.html?mode=register">Create an account</a><a class="btn btn-ghost" href="account.html">Log in</a></div></div>`;
    return;
  }

  const first = esc(user.name.split(' ')[0]);
  const prompt = `What's on your mind, ${first}?`;
  // Facebook-style: a compact "What's on your mind?" bar that opens the full composer.
  box.innerHTML = `<div class="card composer-card">
      <div class="composer-row">
        <span class="avatar pet-avatar" aria-hidden="true">${esc(initials(user.name))}</span>
        <button class="composer-pill" type="button" data-compose="text">${prompt}</button>
      </div>
      <div class="composer-quick">
        <button type="button" data-compose="photo"><span class="q-photo">${ICONS.image}</span>Photo</button>
        <button type="button" data-compose="pet"><span class="q-pet">${ICONS.paw}</span>Pet update</button>
        <a href="report.html?type=missing"><span class="q-lost">${ICONS.search}</span>Lost pet</a>
      </div>
    </div>
    <dialog class="modal composer-modal" id="composer-dialog" aria-labelledby="composer-title">
      <form id="composer-form" novalidate>
        <div class="modal-head"><h2 id="composer-title">Create post</h2>
          <button class="icon-btn" type="button" data-close aria-label="Close">${ICONS.close}</button></div>
        <div class="composer-body">
          <div class="composer-who"><span class="avatar pet-avatar" aria-hidden="true">${esc(initials(user.name))}</span>
            <span><strong>${esc(user.name)}</strong><small>${ICONS.users}Community wall</small></span></div>
          <label class="sr-only" for="post-text">What's on your mind?</label>
          <textarea id="post-text" class="composer-text" name="text" maxlength="1000" placeholder="${prompt}"></textarea>
          <div id="composer-photos" hidden></div>
          <div class="composer-add">
            <span>Add to your post</span>
            <button class="icon-btn q-photo" type="button" id="add-photo" aria-label="Add photos" aria-expanded="false" aria-controls="composer-photos">${ICONS.image}</button>
            <span class="count" id="post-count">0 / 1000</span>
          </div>
          <p class="field-error" id="post-error" role="alert"></p>
        </div>
        <div class="composer-foot"><button class="btn btn-primary btn-block" type="submit" id="post-btn" disabled>Post</button></div>
      </form>
    </dialog>`;

  const dialog = setupModal($('#composer-dialog'));
  const form = $('#composer-form');
  const photosEl = $('#composer-photos');
  const postBtn = $('#post-btn');
  const picker = createPhotoPicker(photosEl, { max: MAX_PHOTOS, label: `Add up to ${MAX_PHOTOS} photos`, onChange: () => sync() });
  const addBtn = $('#add-photo');
  // Post is only enabled once there is something to post (like Facebook).
  const sync = () => { postBtn.disabled = !form.elements.text.value.trim() && !picker.paths.length; };
  const showPhotos = (open) => {
    photosEl.hidden = !open;
    addBtn.setAttribute('aria-expanded', String(open));
    addBtn.classList.toggle('is-on', open);
  };
  const openComposer = (mode) => {
    form.elements.text.placeholder = mode === 'pet' ? `How are your pets today, ${user.name.split(' ')[0]}?` : prompt.replace(/&#39;|&apos;/g, "'");
    dialog.showModal();
    if (mode === 'photo') {
      showPhotos(true);
      if (!picker.paths.length) $('input[type=file]', photosEl)?.click();
    } else {
      form.elements.text.focus();
    }
  };
  $$('[data-compose]', box).forEach((b) => b.addEventListener('click', () => openComposer(b.dataset.compose)));
  addBtn.addEventListener('click', () => {
    const open = photosEl.hidden;
    showPhotos(open);
    if (open && !picker.paths.length) $('input[type=file]', photosEl)?.click();
  });
  form.elements.text.addEventListener('input', () => {
    $('#post-count').textContent = `${form.elements.text.value.length} / 1000`;
    // Grow with the text, like a chat box
    form.elements.text.style.height = 'auto';
    form.elements.text.style.height = `${Math.min(form.elements.text.scrollHeight, 320)}px`;
    sync();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.elements.text.value.trim();
    const photos = picker.paths;
    $('#post-error').textContent = '';
    if (picker.busy) return void ($('#post-error').textContent = 'Wait for the photos to finish uploading.');
    if (!text && !photos.length) {
      $('#post-error').textContent = 'Write something or add a photo.';
      form.elements.text.focus();
      return;
    }
    setBusy(postBtn, true, 'Posting…');
    try {
      const post = await api('/posts', { method: 'POST', body: { text, photos } });
      if (!feed.size) postsEl.innerHTML = '';
      feed.prepend(post);
      form.reset();
      form.elements.text.style.height = '';
      $('#post-count').textContent = '0 / 1000';
      picker.set([]);
      showPhotos(false);
      dialog.close();
      toast('Posted to the community wall.');
      $(`#post-${post._id}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    } catch (err) {
      $('#post-error').textContent = err.message;
    } finally {
      setBusy(postBtn, false);
      sync();
    }
  });
}

/* ---------- Left column: who am I ---------- */
function renderMeCard() {
  const card = $('#me-card');
  // Visitors already get the join box in the feed; a second one here would repeat it.
  card.hidden = !user;
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
         <a href="pet-form.html" title="Register a pet" aria-label="Register a pet" class="pet-placeholder" style="width:40px;height:40px;border-radius:999px">${ICONS.plus}</a></div>
         <a class="small" href="account.html">My pets and reports</a>`}
  </div>`;
}

/* ---------- Pets in the community ---------- */
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderCommunityPets(items) {
  const mine = new Set(myPets.map((p) => p._id));
  const others = shuffle(items.filter((p) => !mine.has(p._id) && p.status !== 'deceased')).slice(0, 10);
  const box = $('#community-pets');
  if (!others.length) { box.hidden = true; return; }
  box.hidden = false;
  $('#community-pets-list').innerHTML = others.map((p) => `<li><a class="mini-pet" href="pet.html?id=${p._id}">
      ${petImg(p.photos?.[0], '', `${p.name}, ${p.breed || SPECIES[p.species]}`)}
      <span class="mini-pet-body"><strong>${esc(p.name)}</strong>
        <span>${esc(SPECIES[p.species] || '')}${p.breed ? ` · ${esc(p.breed)}` : ''}</span>
        <span class="muted">${esc(p.municipality || '')}${p.owner?.name ? ` · ${esc(p.owner.name)}` : ''}</span></span>
    </a></li>`).join('');
}

/* ---------- Side widgets ---------- */
async function loadSide() {
  const [alerts, upcoming, news, pets] = await Promise.allSettled([
    api('/reports/alerts'),
    api(`/announcements${qs({ upcoming: 'true', limit: 4 })}`),
    api(`/announcements${qs({ limit: 4 })}`),
    api(`/pets${qs({ limit: 30, sort: 'newest' })}`),
  ]);

  if (alerts.status === 'fulfilled' && alerts.value.length) {
    $('#alerts-panel').hidden = false;
    $('#alerts').innerHTML = alerts.value.map(alertCard).join('');
  }

  if (upcoming.status === 'fulfilled') {
    renderNextActivity(upcoming.value.items[0]);
    $('#schedules').innerHTML = upcoming.value.items.map(scheduleItem).join('') || '<li class="muted small">No activities scheduled right now.</li>';
  } else $('#schedules').innerHTML = '<li class="muted small">Could not load schedules.</li>';

  if (news.status === 'fulfilled') {
    $('#news').innerHTML = news.value.items.map((a) => `<li><a href="announcements.html#a-${a._id}">${esc(a.title)}</a>
      <small>${categoryTag(a.category)} · ${formatDate(a.createdAt)}</small></li>`).join('') || '<li class="muted small">No announcements yet.</li>';
  } else $('#news').innerHTML = '<li class="muted small">Could not load announcements.</li>';

  if (pets.status === 'fulfilled') {
    const items = pets.value.items;
    $('#new-pets').innerHTML = items.slice(0, 8).map((p) => `<a href="pet.html?id=${p._id}">${petImg(p.photos?.[0], '', p.name)}<span>${esc(p.name)}</span></a>`).join('');
    if (!user) {
      $('#collage').innerHTML = items.filter((p) => p.photos?.length).slice(0, 5)
        .map((p) => `<a href="pet.html?id=${p._id}">${petImg(p.photos[0], '', `${p.name}, ${p.breed}`)}<span>${esc(p.name)}</span></a>`).join('');
    }
    renderCommunityPets(items);
  } else {
    $('#community-pets').hidden = true;
  }
}

/* ---------- Boot ---------- */
async function boot() {
  renderWelcome();
  if (isOwner()) {
    try { myPets = await api('/pets/mine'); } catch { myPets = []; }
  }
  if (isAdmin()) $('#hero-register')?.setAttribute('href', 'admin.html#pets');
  renderMeCard();
  renderComposer();
  setupFeedTabs();
  setupInfiniteScroll();
  showFocusedPost();
  loadPosts();
  loadSide();
}
boot();
