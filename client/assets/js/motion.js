/**
 * Motion
 * ------
 * One small engine for every animation on the site:
 *  - Scroll reveal: elements with [data-reveal] (and product cards added later)
 *    rise into place the first time they enter the viewport, staggered ~45ms.
 *  - Count-up: animate numbers such as "13 cars on the lot".
 *  - Parallax: [data-parallax="0.12"] drifts an element against the scroll.
 *  - Battery gauges fill cell by cell when they become visible.
 *
 * Rules (from the ui-ux-pro-max motion guidelines):
 *  - transform/opacity only, shared duration/easing tokens in CSS
 *  - content is never hidden unless JS is running AND motion is allowed,
 *    and a safety timer reveals anything still hidden
 *  - prefers-reduced-motion turns all of it off and shows the final state
 */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
// Product cards, cart lines and spec sheets use a CSS entrance animation instead (see styles.css),
// because they are rendered after data loads and must never be left hidden.
const AUTO_REVEAL = '.tile, .panel[data-reveal-auto]';

let observer;

function reveal(el) {
  el.classList.add('is-in');
  observer?.unobserve(el);
}

function watch(el) {
  if (el.dataset.revealBound) return;
  el.dataset.revealBound = '1';
  el.classList.add('reveal');
  observer.observe(el);
}

/** Stagger items that enter together, in DOM order, 45ms apart (max 8 steps). */
function onIntersect(entries) {
  const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target);
  entering
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${Math.min(i, 8) * 45}ms`);
      reveal(el);
    });
}

export function initMotion() {
  if (reduce.matches || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('motion');

  observer = new IntersectionObserver(onIntersect, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll(`[data-reveal], ${AUTO_REVEAL}`).forEach(watch);

  // Cards and rows rendered later by page scripts get the same treatment.
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches(`[data-reveal], ${AUTO_REVEAL}`)) watch(n);
        n.querySelectorAll?.(`[data-reveal], ${AUTO_REVEAL}`).forEach(watch);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Safety net: never leave content hidden (e.g. a tab opened in the background).
  setTimeout(() => document.querySelectorAll('.reveal:not(.is-in)').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight) reveal(el);
  }), 2500);

  setupParallax();
  reduce.addEventListener('change', () => reduce.matches && document.querySelectorAll('.reveal').forEach(reveal));
}

/* ---------- Count-up ---------- */
const easeOut = (t) => 1 - Math.pow(1 - t, 4);

/**
 * Animate a number into an element.
 * @param {HTMLElement} el
 * @param {number} to       final value
 * @param {(n:number)=>string} format  how to print each frame
 */
export function countUp(el, to, format = (n) => String(Math.round(n)), duration = 1100) {
  if (!el) return;
  if (reduce.matches || !Number.isFinite(to)) { el.textContent = format(to); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = format(to * easeOut(t));
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = format(to);
  };
  requestAnimationFrame(step);
}

/* ---------- Parallax ---------- */
function setupParallax() {
  const items = [...document.querySelectorAll('[data-parallax]')];
  if (!items.length) return;
  let ticking = false;
  const update = () => {
    const vh = innerHeight;
    items.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      // -1 when the block enters at the bottom, +1 when it leaves at the top
      const progress = (vh - r.top) / (vh + r.height) * 2 - 1;
      el.style.setProperty('--parallax', `${(-progress * Number(el.dataset.parallax) * 100).toFixed(2)}px`);
    });
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}
