/**
 * Building blocks shared by several pages: pet cards, wall posts (with likes,
 * comments and moderation), announcement and schedule items, missing-pet alerts,
 * report cards with their status timeline, shop products and orders.
 * Every value that came from a user goes through esc() before reaching innerHTML.
 */
import { api } from './api.js';
import { getUser, isAdmin } from './store.js';
import { SPECIES, CATEGORIES, REPORT_TYPES, REPORT_STATUSES, SITE, PRODUCT_CATEGORIES, ORDER_STATUSES, peso } from './config.js';
import { esc, timeAgo, ageText, formatDate, formatDateTime, formatTime, dateParts, initials, $ } from './format.js';
import { ICONS } from './icons.js';
import { toast, armed } from './ui.js';

/* ---------- Pets ---------- */

/** A pet photo, or a paw placeholder when the pet has none. */
export function petImg(src, cls = '', alt = '') {
  return src
    ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`
    : `<div class="pet-placeholder ${cls}" role="img" aria-label="${esc(alt || 'No photo')}">${ICONS.paw}</div>`;
}

export const sexIcon = (sex) => `<span class="sex-${sex}" title="${sex === 'male' ? 'Male' : 'Female'}">${ICONS[sex] || ''}<span class="sr-only">${sex}</span></span>`;

export function petSubtitle(p) {
  return [p.breed || SPECIES[p.species], ageText(p.birthDate)].filter(Boolean).join(' · ');
}

export function petTags(p) {
  return [
    p.status === 'missing' ? '<span class="tag tag-solid-red">Missing</span>' : '',
    p.status === 'deceased' ? '<span class="tag">In memory</span>' : '',
    p.registrationStatus === 'verified' ? `<span class="tag tag-solid-green" title="Registration verified by the PVO">${ICONS.check}Verified</span>` : '',
    p.isPublic === false ? `<span class="tag">${ICONS.lock}Private</span>` : '',
  ].join('');
}

export function petCard(p) {
  return `<a class="pet-card" href="pet.html?id=${p._id}">
    <div class="pet-card-photo">${petImg(p.photos?.[0], '', `${p.name}, ${p.breed || SPECIES[p.species]}`)}<div class="tags">${petTags(p)}</div></div>
    <div class="pet-card-body">
      <h3>${esc(p.name)} ${sexIcon(p.sex)}</h3>
      <p>${esc(petSubtitle(p))}</p>
      <span class="muted">${ICONS.pin}${esc(p.municipality)} · ${esc(p.owner?.name || '')}</span>
    </div>
  </a>`;
}

export function rabiesBox(r = {}) {
  if (r.status === 'current') return `<div class="rabies rabies-current">${ICONS.shieldCheck}<span>Anti-rabies vaccine up to date<small>Valid until ${formatDate(r.due)}</small></span></div>`;
  if (r.status === 'overdue') return `<div class="rabies rabies-overdue">${ICONS.alert}<span>Anti-rabies booster overdue<small>Was due ${formatDate(r.due)}. Join the next free drive.</small></span></div>`;
  return `<div class="rabies rabies-none">${ICONS.shield}<span>No anti-rabies record yet<small>Free shots at every PVO vaccination drive.</small></span></div>`;
}

/* ---------- Wall posts ---------- */

function commentHtml(c, postId) {
  return `<div class="comment">
    <span class="avatar" aria-hidden="true">${esc(initials(c.user.name))}</span>
    <div class="comment-body">
      <strong>${esc(c.user.name)}</strong>${c.user.staff ? ' <span class="staff-badge">PVO</span>' : ''}<time datetime="${c.createdAt}">${timeAgo(c.createdAt)}</time>
      <p>${esc(c.text)}</p>
    </div>
    ${c.canDelete ? `<button class="icon-btn" type="button" data-del-comment="${c._id}" data-post-id="${postId}" aria-label="Delete comment">${ICONS.trash}</button>` : ''}
  </div>`;
}

/** 1 photo full width; 2 side by side; 3 one tall + two; 4 a 2 x 2 grid. */
function postPhotos(p, who) {
  const photos = p.photos?.length ? p.photos : p.photo ? [p.photo] : [];
  if (!photos.length) return '';
  const imgs = photos.map((src, i) => `<a href="${esc(src)}" target="_blank" rel="noopener" class="post-photo-link"><img class="post-photo" src="${esc(src)}" alt="Photo ${photos.length > 1 ? `${i + 1} of ${photos.length} ` : ''}posted by ${esc(who)}" loading="lazy"></a>`).join('');
  return `<div class="post-photos n-${photos.length}">${imgs}</div>`;
}

export function postCard(p, open = false) {
  const user = getUser();
  const who = p.author.name;
  const head = `<span class="avatar pet-avatar" aria-hidden="true">${esc(initials(who))}</span>
      <div class="post-who">
        <strong class="post-name">${esc(who)}</strong>
        <span class="post-meta">${p.author.municipality ? `${esc(p.author.municipality)} · ` : ''}<time datetime="${p.createdAt}" title="${timeAgo(p.createdAt)}">${formatDateTime(p.createdAt)}</time></span>
      </div>`;
  return `<article class="card post" data-post="${p._id}" id="post-${p._id}">
    <header class="post-head">
      ${head}
      ${p.canDelete ? `<button class="btn btn-danger btn-sm" type="button" data-del-post="${p._id}" aria-label="Delete post" style="margin-left:auto">${ICONS.trash}</button>` : ''}
    </header>
    ${p.text ? `<p class="post-text">${esc(p.text)}</p>` : ''}
    ${postPhotos(p, who)}
    <footer class="post-actions">
      <button class="post-action" type="button" data-like="${p._id}" aria-pressed="${p.liked}" aria-label="${p.liked ? 'Unlike' : 'Like'} (${p.likeCount} likes)">${ICONS.heart}<span>${p.likeCount}</span></button>
      <button class="post-action" type="button" data-toggle-comments="${p._id}" aria-expanded="${open}">${ICONS.comment}<span>${p.comments.length}</span><span class="sr-only">comments</span></button>
    </footer>
    <div class="comments" ${open ? '' : 'hidden'}>
      ${p.comments.map((c) => commentHtml(c, p._id)).join('') || '<p class="muted small">No comments yet. Say hello!</p>'}
      ${user
        ? `<form class="comment-form" data-comment-form="${p._id}"><label class="sr-only" for="c-${p._id}">Write a comment</label>
            <input class="input" id="c-${p._id}" name="text" maxlength="500" placeholder="Write a comment…" autocomplete="off" required>
            <button class="btn btn-primary btn-sm" type="submit">Send</button></form>`
        : '<p class="small"><a href="account.html">Log in</a> to like and comment.</p>'}
    </div>
  </article>`;
}

/**
 * Manages a list of posts inside `container`: rendering, likes, comments,
 * deleting. Returns { append(posts), prepend(post), clear() }.
 */
export function createPostList(container, { onEmpty = () => {} } = {}) {
  const posts = new Map();
  const open = new Set();
  const liking = new Set();

  const replace = (p) => {
    posts.set(p._id, p);
    const el = container.querySelector(`[data-post="${p._id}"]`);
    if (el) el.outerHTML = postCard(p, open.has(p._id));
  };
  const needLogin = () => {
    if (getUser()) return false;
    toast('Log in or create an account to join the conversation.', 'error');
    return true;
  };

  container.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;

    if (d.like) {
      if (needLogin()) return;
      const p = posts.get(d.like);
      // One request at a time per post: rapid double taps would otherwise race.
      if (liking.has(p._id)) return;
      liking.add(p._id);
      const before = { liked: p.liked, likeCount: p.likeCount };
      // Optimistic: flip now, correct with the server's numbers.
      Object.assign(p, { liked: !p.liked, likeCount: p.likeCount + (p.liked ? -1 : 1) });
      replace(p);
      container.querySelector(`[data-like="${p._id}"]`)?.classList.add('bump');
      try {
        Object.assign(p, await api(`/posts/${p._id}/like`, { method: 'POST' }));
      } catch (err) {
        Object.assign(p, before); // undo the optimistic flip
        toast(err.message, 'error');
      } finally {
        liking.delete(p._id);
        replace(p);
      }
    }

    if (d.toggleComments) {
      const id = d.toggleComments;
      open.has(id) ? open.delete(id) : open.add(id);
      replace(posts.get(id));
      if (open.has(id)) container.querySelector(`#c-${id}`)?.focus();
    }

    if (d.share) {
      const url = new URL(`pet.html?id=${d.share}`, location.href).href;
      try { await navigator.clipboard.writeText(url); toast('Link copied.'); } catch { prompt('Copy this link:', url); }
    }

    if (d.delPost && armed(b, 'Delete?')) {
      try {
        await api(`/posts/${d.delPost}`, { method: 'DELETE' });
        posts.delete(d.delPost);
        container.querySelector(`[data-post="${d.delPost}"]`)?.remove();
        toast('Post deleted.');
        if (!posts.size) onEmpty();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    if (d.delComment) {
      try {
        replace(await api(`/posts/${d.postId}/comments/${d.delComment}`, { method: 'DELETE' }));
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });

  container.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-comment-form]');
    if (!form) return;
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) return;
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      open.add(form.dataset.commentForm);
      replace(await api(`/posts/${form.dataset.commentForm}/comments`, { method: 'POST', body: { text } }));
      $(`#c-${form.dataset.commentForm}`, container)?.focus();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });

  return {
    append(list) {
      list.forEach((p) => posts.set(p._id, p));
      container.insertAdjacentHTML('beforeend', list.map((p) => postCard(p, open.has(p._id))).join(''));
    },
    prepend(p, { open: openComments = false } = {}) {
      posts.set(p._id, p);
      if (openComments) open.add(p._id);
      container.insertAdjacentHTML('afterbegin', postCard(p, openComments));
    },
    clear() {
      posts.clear();
      container.innerHTML = '';
    },
    get size() { return posts.size; },
  };
}

/* ---------- Announcements & schedules ---------- */

export const categoryTag = (c) => {
  const cat = CATEGORIES[c] || { label: c, tag: '', icon: 'info' };
  return `<span class="tag ${cat.tag}">${ICONS[cat.icon] || ''}${esc(cat.label)}</span>`;
};

export function dateTile(d) {
  const { day, month } = dateParts(d);
  return `<span class="date-tile" aria-hidden="true"><small>${month}</small><b>${day}</b></span>`;
}

export function eventWhen(e) {
  const start = new Date(e.startsAt);
  const { weekday } = dateParts(start);
  const end = e.endsAt ? new Date(e.endsAt) : null;
  const sameDay = end && formatDate(end) === formatDate(start);
  if (!end) return `${weekday}, ${formatDate(start)}, ${formatTime(start)}`;
  return sameDay ? `${weekday}, ${formatDate(start)}, ${formatTime(start)} – ${formatTime(end)}` : `${formatDateTime(start)} – ${formatDateTime(end)}`;
}

export function scheduleItem(a) {
  return `<li><a href="announcements.html#a-${a._id}">${dateTile(a.event.startsAt)}
    <span><strong>${esc(a.title)}</strong><span>${esc(a.event.municipality || '')}${a.event.municipality ? ' · ' : ''}${formatTime(a.event.startsAt)}</span></span></a></li>`;
}

/* ---------- Missing pet alerts ---------- */

export function alertCard(a) {
  const name = a.name || `${SPECIES[a.species] || 'Pet'}`;
  return `<a class="alert-card" href="${a.petId ? `pet.html?id=${a.petId}` : 'report.html'}">
    ${petImg(a.photo, '', name)}
    <span class="stack-sm" style="gap:2px">
      <strong>${esc(name)}${a.breed ? ` · ${esc(a.breed)}` : ''}</strong>
      <p>Last seen ${formatDate(a.lastSeen)} in ${esc(a.barangay)}, ${esc(a.municipality)}</p>
      <p class="small">Seen this pet? Call the PVO at ${SITE.phone} and quote <b>${esc(a.reference)}</b>.</p>
    </span>
  </a>`;
}

/* ---------- Reports ---------- */

export const reportTypeTag = (t) => `<span class="tag ${REPORT_TYPES[t]?.tag || ''}">${ICONS[REPORT_TYPES[t]?.icon] || ''}${esc(REPORT_TYPES[t]?.label || t)}</span>`;
export const reportStatusTag = (s) => `<span class="tag ${REPORT_STATUSES[s]?.tag || ''}">${esc(REPORT_STATUSES[s]?.label || s)}</span>`;

export function progressBar(status) {
  const step = REPORT_STATUSES[status]?.step || 1;
  return `<div class="progress ${status === 'closed' ? 'is-closed' : ''}" role="img" aria-label="Progress: ${REPORT_STATUSES[status]?.label}">
    ${[1, 2, 3, 4].map((i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('')}</div>`;
}

export function timeline(history = []) {
  return `<ol class="timeline">${history.map((h, i) => `<li class="${i === history.length - 1 ? 'is-current' : ''}"><i aria-hidden="true"></i>
    <div><strong>${esc(REPORT_STATUSES[h.status]?.label || h.status)}</strong> <time datetime="${h.at}">· ${formatDateTime(h.at)}</time>
    ${h.note ? `<p>${h.by === 'pvo' ? '<b>PVO:</b> ' : ''}${esc(h.note)}</p>` : ''}</div></li>`).join('')}</ol>`;
}

/** A report as its reporter sees it (account page). */
export function reportCard(r) {
  return `<article class="card report-card" id="r-${r._id}">
    <header>
      <div class="stack-sm" style="gap:4px">
        <div class="row" style="gap:6px">${reportTypeTag(r.type)}${reportStatusTag(r.status)}${r.priority === 'high' ? '<span class="tag tag-red">High priority</span>' : ''}</div>
        <h3>${r.pet?.name ? `${esc(r.pet.name)} · ` : ''}<span class="mono">${esc(r.reference)}</span></h3>
        <span class="muted small">${esc(r.location.barangay)}, ${esc(r.location.municipality)} · happened ${formatDate(r.incidentDate)} · filed ${formatDate(r.createdAt)}</span>
      </div>
      ${r.status === 'submitted' ? `<button class="btn btn-danger btn-sm" type="button" data-withdraw="${r._id}">Withdraw</button>` : ''}
    </header>
    ${progressBar(r.status)}
    <details>
      <summary class="link-btn" style="text-decoration:none">Details and updates (${r.history.length})</summary>
      <div class="stack" style="margin-top:12px">
        <p>${esc(r.description)}</p>
        ${r.photos?.length ? `<div class="case-photos">${r.photos.map((p) => `<img src="${esc(p)}" alt="Report photo" loading="lazy">`).join('')}</div>` : ''}
        ${r.publicAlert ? '<p class="notice notice-warn small">A public missing-pet alert is shown on the community wall while this report is open.</p>' : ''}
        ${timeline(r.history)}
      </div>
    </details>
  </article>`;
}

export { isAdmin };

/* ---------- Shop ---------- */

/** A product photo, or the category icon on a soft tile. */
export function productImg(p, cls = '') {
  const src = p.photos?.[0] || p.photo;
  return src
    ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy">`
    : `<div class="product-ph ${cls}" aria-hidden="true">${ICONS[PRODUCT_CATEGORIES[p.category]?.icon] || ICONS.bag}</div>`;
}

const soldText = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k sold` : `${n} sold`);

/** A product tile in the shop grid; the whole tile opens the product. */
export function productCard(p) {
  const out = p.stock < 1;
  return `<article class="product-card${out ? ' is-out' : ''}">
    <button class="product-open" type="button" data-product="${p._id}" aria-label="${esc(p.name)}, ${peso(p.price)}">
      <span class="product-photo">${productImg(p)}${out ? '<span class="tag product-flag">Sold out</span>' : p.stock <= 5 ? `<span class="tag tag-amber product-flag">Only ${p.stock} left</span>` : ''}</span>
      <span class="product-info">
        <span class="product-name">${esc(p.name)}</span>
        <span class="product-price">${peso(p.price)}</span>
        <span class="product-meta"><span>${esc(p.shop?.name || '')}</span>${p.sold ? `<span>${soldText(p.sold)}</span>` : ''}</span>
      </span>
    </button>
    ${out ? '' : `<button class="icon-btn product-add" type="button" data-add="${p._id}" aria-label="Add ${esc(p.name)} to cart">${ICONS.plus}</button>`}
  </article>`;
}

export const orderStatusTag = (s) => `<span class="tag ${ORDER_STATUSES[s]?.tag || ''}">${esc(ORDER_STATUSES[s]?.label || s)}</span>`;

/** Order progress: Placed → Confirmed → Ready → Completed. */
export function orderSteps(status) {
  if (status === 'cancelled') return '';
  const step = ORDER_STATUSES[status]?.step || 1;
  return `<ol class="order-steps">${['Placed', 'Confirmed', 'Ready', 'Completed'].map((l, i) => `<li class="${i < step ? 'on' : ''}">${l}</li>`).join('')}</ol>`;
}

/**
 * An order card. `as` is who is looking: 'buyer' (My orders), 'seller' (My shop)
 * or 'admin'. Sellers and staff get status buttons; buyers can cancel a new order.
 */
export function orderCard(o, as = 'buyer') {
  const next = { placed: ['confirmed', 'Confirm order'], confirmed: ['ready', 'Mark ready'], ready: ['completed', 'Mark completed'] }[o.status];
  const open = !['completed', 'cancelled'].includes(o.status);
  const who = as === 'buyer'
    ? `${ICONS.bag}${esc(o.shopName || 'Alaga Official Store')}`
    : `${ICONS.user}${esc(o.contact?.name || '')} · <a href="tel:${esc((o.contact?.phone || '').replace(/\s/g, ''))}">${esc(o.contact?.phone || '')}</a>`;
  return `<article class="card order-card" id="o-${o._id}">
    <header class="row between">
      <div class="stack-sm" style="gap:2px">
        <div class="row" style="gap:6px">${orderStatusTag(o.status)}<span class="mono small">${esc(o.reference)}</span>${as === 'admin' ? `<span class="muted small">${esc(o.shopName || '')}</span>` : ''}</div>
        <span class="order-who">${who}</span>
      </div>
      <span class="muted small">${formatDateTime(o.createdAt)}</span>
    </header>
    ${orderSteps(o.status)}
    <ul class="order-lines">${o.items.map((l) => `<li>${productImg(l)}<span>${esc(l.name)}<small>${l.qty} × ${peso(l.price)}</small></span><b>${peso(l.qty * l.price)}</b></li>`).join('')}</ul>
    <div class="order-total">
      <span class="muted small">${o.fulfillment === 'delivery' ? `${ICONS.truck}Delivery to ${esc([o.address?.details, o.address?.barangay, o.address?.municipality].filter(Boolean).join(', '))}` : `${ICONS.pin}Pickup`} · Cash${o.deliveryFee ? ` · ${peso(o.deliveryFee)} delivery` : ''}</span>
      <strong>${peso(o.total)}</strong>
    </div>
    ${o.note ? `<p class="small" style="margin:0"><b>Note:</b> ${esc(o.note)}</p>` : ''}
    <details><summary class="link-btn small" style="text-decoration:none">Updates (${o.history.length})</summary>
      <ol class="timeline" style="margin-top:10px">${o.history.map((h, i) => `<li class="${i === o.history.length - 1 ? 'is-current' : ''}"><i aria-hidden="true"></i><div><strong>${esc(ORDER_STATUSES[h.status]?.label || h.status)}</strong> <time datetime="${h.at}">· ${formatDateTime(h.at)}</time>${h.note ? `<p>${esc(h.note)}</p>` : ''}</div></li>`).join('')}</ol>
    </details>
    ${as === 'buyer' && o.status === 'placed' ? `<div class="row"><button class="btn btn-danger btn-sm" type="button" data-cancel-order="${o._id}">Cancel order</button></div>` : ''}
    ${as !== 'buyer' && open ? `<div class="row order-actions">
      ${next ? `<button class="btn btn-primary btn-sm" type="button" data-order-status="${next[0]}" data-order="${o._id}">${next[1]}</button>` : ''}
      <button class="btn btn-danger btn-sm" type="button" data-order-status="cancelled" data-order="${o._id}">Cancel</button>
    </div>` : ''}
  </article>`;
}
